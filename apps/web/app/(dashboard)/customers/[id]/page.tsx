import { redirect, notFound } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { User, Phone, Mail, MapPin, Car, Wrench } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  diagnosing: 'Diagnosing',
  in_progress: 'In Progress',
  awaiting_parts: 'Awaiting Parts',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// Full timeline for one customer — every vehicle they own and every job
// card across all of those vehicles, newest first. The vehicle-level
// history page answers "what happened to this car"; this answers "what's
// this customer's whole relationship with us" — useful when they call in
// and you want the full picture without checking each vehicle separately.
export default async function CustomerHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  const { data: vehicles } = await admin
    .from('vehicles')
    .select('*')
    .eq('customer_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  const { data: jobs } = vehicleIds.length
    ? await admin.from('job_cards').select('*').in('vehicle_id', vehicleIds).is('deleted_at', null).order('created_at', { ascending: false })
    : { data: [] };

  const technicianIds = [...new Set((jobs ?? []).map((j) => j.assigned_technician_id).filter((x): x is string => Boolean(x)))];
  const { data: technicians } = technicianIds.length
    ? await admin.from('employees').select('id, full_name').in('id', technicianIds)
    : { data: [] };

  const totalSpent = (jobs ?? [])
    .filter((j) => ['completed', 'delivered'].includes(j.status))
    .reduce((sum, j) => sum + j.final_cost, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-amber-500" />
            {customer.first_name} {customer.last_name}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {customer.phone}
            </span>
            {customer.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {customer.email}
              </span>
            )}
            {customer.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {customer.address}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Vehicles</div>
            <div className="text-slate-200 font-bold text-xl mt-1">{vehicles?.length ?? 0}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Total Jobs</div>
            <div className="text-slate-200 font-bold text-xl mt-1">{jobs?.length ?? 0}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Total Spent</div>
            <div className="text-amber-500 font-bold text-xl mt-1">₹{totalSpent.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Car className="w-4 h-4 text-amber-500" /> Vehicles
            </h2>
          </div>
          {!vehicles || vehicles.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No vehicles on file yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {vehicles.map((v) => (
                <a key={v.id} href={`/vehicles/${v.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 text-sm">
                  <div>
                    <span className="text-slate-200 font-medium">
                      {v.make} {v.model}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">{v.plate_number}</span>
                  </div>
                  <span className="text-xs text-slate-500">{v.odometer_km.toLocaleString()} km</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-amber-500" /> Job History (All Vehicles)
            </h2>
          </div>
          {!jobs || jobs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No job cards yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {jobs.map((j) => {
                const vehicle = vehicles?.find((v) => v.id === j.vehicle_id);
                return (
                  <a key={j.id} href={`/job-cards/${j.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-amber-500 font-semibold">{j.job_number}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {STATUS_LABELS[j.status] ?? j.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate_number})` : 'Unknown vehicle'} ·{' '}
                        {new Date(j.created_at).toLocaleDateString('en-IN')} ·{' '}
                        {technicians?.find((t) => t.id === j.assigned_technician_id)?.full_name ?? 'Unassigned'}
                      </div>
                    </div>
                    <span className="font-mono text-slate-300 shrink-0">
                      ₹{(j.final_cost || j.estimated_cost).toLocaleString('en-IN')}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
