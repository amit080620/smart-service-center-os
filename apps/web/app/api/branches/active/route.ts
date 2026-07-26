import { NextResponse } from 'next/server';
import { getSessionContext, getActiveBranchId } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: branches } = await admin
    .from('branches')
    .select('id, name')
    .eq('org_id', session.employee.org_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at');

  const activeBranchId = await getActiveBranchId(session.employee.org_id, session.employee.branch_id);

  return NextResponse.json({ branches: branches ?? [], activeBranchId });
}
