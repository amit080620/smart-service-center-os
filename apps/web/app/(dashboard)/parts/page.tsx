import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import PartsClient from './PartsClient';

export default async function PartsPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data: parts } = await admin
    .from('parts')
    .select('id, name, sku, description, category, supplier, unit_cost')
    .eq('org_id', session.employee.org_id)
    .order('name');

  return <PartsClient initialParts={parts ?? []} />;
}
