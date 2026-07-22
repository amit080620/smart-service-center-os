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