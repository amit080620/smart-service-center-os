import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

// Polled every few seconds by the persistent assignment-alert component
// in the dashboard layout. Only ever returns THIS employee's own
// unaccepted assignments — there's no reason for anyone else's client to
// see them, and it keeps the query trivially fast (indexed lookup on
// assigned_technician_id).
export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: jobs } = await admin
    .from('job_cards')
    .select('id, job_number, vehicle_id, customer_id')
    .eq('org_id', session.employee.org_id)
    .eq('assigned_technician_id', session.employee.id)
    .is('technician_accepted_at', null)
    .is('deleted_at', null)
    .not('status', 'in', '(completed,delivered,cancelled)');

  if (!jobs || jobs.length === 0) {
    return NextResponse.json([]);
  }

  const vehicleIds = jobs.map((j) => j.vehicle_id);
  const customerIds = jobs.map((j) => j.customer_id);
  const [{ data: vehicles }, { data: customers }] = await Promise.all([
    admin.from('vehicles').select('id, plate_number, make, model').in('id', vehicleIds),
    admin.from('customers').select('id, first_name, last_name').in('id', customerIds)
  ]);

  const populated = jobs.map((j) => {
    const vehicle = vehicles?.find((v) => v.id === j.vehicle_id);
    const customer = customers?.find((c) => c.id === j.customer_id);
    return {
      id: j.id,
      job_number: j.job_number,
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate_number})` : 'Unknown vehicle',
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown customer'
    };
  });

  return NextResponse.json(populated);
}
