import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { createJobCardSchema } from '@smartbizos/validation';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: jobs, error } = await admin
    .from('job_cards')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!jobs || jobs.length === 0) {
    return NextResponse.json([]);
  }

  // Populate customer name + vehicle plate for the list view — avoids a
  // separate round-trip per row on the frontend.
  const customerIds = [...new Set(jobs.map((j) => j.customer_id))];
  const vehicleIds = [...new Set(jobs.map((j) => j.vehicle_id))];

  const [{ data: customers }, { data: vehicles }] = await Promise.all([
    admin.from('customers').select('id, first_name, last_name').in('id', customerIds),
    admin.from('vehicles').select('id, plate_number, make, model').in('id', vehicleIds)
  ]);

  const populated = jobs.map((job) => {
    const customer = customers?.find((c) => c.id === job.customer_id);
    const vehicle = vehicles?.find((v) => v.id === job.vehicle_id);
    return {
      ...job,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? ''
    };
  });

  return NextResponse.json(populated);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createJobCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Verify customer and vehicle both belong to the caller's own org —
  // never trust client-supplied ids without checking ownership first.
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('id', parsed.data.customerId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id')
    .eq('id', parsed.data.vehicleId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer || !vehicle) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Customer or vehicle not found in your organization.' } },
      { status: 404 }
    );
  }

  // Generate a sequential job number, scoped to this org — counts existing
  // job cards rather than trusting any client-supplied number.
  const { count } = await admin
    .from('job_cards')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', session.employee.org_id);
  const jobNumber = `JC-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const { data: job, error } = await admin
    .from('job_cards')
    .insert({
      org_id: session.employee.org_id,
      branch_id: session.employee.branch_id,
      customer_id: parsed.data.customerId,
      vehicle_id: parsed.data.vehicleId,
      job_number: jobNumber,
      status: 'received',
      created_by: session.employee.id,
      odometer_in: parsed.data.odometerIn,
      notes: parsed.data.notes
    })
    .select()
    .single();

  if (error || !job) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create job card.' } }, { status: 500 });
  }

  // Initial status log entry — same pattern as every subsequent status
  // change, so the full history is always visible from job creation.
  await admin.from('job_status_logs').insert({
    job_id: job.id,
    old_status: null,
    new_status: 'received',
    changed_by: session.employee.id,
    note: 'Job card created'
  });

  return NextResponse.json(job, { status: 201 });
}
