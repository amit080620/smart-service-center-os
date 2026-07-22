import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { adjustInventorySchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: inventoryId } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to adjust inventory.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Org-scope check BEFORE acting on the client-supplied id.
  const { data: inventoryRow } = await admin
    .from('inventory')
    .select('*')
    .eq('id', inventoryId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!inventoryRow) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Inventory record not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = adjustInventorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const newQty = inventoryRow.qty_on_hand + parsed.data.qty;
  if (newQty < 0) {
    return NextResponse.json(
      {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot remove ${Math.abs(parsed.data.qty)} — only ${inventoryRow.qty_on_hand} on hand.`
        }
      },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await admin
    .from('inventory')
    .update({ qty_on_hand: newQty, updated_at: new Date().toISOString() })
    .eq('id', inventoryId)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: updateError?.message ?? 'Could not adjust inventory.' } },
      { status: 500 }
    );
  }

  await admin.from('inventory_transactions').insert({
    inventory_id: inventoryId,
    type: parsed.data.type,
    qty: parsed.data.qty,
    performed_by: session.employee.id,
    notes: parsed.data.notes
  });

  return NextResponse.json(updated);
}
