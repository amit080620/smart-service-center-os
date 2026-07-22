import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import JobCardsClient from './JobCardsClient';

export default async function JobCardsPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: jobs }, { data: customers }, { data: vehicles }] = await Promise.all([
    admin
      .from('job_cards')
      .select('*')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('customers')
      .select('id, first_name, last_name')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null),
    admin
      .from('vehicles')
      .select('id, customer_id, plate_number, make, model')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
  ]);

  // Same populate logic the API route uses for the list view — done here
  // directly during server render instead of a separate client fetch.
  const populatedJobs = (jobs ?? []).map((job) => {
    const customer = customers?.find((c) => c.id === job.customer_id);
    const vehicle = vehicles?.find((v) => v.id === job.vehicle_id);
    return {
      ...job,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? ''
    };
  });

  return (
    <JobCardsClient initialJobs={populatedJobs} initialCustomers={customers ?? []} initialVehicles={vehicles ?? []} />
  );
}
