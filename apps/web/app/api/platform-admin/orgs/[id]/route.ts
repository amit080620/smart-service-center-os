import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { z } from 'zod';

const rechargeSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than zero.'),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'other']),
  notes: z.string().trim().optional().default('')
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const [{ data: org }, { data: wallet }, { data: transactions }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', id).maybeSingle(),
    admin.from('org_wallets').select('*').eq('org_id', id).maybeSingle(),
    admin.from('wallet_transactions').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(100)
  ]);

  if (!org) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Organization not found.' } }, { status: 404 });
  }

  return NextResponse.json({
    org,
    balance: wallet?.balance ?? 0,
    customBikePrice: wallet?.custom_bike_price ?? null,
    customCarPrice: wallet?.custom_car_price ?? null,
    transactions: transactions ?? []
  });
}

// Manual recharge — Amit receives payment outside the app (cash/UPI
// directly), then credits it here. Always logged as a proper
// transaction (amount, method, notes, timestamp, who did it) — not just
// a silent balance bump — so there's a real record if a client ever
// disputes what they paid and when.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = rechargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from('organizations').select('id').eq('id', id).maybeSingle();
  if (!org) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Organization not found.' } }, { status: 404 });
  }

  const { data: wallet } = await admin.from('org_wallets').select('balance').eq('org_id', id).maybeSingle();
  const currentBalance = wallet?.balance ?? 0;
  const newBalance = currentBalance + parsed.data.amount;

  if (wallet) {
    await admin.from('org_wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('org_id', id);
  } else {
    await admin.from('org_wallets').insert({ org_id: id, balance: newBalance });
  }

  const methodLabel = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer', other: 'Other' }[parsed.data.method];
  await admin.from('wallet_transactions').insert({
    org_id: id,
    type: 'credit',
    amount: parsed.data.amount,
    reason: `Recharge via ${methodLabel}${parsed.data.notes ? ` — ${parsed.data.notes}` : ''}`,
    balance_after: newBalance,
    created_by: admin_ctx.id
  });

  return NextResponse.json({ success: true, newBalance });
}

const customPricingSchema = z.object({
  customBikePrice: z.number().min(0).nullable(),
  customCarPrice: z.number().min(0).nullable()
});

// Sets (or clears, by passing null) a negotiated per-org rate — e.g. a
// long-term customer who agreed a lower price than the platform
// default. Null means "no override, fall back to the global rate."
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = customPricingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from('org_wallets').select('org_id').eq('org_id', id).maybeSingle();

  const payload = {
    custom_bike_price: parsed.data.customBikePrice,
    custom_car_price: parsed.data.customCarPrice,
    updated_at: new Date().toISOString()
  };

  const { error } = existing
    ? await admin.from('org_wallets').update(payload).eq('org_id', id)
    : await admin.from('org_wallets').insert({ org_id: id, balance: 0, ...payload });

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
