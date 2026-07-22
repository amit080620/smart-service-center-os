import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { serviceSchema } from '@smartbizos/validation';
import { canManageServicesCatalog } from '@smartbizos/permissions';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: services, error } = await admin
    .from('services')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(services ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  // Services catalog management is restricted to management roles — see
  // packages/permissions for the exact rule.
  if (!canManageServicesCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to manage the services catalog.' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: service, error } = await admin
    .from('services')
    .insert({
      org_id: session.employee.org_id,
      name: parsed.data.name,
      description: parsed.data.description,
      base_cost: parsed.data.baseCost,
      est_duration_minutes: parsed.data.estDurationMinutes,
      category: parsed.data.category,
      is_active: true
    })
    .select()
    .single();

  if (error || !service) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create service.' } }, { status: 500 });
  }

  return NextResponse.json(service, { status: 201 });
}