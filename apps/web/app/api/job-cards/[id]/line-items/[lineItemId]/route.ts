import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canEditCompletedJob } from '@smartbizos/permissions';
import { syncJobAndInvoiceTotals } from '../../_lib/syncJobTotals';
import { z } from 'zod';

const EDIT_WINDOW_DAYS = 15;

const updateQtySchema = z.object({
  qty: z.number().min(0.01, 'Quantity must be greater than zero.')
});

// Shared by both PATCH and DELETE — same job lookup + permission +
// edit-window checks either handler needs before touching a line item.
async function checkEditable(jobId: string, orgId: string, role: string) {
  const admin = createSupabaseAdminClient();
  const { data: job } = await admin
    .from('job_cards')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!job) {
    return { error: NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job card not found in your organization.' } }, { status: 404 }) };
  }
  if (job.status === 'cancelled' || job.status === 'delivered') {
    return {
      error: NextResponse.json(
        { error: { code: 'LOCKED', message: 'This job card is delivered or cancelled and cannot be edited.' } },
        { status: 400 }
      )
    };
  }
  if (job.status === 'completed') {
    if (!canEditCompletedJob(role as any)) {
      return {
        error: NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Only managers/owners can edit a completed job\u2019s items.' } },
          { status: 403 }
        )
      };
    }
    const completedAt = job.completed_at ? new Date(job.completed_at) : null;
    const daysSince = completedAt ? (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
    if (daysSince > EDIT_WINDOW_DAYS) {
      return {
        error: NextResponse.json(
          {
            error: {
              code: 'EDIT_WINDOW_EXPIRED',
              message: `This job was completed more than ${EDIT_WINDOW_DAYS} days ago and can no longer be edited.`
            }
          },
          { status: 400 }
        )
      };
    }
  }
  return { job };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: jobId, lineItemId } = await params;
  const type = req.nextUrl.searchParams.get('type');
  if (type !== 'service' && type !== 'part') {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'type must be "service" or "part".' } }, { status: 400 });
  }

  const check = await checkEditable(jobId, session.employee.org_id, session.employee.role);
  if (check.error) return check.error;
  const job = check.job!;

  const body = await req.json();
  const parsed = updateQtySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const table = type === 'service' ? 'job_services' : 'job_parts';

  // Fetched separately per branch (not via the dynamic `table` variable)
  // so TypeScript can narrow the row shape correctly — the union type from
  // a dynamically-selected table loses the part-specific `part_id` field.
  const existingRow =
    type === 'service'
      ? (await admin.from('job_services').select('*').eq('id', lineItemId).eq('job_id', jobId).maybeSingle()).data
      : (await admin.from('job_parts').select('*').eq('id', lineItemId).eq('job_id', jobId).maybeSingle()).data;
  if (!existingRow) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Line item not found on this job card.' } }, { status: 404 });
  }

  // If this is a part on an already-completed job, adjust inventory by
  // the DIFFERENCE — e.g. qty 3 -> 2 restores 1 unit back to stock.
  if (type === 'part' && job.status === 'completed' && 'part_id' in existingRow) {
    const qtyDelta = existingRow.qty - parsed.data.qty; // positive = restore stock
    if (qtyDelta !== 0) {
      const { data: invRow } = await admin
        .from('inventory')
        .select('id, qty_on_hand')
        .eq('org_id', session.employee.org_id)
        .eq('branch_id', job.branch_id)
        .eq('part_id', existingRow.part_id)
        .maybeSingle();
      if (invRow) {
        const newQty = Math.max(0, invRow.qty_on_hand + qtyDelta);
        await admin.from('inventory').update({ qty_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', invRow.id);
        await admin.from('inventory_transactions').insert({
          inventory_id: invRow.id,
          type: 'adjusted',
          qty: qtyDelta,
          reference_job_id: jobId,
          performed_by: session.employee.id,
          notes: `Quantity corrected on job ${job.job_number} (post-completion edit)`
        });
      }
    }
  }

  const { error: updateError } = await admin.from(table).update({ qty: parsed.data.qty }).eq('id', lineItemId);
  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  const cgstRate = Number(session.org.settings.cgst_rate ?? 9);
  const sgstRate = Number(session.org.settings.sgst_rate ?? 9);
  await syncJobAndInvoiceTotals(admin, jobId, session.employee.org_id, cgstRate, sgstRate);

  if (job.status === 'completed') {
    await admin.from('job_status_logs').insert({
      job_id: jobId,
      old_status: 'completed',
      new_status: 'completed',
      changed_by: session.employee.id,
      note: `Quantity edited after completion by ${session.employee.full_name} — invoice updated.`
    });
  }

  const { data: updatedJob } = await admin.from('job_cards').select('*').eq('id', jobId).maybeSingle();
  return NextResponse.json({ success: true, job: updatedJob });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: jobId, lineItemId } = await params;
  const type = req.nextUrl.searchParams.get('type');
  if (type !== 'service' && type !== 'part') {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'type must be "service" or "part".' } }, { status: 400 });
  }

  const check = await checkEditable(jobId, session.employee.org_id, session.employee.role);
  if (check.error) return check.error;
  const job = check.job!;

  const admin = createSupabaseAdminClient();
  const table = type === 'service' ? 'job_services' : 'job_parts';

  const existingRow =
    type === 'service'
      ? (await admin.from('job_services').select('*').eq('id', lineItemId).eq('job_id', jobId).maybeSingle()).data
      : (await admin.from('job_parts').select('*').eq('id', lineItemId).eq('job_id', jobId).maybeSingle()).data;
  if (!existingRow) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Line item not found on this job card.' } }, { status: 404 });
  }

  // Removing a part from an already-completed job restores its full
  // quantity back to inventory (reversing the deduction made at
  // completion time).
  if (type === 'part' && job.status === 'completed' && 'part_id' in existingRow) {
    const { data: invRow } = await admin
      .from('inventory')
      .select('id, qty_on_hand')
      .eq('org_id', session.employee.org_id)
      .eq('branch_id', job.branch_id)
      .eq('part_id', existingRow.part_id)
      .maybeSingle();
    if (invRow) {
      const newQty = invRow.qty_on_hand + existingRow.qty;
      await admin.from('inventory').update({ qty_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', invRow.id);
      await admin.from('inventory_transactions').insert({
        inventory_id: invRow.id,
        type: 'adjusted',
        qty: existingRow.qty,
        reference_job_id: jobId,
        performed_by: session.employee.id,
        notes: `Removed from job ${job.job_number} (post-completion edit) — stock restored`
      });
    }
  }

  const { error: deleteError } = await admin.from(table).delete().eq('id', lineItemId);
  if (deleteError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: deleteError.message } }, { status: 500 });
  }

  const cgstRate = Number(session.org.settings.cgst_rate ?? 9);
  const sgstRate = Number(session.org.settings.sgst_rate ?? 9);
  await syncJobAndInvoiceTotals(admin, jobId, session.employee.org_id, cgstRate, sgstRate);

  if (job.status === 'completed') {
    await admin.from('job_status_logs').insert({
      job_id: jobId,
      old_status: 'completed',
      new_status: 'completed',
      changed_by: session.employee.id,
      note: `Item removed after completion by ${session.employee.full_name} — invoice updated.`
    });
  }

  const { data: updatedJob } = await admin.from('job_cards').select('*').eq('id', jobId).maybeSingle();
  return NextResponse.json({ success: true, job: updatedJob });
}
