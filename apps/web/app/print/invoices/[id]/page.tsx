import { redirect, notFound } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import PrintActions from './PrintActions';

// Printable invoice view — /invoices/[id]/print?format=a4 (default) or
// ?format=thermal (58/80mm receipt printers). Renders a clean, white,
// print-first layout completely separate from the app's dark UI, then
// PrintActions (client) triggers window.print(). The browser's own print
// dialog handles the actual printer/paper selection — this page just
// makes sure what goes to it is correctly shaped for each format.
export default async function InvoicePrintPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }
  const { id } = await params;
  const { format } = await searchParams;
  const isThermal = format === 'thermal';

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const { data: job } = await admin.from('job_cards').select('*').eq('id', invoice.job_id).maybeSingle();

  let customer = null;
  let vehicle = null;
  let services: Array<{ id: string; name: string; qty: number; unit_cost: number }> = [];
  let parts: Array<{ id: string; name: string; qty: number; unit_cost: number }> = [];

  if (job) {
    const [{ data: customerData }, { data: vehicleData }, { data: jobServices }, { data: jobParts }] =
      await Promise.all([
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
      id: s.id,
      name: serviceCatalog?.find((c) => c.id === s.service_id)?.name ?? 'Service',
      qty: s.qty,
      unit_cost: s.unit_cost
    }));
    parts = (jobParts ?? []).map((p) => ({
      id: p.id,
      name: partCatalog?.find((c) => c.id === p.part_id)?.name ?? 'Part',
      qty: p.qty,
      unit_cost: p.unit_cost
    }));
  }

  const org = session.org;
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-IN');

  if (isThermal) {
    // ---- THERMAL (58/80mm receipt) ----
    return (
      <div className="bg-white min-h-screen text-black">
        <PrintActions />
        <div className="mx-auto font-mono text-[11px] leading-tight p-2" style={{ width: '72mm' }}>
          <div className="text-center">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-12 mx-auto mb-1 object-contain" />
            )}
            <div className="font-bold text-[13px]">{org.name}</div>
            {org.address && <div>{org.address}</div>}
            {org.contact_phone && <div>Ph: {org.contact_phone}</div>}
            <div className="mt-1">--------------------------------</div>
            <div className="font-bold">TAX INVOICE</div>
            <div>--------------------------------</div>
          </div>
          <div className="mt-1">
            <div>No : {invoice.invoice_number}</div>
            <div>Date: {invoiceDate}</div>
            {job && <div>Job : {job.job_number}</div>}
            {customer && (
              <div>
                Cust: {customer.first_name} {customer.last_name}
              </div>
            )}
            {vehicle && (
              <div>
                Veh : {vehicle.make} {vehicle.model} ({vehicle.plate_number})
              </div>
            )}
          </div>
          <div>--------------------------------</div>
          {services.map((s) => (
            <div key={s.id} className="flex justify-between">
              <span className="pr-1">{s.name.slice(0, 20)}</span>
              <span>{(s.qty * s.unit_cost).toFixed(2)}</span>
            </div>
          ))}
          {parts.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span className="pr-1">
                {p.name.slice(0, 16)} x{p.qty}
              </span>
              <span>{(p.qty * p.unit_cost).toFixed(2)}</span>
            </div>
          ))}
          <div>--------------------------------</div>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{invoice.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>GST ({invoice.tax_type === 'igst' ? 'IGST' : 'CGST+SGST'})</span>
            <span>{invoice.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-[13px]">
            <span>TOTAL</span>
            <span>Rs.{invoice.total.toFixed(2)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{invoice.amount_paid.toFixed(2)}</span>
            </div>
          )}
          {invoice.balance_due > 0 && (
            <div className="flex justify-between font-bold">
              <span>BALANCE DUE</span>
              <span>{invoice.balance_due.toFixed(2)}</span>
            </div>
          )}
          <div className="text-center mt-2">
            <div>--------------------------------</div>
            <div>Thank you for your business!</div>
            <div className="mt-1">Powered by Smart Service Center OS</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- A4 ----
  return (
    <div className="bg-white min-h-screen text-black">
      <PrintActions />
      <div className="mx-auto p-10 max-w-[210mm] text-sm">
        <div className="flex justify-between items-start border-b-2 border-black pb-4">
          <div className="flex items-start gap-4">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-16 w-16 object-contain shrink-0" />
            )}
            <div>
              <div className="text-2xl font-bold">{org.name}</div>
              {org.address && <div className="text-gray-700 mt-1">{org.address}</div>}
              <div className="text-gray-700">
                {org.contact_phone && <span>Ph: {org.contact_phone}</span>}
                {org.contact_email && <span className="ml-3">{org.contact_email}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide">TAX INVOICE</div>
            <div className="mt-1 text-gray-700">{invoice.invoice_number}</div>
            <div className="text-gray-700">Date: {invoiceDate}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-6">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Billed To</div>
            {customer ? (
              <>
                <div className="font-semibold">
                  {customer.first_name} {customer.last_name}
                </div>
                {customer.phone && <div className="text-gray-700">{customer.phone}</div>}
                {customer.address && <div className="text-gray-700">{customer.address}</div>}
              </>
            ) : (
              <div className="text-gray-500">—</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Vehicle / Job</div>
            {vehicle && (
              <div className="font-semibold">
                {vehicle.make} {vehicle.model} — {vehicle.plate_number}
              </div>
            )}
            {job && <div className="text-gray-700">Job Card: {job.job_number}</div>}
            {job && <div className="text-gray-700">Odometer In: {job.odometer_in.toLocaleString()} km</div>}
          </div>
        </div>

        <table className="w-full mt-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate (₹)</th>
              <th className="py-2 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {[...services.map((s) => ({ ...s, kind: 'Service' })), ...parts.map((p) => ({ ...p, kind: 'Part' }))].map(
              (item, idx) => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="py-2 pr-2">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    {item.name} <span className="text-gray-500 text-xs">({item.kind})</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{item.qty}</td>
                  <td className="py-2 pr-2 text-right">{item.unit_cost.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right">{(item.qty * item.unit_cost).toLocaleString('en-IN')}</td>
                </tr>
              )
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount</span>
                <span>−₹{invoice.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">GST</span>
              <span>₹{invoice.tax.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1 mt-1">
              <span>Total</span>
              <span>₹{invoice.total.toLocaleString('en-IN')}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Amount Paid</span>
                <span>₹{invoice.amount_paid.toLocaleString('en-IN')}</span>
              </div>
            )}
            {invoice.balance_due > 0 && (
              <div className="flex justify-between font-bold">
                <span>Balance Due</span>
                <span>₹{invoice.balance_due.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-500">
          <div>Thank you for your business!</div>
          <div>Authorised Signatory ____________________</div>
        </div>
      </div>
    </div>
  );
}
