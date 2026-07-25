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
  const [{ data: suppliers }, { data: bills }, { data: billItems }, { data: parts }] = await Promise.all([
    admin.from('suppliers').select('*').eq('org_id', session.employee.org_id).order('name'),
    admin.from('supplier_bills').select('*').eq('org_id', session.employee.org_id).order('bill_date', { ascending: false }),
    admin.from('supplier_bill_items').select('*'),
    admin.from('parts').select('id, name, sku, unit_cost').eq('org_id', session.employee.org_id).eq('is_active', true).order('name')
  ]);

  const populatedSuppliers = (suppliers ?? []).map((s) => ({
    ...s,
    total_pending: (bills ?? []).filter((b) => b.supplier_id === s.id).reduce((sum, b) => sum + b.balance_due, 0),
    bill_count: (bills ?? []).filter((b) => b.supplier_id === s.id).length
  }));

  const relevantBillIds = new Set((bills ?? []).map((b) => b.id));
  const populatedBills = (bills ?? []).map((b) => ({
    ...b,
    items: (billItems ?? [])
      .filter((i) => i.bill_id === b.id && relevantBillIds.has(i.bill_id))
      .map((i) => ({
        id: i.id,
        part_id: i.part_id,
        part_name: parts?.find((p) => p.id === i.part_id)?.name ?? 'Unknown',
        sku: parts?.find((p) => p.id === i.part_id)?.sku ?? '',
        qty: i.qty,
        unit_cost: i.unit_cost
      }))
  }));

  return (
    <SuppliersClient
      initialSuppliers={populatedSuppliers}
      initialBills={populatedBills}
      parts={parts ?? []}
      canManage={canManagePartsCatalog(session.employee.role)}
    />
  );
}
