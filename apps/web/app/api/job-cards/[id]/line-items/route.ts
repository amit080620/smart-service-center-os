import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { addLineItemSchema } from '@smartbizos/validation';
import { canEditCompletedJob } from '@smartbizos/permissions';
import { syncJobAndInvoiceTotals } from '../_lib/syncJobTotals';

const EDIT_WINDOW_DAYS = 15;

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

  // Once cancelled, or once delivered, or once past the admin edit window
  // after completion, line items are permanently frozen for everyone.
  if (job.status === 'cancelled' || job.status === 'delivered') {
    return NextResponse.json(
      { error: { code: 'LOCKED', message: 'This job card is delivered or cancelled and cannot be edited.' } },
      { status: 400 }
    );
  }

  if (job.status === 'completed') {
    // Completed jobs can only be edited by management roles, and only
    // within EDIT_WINDOW_DAYS of the original completion — see
    // packages/permissions for the role rule.
    if (!canEditCompletedJob(session.employee.role)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only managers/owners can edit a completed job\u2019s items.' } },
        { status: 403 }
      );
    }
    const completedAt = job.completed_at ? new Date(job.completed_at) : null;
    const daysSinceCompletion = completedAt ? (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
    if (daysSinceCompletion > EDIT_WINDOW_DAYS) {
      return NextResponse.json(
        {
          error: {
            code: 'EDIT_WINDOW_EXPIRED',
            message: `This job was completed more than ${EDIT_WINDOW_DAYS} days ago and can no longer be edited.`
          }
        },
        { status: 400 }
      );
    }
  }

  const body = await req.json();
  const parsed = addLineItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const catalogTable = parsed.data.type === 'service' ? 'services' : 'parts';
  const { data: catalogItem } = await admin
    .from(catalogTable)
    .select('id')
    .eq('id', parsed.data.itemId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!catalogItem) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Catalog item not found in your organization.' } }, { status: 404 });
  }

  const insertError =
    parsed.data.type === 'service'
      ? (
          await admin.from('job_services').insert({
            job_id: jobId,
            service_id: parsed.data.itemId,
            qty: parsed.data.qty,
            unit_cost: parsed.data.unitCost
          })
        ).error
      : (
          await admin.from('job_parts').insert({
            job_id: jobId,
            part_id: parsed.data.itemId,
            qty: parsed.data.qty,
            unit_cost: parsed.data.unitCost
          })
        ).error;
  if (insertError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: insertError.message } }, { status: 500 });
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
      note: `Item added after completion by ${session.employee.full_name} (within edit window) — invoice updated.`
    });
  }

  const { data: updatedJob } = await admin.from('job_cards').select('*').eq('id', jobId).maybeSingle();
  return NextResponse.json({ success: true, job: updatedJob });
}
