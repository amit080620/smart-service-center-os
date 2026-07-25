import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { supplierSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to edit suppliers.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Supplier not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = supplierSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('suppliers')
    .update({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.contactPhone !== undefined && { contact_phone: parsed.data.contactPhone }),
      ...(parsed.data.contactEmail !== undefined && { contact_email: parsed.data.contactEmail }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update supplier.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
