import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { branchSchema } from '@smartbizos/validation';
import { canManageOrgSettings } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: branches } = await admin
    .from('branches')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  return NextResponse.json(branches ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  if (!canManageOrgSettings(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only the org owner can add branches.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = branchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: branch, error } = await admin
    .from('branches')
    .insert({
      org_id: session.employee.org_id,
      name: parsed.data.name,
      address: parsed.data.address,
      phone: parsed.data.phone,
      status: 'active'
    })
    .select()
    .single();

  if (error || !branch) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create branch.' } }, { status: 500 });
  }

  return NextResponse.json(branch, { status: 201 });
}
