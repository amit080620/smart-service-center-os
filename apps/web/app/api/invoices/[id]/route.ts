import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found in your organization.' } }, { status: 404 });
  }

  const [{ data: job }, { data: payments }] = await Promise.all([
    admin.from('job_cards').select('*').eq('id', invoice.job_id).maybeSingle(),
    admin.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false })
  ]);

  let customer = null;
  let vehicle = null;
  let services: unknown[] = [];
  let parts: unknown[] = [];

  if (job) {
    const [{ data: customerData }, { data: vehicleData }, { data: jobServices }, { data: jobParts }] = await Promise.all([
      admin.from('customers').select('*').eq('id', job.customer_id).maybeSingle(),
      admin.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
      admin.from('job_services').select('*').eq('job_id', job.id),
      admin.from('job_parts').select('*').eq('job_id', job.id)
    ]);
    customer = customerData;
    vehicle = vehicleData;

    const serviceIds = (jobServices ?? []).map((s) => s.service_id);
    const partIds = (jobParts ?? []).map((p) => p.part_id);
    const [{ data: serviceCatalog }, { data: partCatalog }] = await Promise.all([
      serviceIds.length ? admin.from('services').select('id, name').in('id', serviceIds) : Promise.resolve({ data: [] }),
      partIds.length ? admin.from('parts').select('id, name').in('id', partIds) : Promise.resolve({ data: [] })
    ]);
    services = (jobServices ?? []).map((s) => ({
      ...s,
      name: serviceCatalog?.find((c) => c.id === s.service_id)?.name ?? 'Unknown'
    }));
    parts = (jobParts ?? []).map((p) => ({
      ...p,
      name: partCatalog?.find((c) => c.id === p.part_id)?.name ?? 'Unknown'
    }));
  }

  return NextResponse.json({
    invoice: {
      ...invoice,
      job_number: job?.job_number ?? 'Unknown',
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      customer_phone: customer?.phone ?? '',
      customer_address: customer?.address ?? '',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? ''
    },
    services,
    parts,
    payments: payments ?? []
  });
}
