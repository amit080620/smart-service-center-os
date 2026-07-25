import { redirect, notFound } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { Car, Gauge, Calendar, Wrench } from 'lucide-react';

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

// Full service history for one vehicle — every job card it's ever had,
// newest first, with who worked on it and when. Answers "when was this
// last serviced and by whom" at a glance, without digging through the
// full Job Cards list.
export default async function VehicleHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!vehicle) {
    notFound();
  }

  const [{ data: customer }, { data: jobs }] = await Promise.all([
    admin.from('customers').select('first_name, last_name, phone').eq('id', vehicle.customer_id).maybeSingle(),
    admin
      .from('job_cards')
      .select('*')
      .eq('vehicle_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  ]);

  const technicianIds = [...new Set((jobs ?? []).map((j) => j.assigned_technician_id).filter((x): x is string => Boolean(x)))];
  const { data: technicians } = technicianIds.length
    ? await admin.from('employees').select('id, full_name').in('id', technicianIds)
    : { data: [] };

  const lastCompleted = (jobs ?? []).find((j) => j.status === 'completed' || j.status === 'delivered');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Car className="w-6 h-6 text-amber-500" />
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {vehicle.plate_number} · {customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown owner'}
            {customer?.phone && ` · ${customer.phone}`}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Odometer
            </div>
            <div className="text-slate-200 font-bold mt-1">{vehicle.odometer_km.toLocaleString()} km</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Total Jobs</div>
            <div className="text-slate-200 font-bold mt-1">{jobs?.length ?? 0}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 col-span-2">
            <div className="text-xs font-mono text-slate-500 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Last Serviced
            </div>
            <div className="text-slate-200 font-semibold mt-1 text-sm">
              {lastCompleted
                ? `${new Date(lastCompleted.completed_at ?? lastCompleted.created_at).toLocaleDateString('en-IN')} · ${
                    technicians?.find((t) => t.id === lastCompleted.assigned_technician_id)?.full_name ?? 'Unassigned'
                  }`
                : 'Never serviced yet'}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-amber-500" /> Job History
            </h2>
          </div>
          {!jobs || jobs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No job cards for this vehicle yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {jobs.map((j) => (
                <a
                  key={j.id}
                  href={`/job-cards/${j.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-amber-500 font-semibold">{j.job_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {STATUS_LABELS[j.status] ?? j.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(j.created_at).toLocaleDateString('en-IN')} ·{' '}
                      {technicians?.find((t) => t.id === j.assigned_technician_id)?.full_name ?? 'Unassigned'}
                    </div>
                  </div>
                  <span className="font-mono text-slate-300 shrink-0">
                    ₹{(j.final_cost || j.estimated_cost).toLocaleString('en-IN')}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
