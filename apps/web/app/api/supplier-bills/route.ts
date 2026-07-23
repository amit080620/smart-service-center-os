import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { supplierBillSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: bills, error } = await admin
    .from('supplier_bills')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('bill_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!bills || bills.length === 0) {
    return NextResponse.json([]);
  }

  const supplierIds = [...new Set(bills.map((b) => b.supplier_id))];
  const { data: suppliers } = await admin.from('suppliers').select('id, name').in('id', supplierIds);

  const populated = bills.map((b) => ({
    ...b,
    supplier_name: suppliers?.find((s) => s.id === b.supplier_id)?.name ?? 'Unknown'
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
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to record supplier bills.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = supplierBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: supplier } = await admin
    .from('suppliers')
    .select('id')
    .eq('id', parsed.data.supplierId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();
  if (!supplier) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Supplier not found in your organization.' } }, { status: 404 });
  }

  const { data: bill, error } = await admin
    .from('supplier_bills')
    .insert({
      org_id: session.employee.org_id,
      supplier_id: parsed.data.supplierId,
      bill_number: parsed.data.billNumber,
      amount: parsed.data.amount,
      amount_paid: 0,
      balance_due: parsed.data.amount,
      status: 'unpaid',
      bill_date: parsed.data.billDate || new Date().toISOString().slice(0, 10),
      notes: parsed.data.notes,
      created_by: session.employee.id
    })
    .select()
    .single();

  if (error || !bill) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not record bill.' } }, { status: 500 });
  }

  return NextResponse.json(bill, { status: 201 });
}
