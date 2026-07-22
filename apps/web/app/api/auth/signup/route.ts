import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { signupSchema } from '@smartbizos/validation';
import { ROLES, ORG_STATUS, ORG_PLAN, TRIAL_PERIOD_DAYS, DEFAULT_MAX_BRANCHES, DEFAULT_MAX_EMPLOYEES } from '@smartbizos/constants';

export async function POST(req: NextRequest) {
  let authUserId: string | null = null;

  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
        { status: 400 }
      );
    }
    const { orgName, ownerFullName, email, password, contactPhone } = parsed.data;

    const admin = createSupabaseAdminClient();

    const { data: existingEmployee } = await admin
      .from('employees')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingEmployee) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'An account with this email already exists. Try logging in instead.' } },
        { status: 409 }
      );
    }

    // Create the real Supabase Auth user first. If anything after this
    // fails, we roll it back (see catch block) so the email can be tried
    // again cleanly rather than being stuck on an orphaned auth account.
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authUser?.user) {
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_ERROR',
            message: authError?.message ?? 'Could not create the account. The email may already be in use.'
          }
        },
        { status: 409 }
      );
    }
    authUserId = authUser.user.id;

    const slug =
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    const now = new Date();
    const trialEnds = new Date(now.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        business_type: 'Vehicle Service Center',
        status: ORG_STATUS.TRIAL,
        contact_email: email,
        contact_phone: contactPhone ?? '',
        address: '',
        logo_url: null,
        plan: ORG_PLAN.TRIAL,
        trial_ends_at: trialEnds.toISOString(),
        max_branches: DEFAULT_MAX_BRANCHES,
        max_employees: DEFAULT_MAX_EMPLOYEES,
        settings: {
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          whatsapp_enabled: false
        }
      })
      .select()
      .single();
    if (orgError || !org) throw new Error(orgError?.message ?? 'Failed to create organization.');

    const { data: branch, error: branchError } = await admin
      .from('branches')
      .insert({
        org_id: org.id,
        name: 'Main Branch',
        address: '',
        phone: contactPhone ?? '',
        manager_id: null,
        status: 'active'
      })
      .select()
      .single();
    if (branchError || !branch) throw new Error(branchError?.message ?? 'Failed to create branch.');

    const { data: owner, error: ownerError } = await admin
      .from('employees')
      .insert({
        org_id: org.id,
        branch_id: branch.id,
        user_id: authUserId,
        full_name: ownerFullName,
        role: ROLES.ORG_OWNER,
        phone: contactPhone ?? '',
        email,
        hire_date: now.toISOString().slice(0, 10),
        monthly_salary: null,
        hourly_rate: null,
        status: 'active'
      })
      .select()
      .single();
    if (ownerError || !owner) throw new Error(ownerError?.message ?? 'Failed to create employee record.');

    return NextResponse.json({ employee: owner, org, branch }, { status: 201 });
  } catch (err) {
    // Roll back the auth user so this email can be tried again cleanly.
    if (authUserId) {
      const admin = createSupabaseAdminClient();
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    console.error('[signup] Failed, rolled back:', err);
    return NextResponse.json(
      { error: { code: 'SIGNUP_FAILED', message: 'Could not complete signup. Please try again.' } },
      { status: 500 }
    );
  }
}
