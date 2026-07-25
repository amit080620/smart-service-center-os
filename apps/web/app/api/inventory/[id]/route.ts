import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManagePartsCatalog } from '@smartbizos/permissions';
import { z } from 'zod';

const updateReorderLevelSchema = z.object({
  reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative.')
});

// Editing the reorder-level threshold is deliberately separate from the
// /adjust endpoint — that one records an audited stock transaction
// (received/sold/adjusted with a qty delta); this one just changes a
// setting on the inventory row itself and shouldn't create a phantom
// transaction log entry for "reorder level changed."
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: inventoryId } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to edit inventory settings.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('inventory')
    .select('id')
    .eq('id', inventoryId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Inventory record not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateReorderLevelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('inventory')
    .update({ reorder_level: parsed.data.reorderLevel, updated_at: new Date().toISOString() })
    .eq('id', inventoryId)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update reorder level.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
