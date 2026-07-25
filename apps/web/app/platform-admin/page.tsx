import { redirect } from 'next/navigation';
import { getPlatformAdminContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import PlatformAdminClient from './PlatformAdminClient';

// Cross-org Super Admin dashboard — completely separate from the normal
// org-scoped (dashboard) route group and its role system. Access is
// checked against the platform_admins table (see getPlatformAdminContext),
// not any employee/org role, since this view can see and act on every
// customer's org.
export default async function PlatformAdminPage() {
  const adminCtx = await getPlatformAdminContext();
  if (!adminCtx) {
    redirect('/login');
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
    const status: 'active' | 'low' | 'blocked' = balance <= blockThreshold ? 'blocked' : balance <= lowThreshold ? 'low' : 'active';
    return {
      id: o.id,
      name: o.name,
      contact_phone: o.contact_phone,
      created_at: o.created_at,
      balance,
      status
    };
  });

  return <PlatformAdminClient orgs={populated} adminName={adminCtx.fullName || adminCtx.email} />;
}
