import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: wallet }, { data: settings }] = await Promise.all([
    admin.from('org_wallets').select('*').eq('org_id', session.employee.org_id).maybeSingle(),
    admin.from('platform_settings').select('*').limit(1).maybeSingle()
  ]);

  const balance = wallet?.balance ?? 0;
  const lowThreshold = settings?.low_balance_threshold ?? 20;
  const blockThreshold = settings?.block_threshold ?? -50;

  return NextResponse.json({
    balance,
    isLow: balance <= lowThreshold,
    isBlocked: balance <= blockThreshold,
    supportPhone: settings?.support_phone ?? ''
  });
}
