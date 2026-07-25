import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { updatePartSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to edit the parts catalog.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('parts')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Part not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updatePartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  if (parsed.data.sku !== undefined) {
    const { data: dupe } = await admin
      .from('parts')
      .select('id')
      .eq('org_id', session.employee.org_id)
      .eq('sku', parsed.data.sku)
      .neq('id', id)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json({ error: { code: 'DUPLICATE_SKU', message: 'Another part already uses this SKU.' } }, { status: 409 });
    }
  }

  if (parsed.data.supplierId) {
    const { data: supplier } = await admin
      .from('suppliers')
      .select('id')
      .eq('id', parsed.data.supplierId)
      .eq('org_id', session.employee.org_id)
      .maybeSingle();
    if (!supplier) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Supplier not found in your organization.' } }, { status: 404 });
    }
  }

  const { data: updated, error } = await admin
    .from('parts')
    .update({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.sku !== undefined && { sku: parsed.data.sku }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      ...(parsed.data.supplierId !== undefined && { supplier_id: parsed.data.supplierId }),
      ...(parsed.data.unitCost !== undefined && { unit_cost: parsed.data.unitCost }),
      ...(parsed.data.discountPercent !== undefined && { discount_percent: parsed.data.discountPercent }),
      ...(parsed.data.isActive !== undefined && { is_active: parsed.data.isActive }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update part.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// Soft delete only — same reasoning as services: a part already used on
// past job cards can't be hard-deleted without corrupting that history.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to delete from the parts catalog.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('parts')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Part not found in your organization.' } }, { status: 404 });
  }

  const { error } = await admin.from('parts').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
