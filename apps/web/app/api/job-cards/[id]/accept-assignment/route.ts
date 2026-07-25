import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: jobId } = await params;

  const admin = createSupabaseAdminClient();

  // Only the actually-assigned technician can accept their own
  // assignment — not just anyone who happens to hit this endpoint.
  const { data: job } = await admin
    .from('job_cards')
    .select('id, assigned_technician_id')
    .eq('id', jobId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job card not found in your organization.' } }, { status: 404 });
  }
  if (job.assigned_technician_id !== session.employee.id) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'This job is not assigned to you.' } }, { status: 403 });
  }

  const { error } = await admin
    .from('job_cards')
    .update({ technician_accepted_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
