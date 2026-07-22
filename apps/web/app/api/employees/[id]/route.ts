import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { updateEmployeeSchema } from '@smartbizos/validation';
import { canManageEmployees, canDeactivateEmployees } from '@smartbizos/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: employeeId } = await params;

  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Employee not found in your organization.' } }, { status: 404 });
  }

  // The org owner (created at signup) can't be edited or deactivated
  // through this endpoint — there must always be exactly one, and
  // demoting/deactivating them here would be an easy way to accidentally
  // lock everyone out of the org.
  if (target.role === 'org_owner') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'The organization owner cannot be edited here.' } }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  if (parsed.data.role !== undefined && !canManageEmployees(session.employee.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to change roles.' } }, { status: 403 });
  }
  if (parsed.data.status !== undefined && !canDeactivateEmployees(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to activate/deactivate employees.' } },
      { status: 403 }
    );
  }

  const { data: updated, error } = await admin
    .from('employees')
    .update({
      ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update employee.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
