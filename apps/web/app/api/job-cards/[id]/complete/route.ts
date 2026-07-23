import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { completeJobSchema } from '@smartbizos/validation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: jobId } = await params;

  const admin = createSupabaseAdminClient();

  const { data: job } = await admin
    .from('job_cards')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job card not found in your organization.' } }, { status: 404 });
  }

  if (job.status === 'completed' || job.status === 'delivered') {
    return NextResponse.json({ error: { code: 'ALREADY_COMPLETED', message: 'This job is already completed.' } }, { status: 400 });
  }

  // Same rule as the previous build: a job must be approved by a branch
  // manager/org owner before it can be completed and billed — prevents an
  // un-reviewed estimate from silently becoming a real invoice.
  if (job.status !== 'approved') {
    return NextResponse.json(
      { error: { code: 'NOT_APPROVED', message: 'This job must be approved before it can be completed and billed.' } },
      { status: 400 }
    );
  }

  // Recalculate the subtotal directly from stored line items — the same
  // source of truth used every time a line item is added, never a
  // separately-tracked running total that could drift.
  const [{ data: jobServices }, { data: jobParts }] = await Promise.all([
    admin.from('job_services').select('qty, unit_cost').eq('job_id', jobId),
    admin.from('job_parts').select('qty, unit_cost').eq('job_id', jobId)
  ]);
  const subtotal =
    (jobServices ?? []).reduce((sum, s) => sum + s.qty * s.unit_cost, 0) +
    (jobParts ?? []).reduce((sum, p) => sum + p.qty * p.unit_cost, 0);

  // Discount and GST are entered manually at completion time (default 0
  // — no discount, no tax added unless the person filling this in
  // chooses to), rather than auto-calculated from org settings. This
  // matches how this business actually wants to bill: nothing assumed,
  // everything explicit per invoice.
  const body = await req.json().catch(() => ({}));
  const parsed = completeJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const discountAmount =
    parsed.data.discountType === 'percentage' ? Math.round(subtotal * (parsed.data.discountValue / 100)) : parsed.data.discountValue;
  if (discountAmount > subtotal) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Discount cannot exceed the subtotal.' } }, { status: 400 });
  }

  const tax = parsed.data.gstAmount;
  const total = subtotal - discountAmount + tax;

  // Sequential invoice number scoped to this org + current year. Uses the
  // max existing sequence number (not array length) so a voided invoice
  // can't cause a duplicate number to be reissued later.
  const currentYear = new Date().getFullYear();
  const yearPrefix = `INV-${currentYear}-`;
  const { data: existingInvoices } = await admin
    .from('invoices')
    .select('invoice_number')
    .eq('org_id', session.employee.org_id)
    .ilike('invoice_number', `${yearPrefix}%`);
  const maxSeq = (existingInvoices ?? []).reduce((max, inv) => {
    const seq = parseInt(inv.invoice_number.slice(yearPrefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  const invoiceNumber = `${yearPrefix}${String(maxSeq + 1).padStart(6, '0')}`;

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      org_id: session.employee.org_id,
      job_id: jobId,
      invoice_number: invoiceNumber,
      subtotal,
      discount: discountAmount,
      tax_type: 'manual',
      tax,
      total,
      amount_paid: 0,
      balance_due: total,
      status: total <= 0 ? 'paid' : 'sent',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: invoiceError?.message ?? 'Could not generate invoice.' } },
      { status: 500 }
    );
  }

  const { data: updatedJob, error: jobUpdateError } = await admin
    .from('job_cards')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      final_cost: total,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select()
    .single();

  if (jobUpdateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: jobUpdateError.message } }, { status: 500 });
  }

  await admin.from('job_status_logs').insert({
    job_id: jobId,
    old_status: job.status,
    new_status: 'completed',
    changed_by: session.employee.id,
    note: `Job completed and invoice ${invoiceNumber} generated.`
  });

  // Auto-deduct used parts from this branch's inventory — the deferred
  // piece noted when Billing was first built. Deliberately non-blocking:
  // if a part isn't inventory-tracked at this branch (or stock is already
  // zero), the job still completes and the invoice still stands — a
  // billing operation shouldn't fail because stock counts are behind.
  // Each deduction is logged as a 'sold' transaction with the job id.
  const { data: usedParts } = await admin.from('job_parts').select('part_id, qty').eq('job_id', jobId);
  for (const used of usedParts ?? []) {
    const { data: invRow } = await admin
      .from('inventory')
      .select('id, qty_on_hand')
      .eq('org_id', session.employee.org_id)
      .eq('branch_id', job.branch_id)
      .eq('part_id', used.part_id)
      .maybeSingle();
    if (invRow) {
      const newQty = Math.max(0, invRow.qty_on_hand - used.qty);
      await admin
        .from('inventory')
        .update({ qty_on_hand: newQty, updated_at: new Date().toISOString() })
        .eq('id', invRow.id);
      await admin.from('inventory_transactions').insert({
        inventory_id: invRow.id,
        type: 'sold',
        qty: -used.qty,
        reference_job_id: jobId,
        performed_by: session.employee.id,
        notes: `Used on job ${job.job_number}`
      });
    }
  }

  return NextResponse.json({ success: true, invoice, job: updatedJob });
}
