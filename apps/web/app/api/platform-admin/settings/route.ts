import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { z } from 'zod';

const settingsSchema = z.object({
  bikeJobPrice: z.number().min(0),
  carJobPrice: z.number().min(0),
  lowBalanceThreshold: z.number(),
  blockThreshold: z.number(),
  supportPhone: z.string().trim()
});

export async function GET() {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: settings } = await admin.from('platform_settings').select('*').limit(1).maybeSingle();

  return NextResponse.json(
    settings ?? {
      bike_job_price: 5,
      car_job_price: 10,
      low_balance_threshold: 20,
      block_threshold: -50,
      support_phone: ''
    }
  );
}

export async function POST(req: NextRequest) {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from('platform_settings').select('id').limit(1).maybeSingle();

  const payload = {
    bike_job_price: parsed.data.bikeJobPrice,
    car_job_price: parsed.data.carJobPrice,
    low_balance_threshold: parsed.data.lowBalanceThreshold,
    block_threshold: parsed.data.blockThreshold,
    support_phone: parsed.data.supportPhone,
    updated_at: new Date().toISOString()
  };

  const { data: updated, error } = existing
    ? await admin.from('platform_settings').update(payload).eq('id', existing.id).select().single()
    : await admin.from('platform_settings').insert(payload).select().single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not save settings.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
