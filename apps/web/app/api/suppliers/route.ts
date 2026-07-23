import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { supplierSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: suppliers, error } = await admin
    .from('suppliers')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!suppliers || suppliers.length === 0) {
    return NextResponse.json([]);
  }

  // Populate each supplier with their total outstanding balance across
  // all bills — the number people actually want to see at a glance
  // without opening each supplier individually.
  const supplierIds = suppliers.map((s) => s.id);
  const { data: bills } = await admin.from('supplier_bills').select('supplier_id, balance_due').in('supplier_id', supplierIds);

  const populated = suppliers.map((s) => ({
    ...s,
    total_pending: (bills ?? []).filter((b) => b.supplier_id === s.id).reduce((sum, b) => sum + b.balance_due, 0)
  }));

  return NextResponse.json(populated);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to manage suppliers.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: supplier, error } = await admin
    .from('suppliers')
    .insert({
      org_id: session.employee.org_id,
      name: parsed.data.name,
      contact_phone: parsed.data.contactPhone,
      contact_email: parsed.data.contactEmail,
      address: parsed.data.address,
      notes: parsed.data.notes
    })
    .select()
    .single();

  if (error || !supplier) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create supplier.' } }, { status: 500 });
  }

  return NextResponse.json(supplier, { status: 201 });
}
