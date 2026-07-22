import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { editInvoiceSchema } from '@smartbizos/validation';
import { canEditCompletedJob } from '@smartbizos/permissions';

const EDIT_WINDOW_DAYS = 15;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found in your organization.' } }, { status: 404 });
  }

  const [{ data: job }, { data: payments }] = await Promise.all([
    admin.from('job_cards').select('*').eq('id', invoice.job_id).maybeSingle(),
    admin.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false })
  ]);

  let customer = null;
  let vehicle = null;
  let services: unknown[] = [];
  let parts: unknown[] = [];

  if (job) {
    const [{ data: customerData }, { data: vehicleData }, { data: jobServices }, { data: jobParts }] = await Promise.all([
      admin.from('customers').select('*').eq('id', job.customer_id).maybeSingle(),
      admin.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
      admin.from('job_services').select('*').eq('job_id', job.id),
      admin.from('job_parts').select('*').eq('job_id', job.id)
    ]);
    customer = customerData;
    vehicle = vehicleData;

    const serviceIds = (jobServices ?? []).map((s) => s.service_id);
    const partIds = (jobParts ?? []).map((p) => p.part_id);
    const [{ data: serviceCatalog }, { data: partCatalog }] = await Promise.all([
      serviceIds.length ? admin.from('services').select('id, name').in('id', serviceIds) : Promise.resolve({ data: [] }),
      partIds.length ? admin.from('parts').select('id, name').in('id', partIds) : Promise.resolve({ data: [] })
    ]);
    services = (jobServices ?? []).map((s) => ({
      ...s,
      name: serviceCatalog?.find((c) => c.id === s.service_id)?.name ?? 'Unknown'
    }));
    parts = (jobParts ?? []).map((p) => ({
      ...p,
      name: partCatalog?.find((c) => c.id === p.part_id)?.name ?? 'Unknown'
    }));
  }

  const daysSinceIssued = (Date.now() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const canEdit = canEditCompletedJob(session.employee.role) && daysSinceIssued <= EDIT_WINDOW_DAYS;

  return NextResponse.json({
    invoice: {
      ...invoice,
      job_number: job?.job_number ?? 'Unknown',
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      customer_phone: customer?.phone ?? '',
      customer_address: customer?.address ?? '',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? ''
    },
    services,
    parts,
    payments: payments ?? [],
    canEdit
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: invoiceId } = await params;

  // Editing an already-issued invoice (discount, tax treatment) is
  // restricted to management roles — same rule and same 15-day window as
  // editing a completed job's line items, since both are "correcting
  // something already billed."
  if (!canEditCompletedJob(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only managers/owners can edit an issued invoice.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found in your organization.' } }, { status: 404 });
  }

  const daysSinceIssued = (Date.now() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceIssued > EDIT_WINDOW_DAYS) {
    return NextResponse.json(
      {
        error: {
          code: 'EDIT_WINDOW_EXPIRED',
          message: `This invoice was issued more than ${EDIT_WINDOW_DAYS} days ago and can no longer be edited.`
        }
      },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = editInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  if (parsed.data.discount > invoice.subtotal) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Discount cannot exceed the subtotal.' } },
      { status: 400 }
    );
  }

  // GST law requires CGST+SGST for same-state sales, or IGST for
  // inter-state — never both. The rate applied depends on which the
  // admin selects here, pulled from the org's own configured rates.
  const cgstRate = Number(session.org.settings.cgst_rate ?? 9);
  const sgstRate = Number(session.org.settings.sgst_rate ?? 9);
  const igstRate = Number(session.org.settings.igst_rate ?? 18);
  const effectiveRate = parsed.data.taxType === 'igst' ? igstRate : cgstRate + sgstRate;

  const effectiveSubtotal = invoice.subtotal - parsed.data.discount;
  const tax = Math.round(effectiveSubtotal * (effectiveRate / 100));
  const total = effectiveSubtotal + tax;
  const balanceDue = total - invoice.amount_paid;

  const { data: updated, error } = await admin
    .from('invoices')
    .update({
      discount: parsed.data.discount,
      tax_type: parsed.data.taxType,
      tax,
      total,
      balance_due: balanceDue,
      status: balanceDue <= 0 ? 'paid' : 'sent',
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update invoice.' } }, { status: 500 });
  }

  // Keep the job card's final_cost consistent with the invoice total.
  await admin.from('job_cards').update({ final_cost: total, updated_at: new Date().toISOString() }).eq('id', invoice.job_id);

  // Audit trail — same pattern as job line-item edits after completion.
  await admin.from('job_status_logs').insert({
    job_id: invoice.job_id,
    old_status: 'completed',
    new_status: 'completed',
    changed_by: session.employee.id,
    note: `Invoice ${invoice.invoice_number} edited by ${session.employee.full_name}: discount \u20b9${parsed.data.discount}, ${parsed.data.taxType === 'igst' ? 'IGST' : 'CGST+SGST'} applied.`
  });

  return NextResponse.json(updated);
}
