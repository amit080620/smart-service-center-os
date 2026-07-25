import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { updateServiceSchema } from '@smartbizos/validation';
import { canManageServicesCatalog } from '@smartbizos/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManageServicesCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to edit the services catalog.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('services')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Service not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('services')
    .update({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.baseCost !== undefined && { base_cost: parsed.data.baseCost }),
      ...(parsed.data.discountPercent !== undefined && { discount_percent: parsed.data.discountPercent }),
      ...(parsed.data.estDurationMinutes !== undefined && { est_duration_minutes: parsed.data.estDurationMinutes }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      ...(parsed.data.isActive !== undefined && { is_active: parsed.data.isActive }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update service.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// Soft delete only — a service already referenced by past job cards'
// line items can't be hard-deleted without breaking that history.
// Deactivating removes it from the "add service" picker going forward
// while keeping every past invoice/job record intact and accurate.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManageServicesCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to delete from the services catalog.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('services')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Service not found in your organization.' } }, { status: 404 });
  }

  const { error } = await admin.from('services').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
