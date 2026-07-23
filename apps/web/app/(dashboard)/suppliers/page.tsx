import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import SuppliersClient from './SuppliersClient';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export default async function SuppliersPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: suppliers }, { data: bills }] = await Promise.all([
    admin.from('suppliers').select('*').eq('org_id', session.employee.org_id).order('name'),
    admin.from('supplier_bills').select('*').eq('org_id', session.employee.org_id).order('bill_date', { ascending: false })
  ]);

  const populatedSuppliers = (suppliers ?? []).map((s) => ({
    ...s,
    total_pending: (bills ?? []).filter((b) => b.supplier_id === s.id).reduce((sum, b) => sum + b.balance_due, 0),
    bill_count: (bills ?? []).filter((b) => b.supplier_id === s.id).length
  }));

  return (
    <SuppliersClient
      initialSuppliers={populatedSuppliers}
      initialBills={bills ?? []}
      canManage={canManagePartsCatalog(session.employee.role)}
    />
  );
}
