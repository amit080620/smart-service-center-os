import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageEmployees } from '@smartbizos/permissions';

// Same temp-password generation the initial employee creation uses —
// there's no transactional email set up to send a real reset link, so
// this generates a new one-time password the admin shares directly with
// the employee, exactly like account creation already does.
function generateTempPassword(): string {
  const words = ['swift', 'amber', 'tiger', 'delta', 'coral', 'brisk', 'nova', 'quartz'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${word}-${num}-${suffix}`;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id: employeeId } = await params;

  if (!canManageEmployees(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to reset passwords.' } },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from('employees')
    .select('id, user_id, role')
    .eq('id', employeeId)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Employee not found in your organization.' } }, { status: 404 });
  }
  if (target.role === 'org_owner') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'The organization owner\u2019s password cannot be reset here.' } },
      { status: 403 }
    );
  }

  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: tempPassword });

  if (error) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ tempPassword });
}
