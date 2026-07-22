import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invoices, error } = await admin
    .from('invoices')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }
  if (!invoices || invoices.length === 0) {
    return NextResponse.json([]);
  }

  // Populate job number + customer name for the list view.
  const jobIds = [...new Set(invoices.map((i) => i.job_id))];
  const { data: jobs } = await admin.from('job_cards').select('id, job_number, customer_id').in('id', jobIds);
  const customerIds = [...new Set((jobs ?? []).map((j) => j.customer_id))];
  const { data: customers } = customerIds.length
    ? await admin.from('customers').select('id, first_name, last_name').in('id', customerIds)
    : { data: [] };

  const populated = invoices.map((inv) => {
    const job = jobs?.find((j) => j.id === inv.job_id);
    const customer = job ? customers?.find((c) => c.id === job.customer_id) : null;
    return {
      ...inv,
      job_number: job?.job_number ?? 'Unknown',
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown'
    };
  });

  return NextResponse.json(populated);
}
