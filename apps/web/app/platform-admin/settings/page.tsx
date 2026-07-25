import { redirect } from 'next/navigation';
import { getPlatformAdminContext, hasAnySession } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import SettingsClient from './SettingsClient';
import PlatformAdminAccessDenied from '../PlatformAdminAccessDenied';

export default async function PlatformAdminSettingsPage() {
  const adminCtx = await getPlatformAdminContext();
  if (!adminCtx) {
    if (await hasAnySession()) {
      return <PlatformAdminAccessDenied />;
    }
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data: settings } = await admin.from('platform_settings').select('*').limit(1).maybeSingle();

  return (
    <SettingsClient
      initial={{
        bikeJobPrice: settings?.bike_job_price ?? 5,
        carJobPrice: settings?.car_job_price ?? 10,
        lowBalanceThreshold: settings?.low_balance_threshold ?? 20,
        blockThreshold: settings?.block_threshold ?? -50,
        supportPhone: settings?.support_phone ?? ''
      }}
    />
  );
}
