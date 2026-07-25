import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import ReportsClient from './ReportsClient';

// Reports — daily/date-range business summary with real analysis, not
// just raw transaction lists: period-over-period comparison, top
// performers (services/parts/customers by revenue), and a day-by-day
// revenue trend, alongside the underlying payments/invoices/jobs/
// inventory detail. Every section can be toggled off before printing,
// so a printout only has what's actually needed instead of everything
// at once.
export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const { from, to } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = from || today;
  const toDate = to || today;
  const fromIso = `${fromDate}T00:00:00.000Z`;
  const toIso = `${toDate}T23:59:59.999Z`;

  // Previous period of equal length, immediately before this one — the
  // baseline every "% change" comparison is measured against. E.g. if
  // the selected range is 7 days, the comparison period is the 7 days
  // before that.
  const rangeDays = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevToDate = new Date(new Date(fromIso).getTime() - 24 * 60 * 60 * 1000);
  const prevFromDate = new Date(prevToDate.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
  const prevFromIso = `${prevFromDate.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const prevToIso = `${prevToDate.toISOString().slice(0, 10)}T23:59:59.999Z`;

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;

  const [
    { data: payments },
    { data: invoices },
    { data: jobsCreated },
    { data: jobsCompleted },
    { data: invTx },
    { data: prevInvoices },
    { data: prevPayments }
  ] = await Promise.all([
    admin.from('payments').select('*').gte('paid_at', fromIso).lte('paid_at', toIso).order('paid_at', { ascending: false }),
    admin
      .from('invoices')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false }),
    admin
      .from('job_cards')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    admin
      .from('job_cards')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('completed_at', fromIso)
      .lte('completed_at', toIso),
    admin
      .from('inventory_transactions')
      .select('*')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false }),
    admin.from('invoices').select('total').eq('org_id', orgId).gte('created_at', prevFromIso).lte('created_at', prevToIso),
    admin.from('payments').select('amount, invoice_id').gte('paid_at', prevFromIso).lte('paid_at', prevToIso)
  ]);

  const { data: orgInvoices } = await admin.from('invoices').select('id, invoice_number, job_id').eq('org_id', orgId);
  const orgInvoiceIds = new Set((orgInvoices ?? []).map((i) => i.id));
  const scopedPayments = (payments ?? []).filter((p) => orgInvoiceIds.has(p.invoice_id));
  const scopedPrevPayments = (prevPayments ?? []).filter((p) => orgInvoiceIds.has(p.invoice_id));

  const { data: orgInventory } = await admin.from('inventory').select('id, part_id').eq('org_id', orgId);
  const orgInventoryIds = new Set((orgInventory ?? []).map((i) => i.id));
  const scopedInvTx = (invTx ?? []).filter((t) => orgInventoryIds.has(t.inventory_id));

  const partIds = [...new Set((orgInventory ?? []).map((i) => i.part_id))];
  const { data: parts } = partIds.length
    ? await admin.from('parts').select('id, name, sku').in('id', partIds)
    : { data: [] };
  const inventoryToPart = new Map((orgInventory ?? []).map((i) => [i.id, i.part_id]));

  const allJobs = [...(jobsCreated ?? []), ...(jobsCompleted ?? [])];
  const customerIds = [...new Set(allJobs.map((j) => j.customer_id))];
  const vehicleIds = [...new Set(allJobs.map((j) => j.vehicle_id))];
  const [{ data: customers }, { data: vehicles }, { data: technicians }] = await Promise.all([
    customerIds.length
      ? admin.from('customers').select('id, first_name, last_name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    vehicleIds.length
      ? admin.from('vehicles').select('id, plate_number, make, model').in('id', vehicleIds)
      : Promise.resolve({ data: [] }),
    admin.from('employees').select('id, full_name').eq('org_id', orgId).eq('role', 'technician')
  ]);

  function jobLabel(j: { customer_id: string; vehicle_id: string }) {
    const c = customers?.find((x) => x.id === j.customer_id);
    const v = vehicles?.find((x) => x.id === j.vehicle_id);
    return `${c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown'} · ${v ? `${v.make} ${v.model} (${v.plate_number})` : ''}`;
  }

  const workerStats = (technicians ?? []).map((t) => {
    const techJobs = (jobsCompleted ?? []).filter((j) => j.assigned_technician_id === t.id);
    return {
      id: t.id,
      name: t.full_name,
      jobCount: techJobs.length,
      revenue: techJobs.reduce((sum, j) => sum + j.final_cost, 0),
      jobs: techJobs.map((j) => ({ id: j.id, job_number: j.job_number, label: jobLabel(j), final_cost: j.final_cost }))
    };
  });
  const unassignedCompleted = (jobsCompleted ?? []).filter((j) => !j.assigned_technician_id);

  // ---- Analysis: Top Performers ----
  // Pulls every job_service/job_part line item for jobs completed in
  // this period, then aggregates revenue by catalog item — answers
  // "what's actually making us money," not just "what did we sell."
  const completedJobIds = (jobsCompleted ?? []).map((j) => j.id);
  const [{ data: jobServiceLines }, { data: jobPartLines }] = await Promise.all([
    completedJobIds.length
      ? admin.from('job_services').select('service_id, qty, unit_cost').in('job_id', completedJobIds)
      : Promise.resolve({ data: [] }),
    completedJobIds.length
      ? admin.from('job_parts').select('part_id, qty, unit_cost').in('job_id', completedJobIds)
      : Promise.resolve({ data: [] })
  ]);

  const serviceRevenueMap = new Map<string, number>();
  for (const line of jobServiceLines ?? []) {
    serviceRevenueMap.set(line.service_id, (serviceRevenueMap.get(line.service_id) ?? 0) + line.qty * line.unit_cost);
  }
  const partRevenueMap = new Map<string, number>();
  for (const line of jobPartLines ?? []) {
    partRevenueMap.set(line.part_id, (partRevenueMap.get(line.part_id) ?? 0) + line.qty * line.unit_cost);
  }

  const [{ data: serviceCatalog }, { data: partCatalog }] = await Promise.all([
    serviceRevenueMap.size
      ? admin.from('services').select('id, name').in('id', [...serviceRevenueMap.keys()])
      : Promise.resolve({ data: [] }),
    partRevenueMap.size ? admin.from('parts').select('id, name').in('id', [...partRevenueMap.keys()]) : Promise.resolve({ data: [] })
  ]);

  const topServices = [...serviceRevenueMap.entries()]
    .map(([id, revenue]) => ({ name: serviceCatalog?.find((s) => s.id === id)?.name ?? 'Unknown', revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const topParts = [...partRevenueMap.entries()]
    .map(([id, revenue]) => ({ name: partCatalog?.find((p) => p.id === id)?.name ?? 'Unknown', revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const customerSpendMap = new Map<string, number>();
  for (const j of jobsCompleted ?? []) {
    customerSpendMap.set(j.customer_id, (customerSpendMap.get(j.customer_id) ?? 0) + j.final_cost);
  }
  const topCustomers = [...customerSpendMap.entries()]
    .map(([id, spend]) => {
      const c = customers?.find((x) => x.id === id);
      return { name: c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown', spend };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  // ---- Analysis: Revenue Trend (day by day within the range) ----
  const dayMap = new Map<string, { revenue: number; jobCount: number }>();
  for (const inv of invoices ?? []) {
    const day = inv.created_at.slice(0, 10);
    const entry = dayMap.get(day) ?? { revenue: 0, jobCount: 0 };
    entry.revenue += inv.total;
    dayMap.set(day, entry);
  }
  for (const j of jobsCompleted ?? []) {
    if (!j.completed_at) continue;
    const day = j.completed_at.slice(0, 10);
    const entry = dayMap.get(day) ?? { revenue: 0, jobCount: 0 };
    entry.jobCount += 1;
    dayMap.set(day, entry);
  }
  const revenueTrend = [...dayMap.entries()]
    .map(([date, v]) => ({ date, revenue: v.revenue, jobCount: v.jobCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- Period-over-period comparison ----
  const revenueTotal = (invoices ?? []).reduce((sum, i) => sum + i.total, 0);
  const prevRevenueTotal = (prevInvoices ?? []).reduce((sum, i) => sum + i.total, 0);
  const paymentsTotal = scopedPayments.reduce((sum, p) => sum + p.amount, 0);
  const prevPaymentsTotal = scopedPrevPayments.reduce((sum, p) => sum + p.amount, 0);

  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }

  const report = {
    fromDate,
    toDate,
    orgName: session.org.name,
    branchName: session.branch.name,
    payments: scopedPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paid_at: p.paid_at,
      invoice_number: (orgInvoices ?? []).find((i) => i.id === p.invoice_id)?.invoice_number ?? '—'
    })),
    paymentsTotal,
    paymentsChangePct: pctChange(paymentsTotal, prevPaymentsTotal),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      total: i.total,
      amount_paid: i.amount_paid,
      balance_due: i.balance_due,
      status: i.status,
      created_at: i.created_at
    })),
    invoicesTotal: revenueTotal,
    revenueChangePct: pctChange(revenueTotal, prevRevenueTotal),
    outstandingTotal: (invoices ?? []).reduce((sum, i) => sum + i.balance_due, 0),
    jobsCreated: (jobsCreated ?? []).map((j) => ({
      id: j.id,
      job_number: j.job_number,
      status: j.status,
      label: jobLabel(j),
      created_at: j.created_at
    })),
    jobsCompleted: (jobsCompleted ?? []).map((j) => ({
      id: j.id,
      job_number: j.job_number,
      final_cost: j.final_cost,
      label: jobLabel(j),
      completed_at: j.completed_at
    })),
    avgJobValue: (jobsCompleted ?? []).length > 0 ? Math.round(revenueTotal / (jobsCompleted ?? []).length) : 0,
    inventoryTx: scopedInvTx.map((t) => {
      const partId = inventoryToPart.get(t.inventory_id);
      const part = parts?.find((p) => p.id === partId);
      return {
        id: t.id,
        type: t.type,
        qty: t.qty,
        part_name: part?.name ?? 'Unknown',
        sku: part?.sku ?? '',
        notes: t.notes,
        created_at: t.created_at
      };
    }),
    workerStats,
    unassignedCompletedCount: unassignedCompleted.length,
    topServices,
    topParts,
    topCustomers,
    revenueTrend
  };

  return <ReportsClient report={report} />;
}
