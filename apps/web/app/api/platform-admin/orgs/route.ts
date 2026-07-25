import { NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function GET() {
  const admin_ctx = await getPlatformAdminContext();
  if (!admin_ctx) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: orgs }, { data: wallets }, { data: settings }] = await Promise.all([
    admin.from('organizations').select('id, name, contact_phone, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('org_wallets').select('*'),
    admin.from('platform_settings').select('*').limit(1).maybeSingle()
  ]);

  const blockThreshold = settings?.block_threshold ?? -50;
  const lowThreshold = settings?.low_balance_threshold ?? 20;

  const populated = (orgs ?? []).map((o) => {
    const wallet = wallets?.find((w) => w.org_id === o.id);
    const balance = wallet?.balance ?? 0;
    return {
      id: o.id,
      name: o.name,
      contact_phone: o.contact_phone,
      created_at: o.created_at,
      balance,
      status: balance <= blockThreshold ? 'blocked' : balance <= lowThreshold ? 'low' : 'active'
    };
  });

  return NextResponse.json(populated);
}
