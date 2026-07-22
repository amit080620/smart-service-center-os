import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { customerSchema } from '@smartbizos/validation';

export async function GET(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get('search');
  const admin = createSupabaseAdminClient();

  let query = admin.from('customers').select('*').eq('org_id', session.employee.org_id).is('deleted_at', null);

  const { data: customers, error } = await query;
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  let results = customers ?? [];
  if (search) {
    const term = search.toLowerCase();
    results = results.filter(
      (c) =>
        c.first_name.toLowerCase().includes(term) ||
        c.last_name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.email ?? '').toLowerCase().includes(term)
    );
  }

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const body = await req.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Duplicate check scoped to this org only — two different garages having
  // a customer with the same phone number is not a conflict.
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('org_id', session.employee.org_id)
    .eq('phone', parsed.data.phone)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: 'DUPLICATE_PHONE', message: 'A customer with this phone number already exists.' } },
      { status: 409 }
    );
  }

  const { data: customer, error } = await admin
    .from('customers')
    .insert({
      // org_id always comes from the verified session, never client input.
      org_id: session.employee.org_id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email || '',
      address: parsed.data.address,
      whatsapp_opt_in: parsed.data.whatsappOptIn
    })
    .select()
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not create customer.' } }, { status: 500 });
  }

  return NextResponse.json(customer, { status: 201 });
}