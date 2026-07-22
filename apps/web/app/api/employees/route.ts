import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { createEmployeeSchema } from '@smartbizos/validation';
import { canManageEmployees } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: employees, error } = await admin
    .from('employees')
    .select('id, full_name, email, phone, role, status, hire_date, created_at')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(employees ?? []);
}

// Generates a readable-but-random temporary password (e.g. "swift-42-tiger")
// shown once to the admin after creation, since there's no transactional
// email sending set up yet to deliver a proper invite link. The admin is
// expected to share this with the new employee directly (WhatsApp, in
// person) — same informal handoff pattern small teams already use.
function generateTempPassword(): string {
  const words = ['swift', 'amber', 'tiger', 'delta', 'coral', 'brisk', 'nova', 'quartz'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${word}-${num}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  if (!canManageEmployees(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to add employees.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin.from('employees').select('id').eq('email', parsed.data.email).is('deleted_at', null).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'An employee with this email already exists.' } }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  let authUserId: string | null = null;

  try {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword,
      email_confirm: true
    });
    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: authError?.message ?? 'Could not create the login account.' } },
        { status: 409 }
      );
    }
    authUserId = authUser.user.id;

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .insert({
        org_id: session.employee.org_id,
        branch_id: session.employee.branch_id,
        user_id: authUserId,
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        phone: parsed.data.phone,
        email: parsed.data.email,
        hire_date: parsed.data.hireDate || new Date().toISOString().slice(0, 10),
        monthly_salary: parsed.data.monthlySalary ?? null,
        hourly_rate: parsed.data.hourlyRate ?? null,
        status: 'active'
      })
      .select()
      .single();

    if (employeeError || !employee) {
      // Roll back the orphaned auth user if the employee record failed —
      // same pattern signup uses.
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: employeeError?.message ?? 'Could not create employee record.' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ employee, tempPassword }, { status: 201 });
  } catch (err) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Something went wrong.' } },
      { status: 500 }
    );
  }
}
