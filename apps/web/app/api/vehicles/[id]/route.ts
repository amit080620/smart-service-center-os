import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { vehicleSchema } from '@smartbizos/validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Vehicle not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = vehicleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  // Duplicate plate-number check, scoped to this org, excluding this
  // vehicle itself — same rule the create route enforces.
  if (parsed.data.plateNumber !== undefined) {
    const { data: dupe } = await admin
      .from('vehicles')
      .select('id')
      .eq('org_id', session.employee.org_id)
      .eq('plate_number', parsed.data.plateNumber)
      .neq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_PLATE', message: 'Another vehicle already uses this plate number.' } },
        { status: 409 }
      );
    }
  }

  const { data: updated, error } = await admin
    .from('vehicles')
    .update({
      ...(parsed.data.plateNumber !== undefined && { plate_number: parsed.data.plateNumber }),
      ...(parsed.data.vin !== undefined && { vin: parsed.data.vin }),
      ...(parsed.data.make !== undefined && { make: parsed.data.make }),
      ...(parsed.data.vehicleType !== undefined && { vehicle_type: parsed.data.vehicleType }),
      ...(parsed.data.model !== undefined && { model: parsed.data.model }),
      ...(parsed.data.year !== undefined && { year: parsed.data.year }),
      ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update vehicle.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// Soft delete only — same reasoning as customers: a vehicle already
// linked to job cards and invoices can't be hard-deleted without
// breaking that history.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Vehicle not found in your organization.' } }, { status: 404 });
  }

  const { error } = await admin.from('vehicles').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
