import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import InventoryClient from './InventoryClient';

export default async function InventoryPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: inventory }, { data: parts }] = await Promise.all([
    admin
      .from('inventory')
      .select('*')
      .eq('org_id', session.employee.org_id)
      .eq('branch_id', session.employee.branch_id),
    admin.from('parts').select('id, name, sku').eq('org_id', session.employee.org_id).order('name')
  ]);

  const populated = (inventory ?? [])
    .map((i) => {
      const part = parts?.find((p) => p.id === i.part_id);
      return {
        id: i.id,
        part_id: i.part_id,
        qty_on_hand: i.qty_on_hand,
        reorder_level: i.reorder_level,
        part_name: part?.name ?? 'Unknown',
        sku: part?.sku ?? '',
        low_stock: i.qty_on_hand <= i.reorder_level
      };
    })
    .sort((a, b) => a.part_name.localeCompare(b.part_name));

  // Parts not yet tracked at this branch — offered in the "start tracking"
  // dropdown so the same part can't be added twice.
  const trackedPartIds = new Set((inventory ?? []).map((i) => i.part_id));
  const untrackedParts = (parts ?? []).filter((p) => !trackedPartIds.has(p.id));

  return <InventoryClient initialInventory={populated} untrackedParts={untrackedParts} />;
}
