import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { z } from 'zod';

const assignSchema = z.object({ technicianId: z.string().uuid().nullable() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: jobId } = await params;

  const admin = createSupabaseAdminClient();
  const { data: job } = await admin
    .from('job_cards')
    .select('id')
    .eq('id', jobId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job card not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid technician id.' } }, { status: 400 });
  }

  if (parsed.data.technicianId) {
    const { data: tech } = await admin
      .from('employees')
      .select('id')
      .eq('id', parsed.data.technicianId)
      .eq('org_id', session.employee.org_id)
      .eq('role', 'technician')
      .maybeSingle();
    if (!tech) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Technician not found in your organization.' } }, { status: 404 });
    }
  }

  const { data: updated, error } = await admin
    .from('job_cards')
    .update({
      assigned_technician_id: parsed.data.technicianId,
      // Reset acceptance whenever the assignment changes (including
      // unassigning) — a fresh assignment always needs a fresh accept,
      // otherwise switching technicians could silently carry over a
      // stale "accepted" state from whoever was assigned before.
      technician_accepted_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not assign technician.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
