import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { addLineItemSchema } from '@smartbizos/validation';

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

  // Locked once completed/delivered/cancelled — same rule as the previous
  // build: a finished job's line items are frozen.
  if (['completed', 'delivered', 'cancelled'].includes(job.status)) {
    return NextResponse.json(
      { error: { code: 'LOCKED', message: 'This job card is completed or delivered and cannot be edited.' } },
      { status: 400 }
    );
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

  // Branched explicitly (not a computed property key) — Supabase's strict
  // per-table Insert types reject a dynamically-keyed object even when the
  // key is one of the valid union members at runtime.
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

  // Recalculate estimated_cost from all line items — single source of
  // truth is always the sum of what's actually stored, not an
  // incrementally-tracked running total (which can drift).
  const [{ data: services }, { data: parts }] = await Promise.all([
    admin.from('job_services').select('qty, unit_cost').eq('job_id', jobId),
    admin.from('job_parts').select('qty, unit_cost').eq('job_id', jobId)
  ]);
  const total =
    (services ?? []).reduce((sum, s) => sum + s.qty * s.unit_cost, 0) +
    (parts ?? []).reduce((sum, p) => sum + p.qty * p.unit_cost, 0);

  const { data: updatedJob, error: updateError } = await admin
    .from('job_cards')
    .update({ estimated_cost: total, final_cost: total, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, job: updatedJob });
}
