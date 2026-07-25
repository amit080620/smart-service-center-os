import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageServicesCatalog } from '@smartbizos/permissions';
import ServicesClient from './ServicesClient';

export default async function ServicesPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data: services } = await admin
    .from('services')
    .select('id, name, description, base_cost, discount_percent, est_duration_minutes, category, hsn_sac_code, unit, is_active')
    .eq('org_id', session.employee.org_id)
    .order('name');

  return <ServicesClient initialServices={services ?? []} canManage={canManageServicesCatalog(session.employee.role)} />;
}
