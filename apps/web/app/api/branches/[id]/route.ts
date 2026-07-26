import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { updateBranchSchema } from '@smartbizos/validation';
import { canManageOrgSettings } from '@smartbizos/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  if (!canManageOrgSettings(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only the org owner can edit branches.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('branches')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Branch not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('branches')
    .update({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update branch.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
