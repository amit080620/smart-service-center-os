import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { recordSupplierPaymentSchema } from '@smartbizos/validation';
import { canManagePartsCatalog } from '@smartbizos/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: billId } = await params;

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to record supplier payments.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: bill } = await admin
    .from('supplier_bills')
    .select('*')
    .eq('id', billId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!bill) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Bill not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = recordSupplierPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  if (parsed.data.amount > bill.balance_due) {
    return NextResponse.json(
      { error: { code: 'OVERPAYMENT', message: `Amount exceeds the balance due (\u20b9${bill.balance_due}).` } },
      { status: 400 }
    );
  }

  const { error: paymentError } = await admin.from('supplier_payments').insert({
    bill_id: billId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    recorded_by: session.employee.id
  });
  if (paymentError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: paymentError.message } }, { status: 500 });
  }

  const newAmountPaid = bill.amount_paid + parsed.data.amount;
  const newBalanceDue = bill.amount - newAmountPaid;

  const { data: updated, error: updateError } = await admin
    .from('supplier_bills')
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newBalanceDue <= 0 ? 'paid' : 'unpaid',
      updated_at: new Date().toISOString()
    })
    .eq('id', billId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, bill: updated });
}
