import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { recordPaymentSchema } from '@smartbizos/validation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: invoiceId } = await params;

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  if (parsed.data.amount > invoice.balance_due) {
    return NextResponse.json(
      { error: { code: 'OVERPAYMENT', message: `Amount exceeds the balance due (₹${invoice.balance_due}).` } },
      { status: 400 }
    );
  }

  const { error: paymentError } = await admin.from('payments').insert({
    invoice_id: invoiceId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    recorded_by: session.employee.id
  });
  if (paymentError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: paymentError.message } }, { status: 500 });
  }

  const newAmountPaid = invoice.amount_paid + parsed.data.amount;
  const newBalanceDue = invoice.total - newAmountPaid;

  const { data: updatedInvoice, error: updateError } = await admin
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newBalanceDue <= 0 ? 'paid' : 'sent',
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  // Reflect the payment status back on the job card too, so the job list
  // and detail view both know whether the customer has actually paid.
  if (newBalanceDue <= 0) {
    await admin
      .from('job_cards')
      .update({ paid: true, payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', invoice.job_id);
  } else if (newAmountPaid > 0) {
    await admin.from('job_cards').update({ payment_status: 'partial', updated_at: new Date().toISOString() }).eq('id', invoice.job_id);
  }

  return NextResponse.json({ success: true, invoice: updatedInvoice });
}
