import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { addToInventorySchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: inventory, error } = await admin
    .from('inventory')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .eq('branch_id', session.employee.branch_id);

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!inventory || inventory.length === 0) {
    return NextResponse.json([]);
  }

  // Join part details (name, SKU) — inventory rows only store the id.
  const partIds = inventory.map((i) => i.part_id);
  const { data: parts } = await admin.from('parts').select('id, name, sku').in('id', partIds);

  const populated = inventory
    .map((i) => {
      const part = parts?.find((p) => p.id === i.part_id);
      return {
        ...i,
        part_name: part?.name ?? 'Unknown',
        sku: part?.sku ?? '',
        low_stock: i.qty_on_hand <= i.reorder_level
      };
    })
    .sort((a, b) => a.part_name.localeCompare(b.part_name));

  return NextResponse.json(populated);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to manage inventory.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = addToInventorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Verify the part belongs to this org.
  const { data: part } = await admin
    .from('parts')
    .select('id')
    .eq('id', parsed.data.partId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!part) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Part not found in your organization.' } }, { status: 404 });
  }

  // A part can only be tracked once per branch — check for an existing
  // inventory row before creating a duplicate.
  const { data: existing } = await admin
    .from('inventory')
    .select('id')
    .eq('org_id', session.employee.org_id)
    .eq('branch_id', session.employee.branch_id)
    .eq('part_id', parsed.data.partId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: { code: 'ALREADY_TRACKED', message: 'This part is already tracked in inventory for your branch.' } },
      { status: 409 }
    );
  }

  const { data: inventoryRow, error: insertError } = await admin
    .from('inventory')
    .insert({
      org_id: session.employee.org_id,
      branch_id: session.employee.branch_id,
      part_id: parsed.data.partId,
      qty_on_hand: parsed.data.qtyOnHand,
      reorder_level: parsed.data.reorderLevel
    })
    .select()
    .single();

  if (insertError || !inventoryRow) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: insertError?.message ?? 'Could not add to inventory.' } },
      { status: 500 }
    );
  }

  // Log the initial stock as a "received" transaction, so the history is
  // complete from the very first record, not just adjustments after.
  if (parsed.data.qtyOnHand > 0) {
    await admin.from('inventory_transactions').insert({
      inventory_id: inventoryRow.id,
      type: 'received',
      qty: parsed.data.qtyOnHand,
      performed_by: session.employee.id,
      notes: 'Initial stock'
    });
  }

  return NextResponse.json(inventoryRow, { status: 201 });
}
