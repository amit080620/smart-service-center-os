import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const { branchId } = await req.json();

  const admin = createSupabaseAdminClient();
  const { data: branch } = await admin
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!branch) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Branch not found in your organization.' } }, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('active_branch_id', branchId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return res;
}
