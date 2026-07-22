import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import CustomersClient from './CustomersClient';

// Server Component — fetches directly from Supabase during render, no
// client-side fetch('/api/customers') round trip on first load. This is
// the fix for the "every page loads blank then pops in" slowness: the
// previous version was a full Client Component that only started
// fetching AFTER the JS bundle loaded and hydrated, adding an extra
// browser->server HTTP hop on top of the server->Supabase query that was
// always going to be needed anyway.
export default async function CustomersPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data: customers } = await admin
    .from('customers')
    .select('id, first_name, last_name, phone, email')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return <CustomersClient initialCustomers={customers ?? []} />;
}
