import { redirect, notFound } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import PrintActions from '../../invoices/[id]/PrintActions';

// Printable ESTIMATE — distinct from the invoice print page. Meant to be
// handed to the customer after initial inspection/test-drive, before any
// work is actually approved or done, so they know roughly what to
// expect. Uses the job card's current line items directly (not a
// separate stored document), since the estimate IS just "what's on the
// job card right now" — whatever's been added during diagnosis.
export default async function EstimatePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
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
    notFound();
  }

  const [{ data: customer }, { data: vehicle }, { data: jobServices }, { data: jobParts }] = await Promise.all([
    admin.from('customers').select('*').eq('id', job.customer_id).maybeSingle(),
    admin.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    admin.from('job_services').select('*').eq('job_id', job.id),
    admin.from('job_parts').select('*').eq('job_id', job.id)
  ]);

  const serviceIds = (jobServices ?? []).map((s) => s.service_id);
  const partIds = (jobParts ?? []).map((p) => p.part_id);
  const [{ data: serviceCatalog }, { data: partCatalog }] = await Promise.all([
    serviceIds.length ? admin.from('services').select('id, name').in('id', serviceIds) : Promise.resolve({ data: [] }),
    partIds.length ? admin.from('parts').select('id, name').in('id', partIds) : Promise.resolve({ data: [] })
  ]);

  const services = (jobServices ?? []).map((s) => ({
    id: s.id,
    name: serviceCatalog?.find((c) => c.id === s.service_id)?.name ?? 'Service',
    qty: s.qty,
    unit_cost: s.unit_cost
  }));
  const parts = (jobParts ?? []).map((p) => ({
    id: p.id,
    name: partCatalog?.find((c) => c.id === p.part_id)?.name ?? 'Part',
    qty: p.qty,
    unit_cost: p.unit_cost
  }));

  const org = session.org;
  const estimateDate = new Date().toLocaleDateString('en-IN');

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
              {org.settings.gst_number && <div className="text-gray-700 font-mono text-xs mt-0.5">GSTIN: {org.settings.gst_number}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide">ESTIMATE</div>
            <div className="mt-1 text-gray-700">{job.job_number}</div>
            <div className="text-gray-700">Date: {estimateDate}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-6">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Customer</div>
            {customer ? (
              <>
                <div className="font-semibold">
                  {customer.first_name} {customer.last_name}
                </div>
                {customer.phone && <div className="text-gray-700">{customer.phone}</div>}
              </>
            ) : (
              <div className="text-gray-500">—</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Vehicle</div>
            {vehicle && (
              <div className="font-semibold">
                {vehicle.make} {vehicle.model} — {vehicle.plate_number}
              </div>
            )}
            <div className="text-gray-700">Odometer: {job.odometer_in.toLocaleString()} km</div>
          </div>
        </div>

        {job.notes && (
          <div className="mt-4">
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Reported Issue / Notes</div>
            <div className="text-gray-800">{job.notes}</div>
          </div>
        )}

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
            {services.length === 0 && parts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No items added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1">
            <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1 mt-1">
              <span>Estimated Total</span>
              <span>₹{job.estimated_cost.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 p-3 bg-gray-100 text-xs text-gray-600 rounded">
          This is an estimate only, not a final invoice. Actual cost may vary depending on further inspection findings.
          GST, if applicable, will be added at the time of final billing.
        </div>

        <div className="mt-16 pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-500">
          <div>Estimate valid for reference only.</div>
          <div>Customer Signature ____________________</div>
        </div>
      </div>
    </div>
  );
}
