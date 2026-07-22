import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { customerSchema } from '@smartbizos/validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();

  // Verify the customer belongs to the caller's org BEFORE updating —
  // never trust that a client-supplied id is safe to act on.
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Customer not found in your organization.' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = customerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('customers')
    .update({
      ...(parsed.data.firstName !== undefined && { first_name: parsed.data.firstName }),
      ...(parsed.data.lastName !== undefined && { last_name: parsed.data.lastName }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      ...(parsed.data.whatsappOptIn !== undefined && { whatsapp_opt_in: parsed.data.whatsappOptIn }),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update customer.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}