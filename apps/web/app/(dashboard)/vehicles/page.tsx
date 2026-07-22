import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import VehiclesClient from './VehiclesClient';

export default async function VehiclesPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: vehicles }, { data: customers }] = await Promise.all([
    admin
      .from('vehicles')
      .select('id, customer_id, plate_number, make, model, year, color, odometer_km')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('customers')
      .select('id, first_name, last_name')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
  ]);

  return <VehiclesClient initialVehicles={vehicles ?? []} initialCustomers={customers ?? []} />;
}
