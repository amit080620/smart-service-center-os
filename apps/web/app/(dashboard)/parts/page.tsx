import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManagePartsCatalog } from '@smartbizos/permissions';
import PartsClient from './PartsClient';

export default async function PartsPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: parts }, { data: suppliers }] = await Promise.all([
    admin
      .from('parts')
      .select('id, name, sku, description, category, supplier_id, unit_cost, discount_percent, is_active')
      .eq('org_id', session.employee.org_id)
      .order('name'),
    admin.from('suppliers').select('id, name').eq('org_id', session.employee.org_id).order('name')
  ]);

  const populated = (parts ?? []).map((p) => ({
    ...p,
    supplier_name: suppliers?.find((s) => s.id === p.supplier_id)?.name ?? null
  }));

  return (
    <PartsClient
      initialParts={populated}
      suppliers={suppliers ?? []}
      canManage={canManagePartsCatalog(session.employee.role)}
    />
  );
}
