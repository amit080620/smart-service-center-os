import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { updateJobStatusSchema } from '@smartbizos/validation';
import { canApproveJobCard } from '@smartbizos/permissions';
import type { Database } from '@smartbizos/database';

type JobCardUpdate = Database['public']['Tables']['job_cards']['Update'];

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

  const body = await req.json();
  const parsed = updateJobStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  // Approving an estimate is restricted — only branch managers/org owners.
  // See packages/permissions for the exact rule.
  if (parsed.data.status === 'approved' && !canApproveJobCard(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only branch managers and org owners can approve job card estimates.' } },
      { status: 403 }
    );
  }

  const oldStatus = job.status;
  const updates: JobCardUpdate = {
    status: parsed.data.status,
    updated_at: new Date().toISOString()
  };
  if (parsed.data.assignedTechnicianId !== undefined) {
    updates.assigned_technician_id = parsed.data.assignedTechnicianId;
  }
  if (parsed.data.status === 'approved') {
    updates.approved_by = session.employee.id;
    updates.approved_at = new Date().toISOString();
  }
  if (parsed.data.status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }
  if (parsed.data.status === 'delivered') {
    updates.delivered_at = new Date().toISOString();
  }

  const { data: updatedJob, error } = await admin.from('job_cards').update(updates).eq('id', jobId).select().single();

  if (error || !updatedJob) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update job card.' } }, { status: 500 });
  }

  await admin.from('job_status_logs').insert({
    job_id: jobId,
    old_status: oldStatus,
    new_status: parsed.data.status,
    changed_by: session.employee.id,
    note: parsed.data.note || `Status changed from ${oldStatus} to ${parsed.data.status}`
  });

  return NextResponse.json(updatedJob);
}
