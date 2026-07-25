import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { partSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: parts, error } = await admin
    .from('parts')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!parts || parts.length === 0) {
    return NextResponse.json([]);
  }

  // Populate supplier name alongside the id — the "vendor" people
  // actually want to see, not just a raw uuid.
  const supplierIds = [...new Set(parts.map((p) => p.supplier_id).filter((id): id is string => Boolean(id)))];
  const { data: suppliers } = supplierIds.length
    ? await admin.from('suppliers').select('id, name').in('id', supplierIds)
    : { data: [] };

  const populated = parts.map((p) => ({
    ...p,
    supplier_name: suppliers?.find((s) => s.id === p.supplier_id)?.name ?? null
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
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to manage the parts catalog.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = partSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Duplicate SKU check, scoped to this org.
  const { data: existing } = await admin
    .from('parts')
    .select('id')
    .eq('org_id', session.employee.org_id)
    .eq('sku', parsed.data.sku)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: 'DUPLICATE_SKU', message: 'A part with this SKU already exists.' } },
      { status: 409 }
    );
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

  const { data: part, error } = await admin
    .from('parts')
    .insert({
      org_id: session.employee.org_id,
      name: parsed.data.name,
      sku: parsed.data.sku,
      description: parsed.data.description,
      category: parsed.data.category,
      supplier_id: parsed.data.supplierId ?? null,
      unit_cost: parsed.data.unitCost,
      discount_percent: parsed.data.discountPercent,
      is_active: true
    })
    .select()
    .single();

  if (error || !part) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create part.' } }, { status: 500 });
  }

  return NextResponse.json(part, { status: 201 });
}
