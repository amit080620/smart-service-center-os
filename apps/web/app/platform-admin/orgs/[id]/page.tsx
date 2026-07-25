import { redirect, notFound } from 'next/navigation';
import { getPlatformAdminContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import OrgDetailClient from './OrgDetailClient';

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminCtx = await getPlatformAdminContext();
  if (!adminCtx) {
    redirect('/login');
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const [{ data: org }, { data: wallet }, { data: transactions }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', id).maybeSingle(),
    admin.from('org_wallets').select('*').eq('org_id', id).maybeSingle(),
    admin.from('wallet_transactions').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(100)
  ]);

  if (!org) {
    notFound();
  }

  return (
    <OrgDetailClient
      org={org}
      balance={wallet?.balance ?? 0}
      customBikePrice={wallet?.custom_bike_price ?? null}
      customCarPrice={wallet?.custom_car_price ?? null}
      transactions={transactions ?? []}
    />
  );
}
