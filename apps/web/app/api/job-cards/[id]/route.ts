import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canEditCompletedJob } from '@smartbizos/permissions';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();

  const { data: job } = await admin
    .from('job_cards')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job card not found in your organization.' } }, { status: 404 });
  }

  const [{ data: customer }, { data: vehicle }, { data: jobServices }, { data: jobParts }, { data: statusLogs }, { data: technicians }] =
    await Promise.all([
      admin.from('customers').select('*').eq('id', job.customer_id).maybeSingle(),
      admin.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
      admin.from('job_services').select('*').eq('job_id', id),
      admin.from('job_parts').select('*').eq('job_id', id),
      admin.from('job_status_logs').select('*').eq('job_id', id).order('changed_at', { ascending: false }),
      admin
        .from('employees')
        .select('id, full_name')
        .eq('org_id', session.employee.org_id)
        .eq('role', 'technician')
        .eq('status', 'active')
        .is('deleted_at', null)
    ]);

  // Populate service/part catalog names for each line item — the raw
  // job_services/job_parts rows only store the id + price snapshot.
  const serviceIds = (jobServices ?? []).map((s) => s.service_id);
  const partIds = (jobParts ?? []).map((p) => p.part_id);
  const [{ data: serviceCatalog }, { data: partCatalog }] = await Promise.all([
    serviceIds.length ? admin.from('services').select('id, name').in('id', serviceIds) : Promise.resolve({ data: [] }),
    partIds.length ? admin.from('parts').select('id, name, sku').in('id', partIds) : Promise.resolve({ data: [] })
  ]);

  const populatedServices = (jobServices ?? []).map((s) => ({
    ...s,
    service_name: serviceCatalog?.find((c) => c.id === s.service_id)?.name ?? 'Unknown service'
  }));
  const populatedParts = (jobParts ?? []).map((p) => ({
    ...p,
    part_name: partCatalog?.find((c) => c.id === p.part_id)?.name ?? 'Unknown part',
    sku: partCatalog?.find((c) => c.id === p.part_id)?.sku ?? ''
  }));

  return NextResponse.json({
    job: {
      ...job,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
      customer_phone: customer?.phone ?? '',
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
      plate_number: vehicle?.plate_number ?? '',
      technician_name: technicians?.find((t) => t.id === job.assigned_technician_id)?.full_name ?? null
    },
    services: populatedServices,
    parts: populatedParts,
    statusLogs: statusLogs ?? [],
    technicians: technicians ?? [],
    canEditCompleted: canEditCompletedJob(session.employee.role)
  });
}
