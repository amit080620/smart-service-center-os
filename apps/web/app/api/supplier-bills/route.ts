import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext, getActiveBranchId } from '@smartbizos/auth';
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
  const billIds = bills.map((b) => b.id);
  const [{ data: suppliers }, { data: items }] = await Promise.all([
    admin.from('suppliers').select('id, name').in('id', supplierIds),
    admin.from('supplier_bill_items').select('*').in('bill_id', billIds)
  ]);

  const partIds = [...new Set((items ?? []).map((i) => i.part_id))];
  const { data: parts } = partIds.length ? await admin.from('parts').select('id, name, sku').in('id', partIds) : { data: [] };

  const populated = bills.map((b) => ({
    ...b,
    supplier_name: suppliers?.find((s) => s.id === b.supplier_id)?.name ?? 'Unknown',
    items: (items ?? [])
      .filter((i) => i.bill_id === b.id)
      .map((i) => ({
        id: i.id,
        part_id: i.part_id,
        part_name: parts?.find((p) => p.id === i.part_id)?.name ?? 'Unknown',
        sku: parts?.find((p) => p.id === i.part_id)?.sku ?? '',
        qty: i.qty,
        unit_cost: i.unit_cost
      }))
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

  // Verify every part in the bill actually belongs to this org before
  // creating anything — one bad id shouldn't leave a half-created bill.
  const partIds = [...new Set(parsed.data.items.map((i) => i.partId))];
  const { data: validParts } = await admin.from('parts').select('id').eq('org_id', session.employee.org_id).in('id', partIds);
  const validPartIds = new Set((validParts ?? []).map((p) => p.id));
  const invalidPart = parsed.data.items.find((i) => !validPartIds.has(i.partId));
  if (invalidPart) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'One or more parts were not found in your organization.' } }, { status: 404 });
  }

  const totalAmount = parsed.data.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);

  const { data: bill, error: billError } = await admin
    .from('supplier_bills')
    .insert({
      org_id: session.employee.org_id,
      supplier_id: parsed.data.supplierId,
      bill_number: parsed.data.billNumber,
      amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      status: 'unpaid',
      bill_date: parsed.data.billDate || new Date().toISOString().slice(0, 10),
      notes: parsed.data.notes,
      created_by: session.employee.id
    })
    .select()
    .single();

  if (billError || !bill) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: billError?.message ?? 'Could not record bill.' } }, { status: 500 });
  }

  await admin.from('supplier_bill_items').insert(
    parsed.data.items.map((i) => ({
      bill_id: bill.id,
      part_id: i.partId,
      qty: i.qty,
      unit_cost: i.unitCost
    }))
  );

  // The whole point of recording a supplier bill — receiving stock —
  // updates Inventory automatically for the branch of whoever is
  // recording it, exactly as if each item had been added via the
  // Inventory page's "Record New Bill"... except now it's one flow
  // instead of two separate ones. Each line becomes a 'received'
  // transaction referencing this bill for traceability.
  const activeBranchId = await getActiveBranchId(session.employee.org_id, session.employee.branch_id);
  for (const item of parsed.data.items) {
    const { data: invRow } = await admin
      .from('inventory')
      .select('id, qty_on_hand')
      .eq('org_id', session.employee.org_id)
      .eq('branch_id', activeBranchId)
      .eq('part_id', item.partId)
      .maybeSingle();

    if (invRow) {
      await admin
        .from('inventory')
        .update({ qty_on_hand: invRow.qty_on_hand + item.qty, updated_at: new Date().toISOString() })
        .eq('id', invRow.id);
      await admin.from('inventory_transactions').insert({
        inventory_id: invRow.id,
        type: 'received',
        qty: item.qty,
        performed_by: session.employee.id,
        notes: `Supplier bill ${bill.bill_number || bill.id.slice(0, 8)}`
      });
    } else {
      const { data: newInv } = await admin
        .from('inventory')
        .insert({
          org_id: session.employee.org_id,
          branch_id: activeBranchId,
          part_id: item.partId,
          qty_on_hand: item.qty,
          reorder_level: 5
        })
        .select()
        .single();
      if (newInv) {
        await admin.from('inventory_transactions').insert({
          inventory_id: newInv.id,
          type: 'received',
          qty: item.qty,
          performed_by: session.employee.id,
          notes: `Supplier bill ${bill.bill_number || bill.id.slice(0, 8)} (started tracking)`
        });
      }
    }
  }

  return NextResponse.json(bill, { status: 201 });
}
