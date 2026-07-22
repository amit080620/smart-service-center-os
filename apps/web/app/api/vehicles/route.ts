import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { vehicleSchema } from '@smartbizos/validation';

export async function GET(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const customerId = req.nextUrl.searchParams.get('customerId');
  const admin = createSupabaseAdminClient();

  let query = admin.from('vehicles').select('*').eq('org_id', session.employee.org_id).is('deleted_at', null);
  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: vehicles, error } = await query;
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(vehicles ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const body = await req.json();
  const parsed = vehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Verify the customer belongs to the caller's org — a vehicle can't be
  // attached to another organization's customer.
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('id', parsed.data.customerId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Customer not found in your organization.' } }, { status: 404 });
  }

  // Duplicate plate check, scoped to this org.
  const { data: existing } = await admin
    .from('vehicles')
    .select('id')
    .eq('org_id', session.employee.org_id)
    .eq('plate_number', parsed.data.plateNumber)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: 'DUPLICATE_PLATE', message: 'A vehicle with this plate number already exists.' } },
      { status: 409 }
    );
  }

  const { data: vehicle, error } = await admin
    .from('vehicles')
    .insert({
      org_id: session.employee.org_id,
      customer_id: parsed.data.customerId,
      plate_number: parsed.data.plateNumber,
      vin: parsed.data.vin,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year ?? new Date().getFullYear(),
      color: parsed.data.color,
      odometer_km: parsed.data.odometerKm,
      notes: parsed.data.notes
    })
    .select()
    .single();

  if (error || !vehicle) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create vehicle.' } }, { status: 500 });
  }

  return NextResponse.json(vehicle, { status: 201 });
}