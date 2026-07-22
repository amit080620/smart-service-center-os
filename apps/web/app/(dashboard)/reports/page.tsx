import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import ReportsClient from './ReportsClient';

// Reports — daily/date-range business summary: payments received (in),
// invoices raised, job cards created/completed, and inventory movements.
// Date range comes from search params (?from=YYYY-MM-DD&to=YYYY-MM-DD),
// defaulting to today — so "what happened today" is one click and the
// URL itself is shareable/bookmarkable for any range.
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
  // Inclusive end-of-day for the 'to' bound.
  const fromIso = `${fromDate}T00:00:00.000Z`;
  const toIso = `${toDate}T23:59:59.999Z`;

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;

  const [{ data: payments }, { data: invoices }, { data: jobsCreated }, { data: jobsCompleted }, { data: invTx }] =
    await Promise.all([
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
        .order('created_at', { ascending: false })
    ]);

  // payments/inventory_transactions have no org_id column — scope them via
  // their parent records (this org's invoices / this org's inventory rows).
  const { data: orgInvoices } = await admin.from('invoices').select('id, invoice_number, job_id').eq('org_id', orgId);
  const orgInvoiceIds = new Set((orgInvoices ?? []).map((i) => i.id));
  const scopedPayments = (payments ?? []).filter((p) => orgInvoiceIds.has(p.invoice_id));

  const { data: orgInventory } = await admin.from('inventory').select('id, part_id').eq('org_id', orgId);
  const orgInventoryIds = new Set((orgInventory ?? []).map((i) => i.id));
  const scopedInvTx = (invTx ?? []).filter((t) => orgInventoryIds.has(t.inventory_id));

  // Enrich for display: invoice numbers on payments, part names on
  // inventory transactions, customer/vehicle labels on jobs.
  const partIds = [...new Set((orgInventory ?? []).map((i) => i.part_id))];
  const { data: parts } = partIds.length
    ? await admin.from('parts').select('id, name, sku').in('id', partIds)
    : { data: [] };
  const inventoryToPart = new Map((orgInventory ?? []).map((i) => [i.id, i.part_id]));

  const allJobs = [...(jobsCreated ?? []), ...(jobsCompleted ?? [])];
  const customerIds = [...new Set(allJobs.map((j) => j.customer_id))];
  const vehicleIds = [...new Set(allJobs.map((j) => j.vehicle_id))];
  const [{ data: customers }, { data: vehicles }] = await Promise.all([
    customerIds.length
      ? admin.from('customers').select('id, first_name, last_name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    vehicleIds.length
      ? admin.from('vehicles').select('id, plate_number, make, model').in('id', vehicleIds)
      : Promise.resolve({ data: [] })
  ]);

  function jobLabel(j: { customer_id: string; vehicle_id: string }) {
    const c = customers?.find((x) => x.id === j.customer_id);
    const v = vehicles?.find((x) => x.id === j.vehicle_id);
    return `${c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown'} · ${v ? `${v.make} ${v.model} (${v.plate_number})` : ''}`;
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
    paymentsTotal: scopedPayments.reduce((sum, p) => sum + p.amount, 0),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      total: i.total,
      amount_paid: i.amount_paid,
      balance_due: i.balance_due,
      status: i.status,
      created_at: i.created_at
    })),
    invoicesTotal: (invoices ?? []).reduce((sum, i) => sum + i.total, 0),
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
    })
  };

  return <ReportsClient report={report} />;
}
