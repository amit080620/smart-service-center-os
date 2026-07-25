import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageOrgSettings } from '@smartbizos/permissions';
import PlatformBillingClient from './PlatformBillingClient';

// Renamed in spirit from the old flat-fee daily-billing view to this
// org's own Wallet — same nav slot, but now shows the live prepaid
// balance and transaction history (debits per job card, credits from
// recharges) instead of aggregated daily bills.
export default async function WalletPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const canManage = canManageOrgSettings(session.employee.role);
  if (!canManage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center text-slate-500 text-sm mt-12">
          Only the org owner can view wallet details.
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: wallet }, { data: transactions }, { data: settings }] = await Promise.all([
    admin.from('org_wallets').select('*').eq('org_id', session.employee.org_id).maybeSingle(),
    admin
      .from('wallet_transactions')
      .select('*')
      .eq('org_id', session.employee.org_id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('platform_settings').select('*').limit(1).maybeSingle()
  ]);

  return (
    <PlatformBillingClient
      balance={wallet?.balance ?? 0}
      transactions={transactions ?? []}
      lowThreshold={settings?.low_balance_threshold ?? 20}
      blockThreshold={settings?.block_threshold ?? -50}
      bikePrice={settings?.bike_job_price ?? 5}
      carPrice={settings?.car_job_price ?? 10}
      supportPhone={settings?.support_phone ?? ''}
    />
  );
}
