import { redirect } from 'next/navigation';
import { getSessionContext, getActiveBranchId } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import JobCardsClient from './JobCardsClient';

export default async function JobCardsPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  // Scoped to whichever branch is currently active (the switcher, or
  // the employee's own branch if there's only one) — job cards are
  // created under a specific branch, so the list should only show that
  // branch's work, not every branch mixed together.
  const activeBranchId = await getActiveBranchId(session.employee.org_id, session.employee.branch_id);
  // Bounded to the most recent 500 — a shop's day-to-day work is always
  // in this window; anything older is better found via that vehicle's
  // or customer's own history page (unbounded, since those are already
  // scoped to one record instead of the whole org).
  const JOB_CARDS_LIMIT = 500;
  const [{ data: jobs }, { data: customers }, { data: vehicles }, { data: technicians }] = await Promise.all([
    admin
      .from('job_cards')
      .select('*')
      .eq('org_id', session.employee.org_id)
      .eq('branch_id', activeBranchId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(JOB_CARDS_LIMIT),
    admin
      .from('customers')
      .select('id, first_name, last_name, phone')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null),
    admin
      .from('vehicles')
      .select('id, customer_id, plate_number, make, model')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null),
    admin.from('employees').select('id, full_name').eq('org_id', session.employee.org_id).eq('role', 'technician')
  ]);

  // Same populate logic the API route uses for the list view — done here
  // directly during server render instead of a separate client fetch.
  const populatedJobs = (jobs ?? []).map((job) => {
    const customer = customers?.find((c) => c.id === job.customer_id);
    const vehicle = vehicles?.find((v) => v.id === job.vehicle_id);
    const technician = technicians?.find((t) => t.id === job.assigned_technician_id);
    return {
      ...job,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? '',
      technician_name: technician?.full_name ?? null
    };
  });

  return (
    <JobCardsClient
      initialJobs={populatedJobs}
      initialCustomers={customers ?? []}
      initialVehicles={vehicles ?? []}
      isLimited={(jobs ?? []).length >= JOB_CARDS_LIMIT}
    />
  );
}
