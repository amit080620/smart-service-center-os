// getSessionContext() — the Next.js equivalent of the old authMiddleware.
// Called at the top of every protected API route (app/api/*) and every
// protected Server Component page. Verifies the Supabase Auth session from
// cookies, then looks up the employee/org/branch context for that user.
//
// Returns null if there's no valid session or no active employee record —
// callers are responsible for redirecting/responding with 401 in that case
// (kept as a plain return rather than throwing, since a "not logged in"
// state is an expected, ordinary outcome, not an exceptional one).
import { createSupabaseServerClient } from '@smartbizos/database/server';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import type { SessionContext } from '@smartbizos/database';

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Employee lookup uses the admin client (bypasses RLS) since we're about
  // to manually verify org_id scoping ourselves in every route that uses
  // this — same pattern as the previous build's service_role usage.
  const admin = createSupabaseAdminClient();

  const { data: employee, error: employeeError } = await admin
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .eq('status', 'active')
    .maybeSingle();

  if (employeeError || !employee) {
    return null;
  }

  // org and branch lookups are independent of each other (both only need
  // employee's ids, not each other's results) — running them in parallel
  // instead of sequentially removes one full network round trip from
  // EVERY protected page load, since this function runs at the top of
  // every one of them.
  const [{ data: org }, { data: branch }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', employee.org_id).is('deleted_at', null).maybeSingle(),
    admin.from('branches').select('*').eq('id', employee.branch_id).is('deleted_at', null).maybeSingle()
  ]);

  if (!org || !branch) {
    return null;
  }

  return { employee: employee as any, org: org as any, branch: branch as any };
}

// Separate from getSessionContext() on purpose — platform admin status
// (Amit's "Super Admin" access across every org on the platform) has
// nothing to do with being an employee of any particular org. Checked
// against a dedicated platform_admins table keyed by the raw Supabase
// Auth user id, so it works independently of — and is far more
// restricted than — the normal org-scoped employee/role system.
export async function getPlatformAdminContext(): Promise<{ id: string; email: string; fullName: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: platformAdmin } = await admin.from('platform_admins').select('*').eq('user_id', user.id).maybeSingle();

  if (!platformAdmin) {
    return null;
  }

  return { id: platformAdmin.id, email: platformAdmin.email, fullName: platformAdmin.full_name };
}

// Just checks "is anyone logged in at all" — used by platform-admin
// pages to tell apart two very different situations: no session (send
// to /login normally) vs a session that exists but isn't a platform
// admin (show a clear "wrong account" message instead of silently
// redirecting to /login, which the middleware would otherwise bounce
// straight to /dashboard for whoever IS logged in — very confusing on
// a device where the shop-owner account is already signed in).
export async function hasAnySession(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return Boolean(user);
}
