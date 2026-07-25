import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { Gauge, AlertTriangle, Clock, CheckCircle2, Wrench } from 'lucide-react';

// Vehicle status board — how many jobs are new/in-progress/done/pending,
// plus ageing on open jobs (how long they've sat in their current
// status) and which vehicles are due or overdue for their next service.
export default async function VehicleStatusPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: jobs }, { data: vehicles }, { data: customers }] = await Promise.all([
    admin
      .from('job_cards')
      .select('*')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('vehicles')
      .select('id, customer_id, plate_number, make, model, odometer_km, next_service_date, next_service_odometer')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null),
    admin.from('customers').select('id, first_name, last_name').eq('org_id', session.employee.org_id)
  ]);

  const allJobs = jobs ?? [];
  const newJobs = allJobs.filter((j) => j.status === 'received');
  const workingJobs = allJobs.filter((j) => !['received', 'completed', 'delivered', 'cancelled'].includes(j.status));
  const doneJobs = allJobs.filter((j) => ['completed', 'delivered'].includes(j.status));
  const pendingApprovalJobs = allJobs.filter((j) => j.status === 'pending_approval');

  const openJobsWithAge = allJobs
    .filter((j) => !['completed', 'delivered', 'cancelled'].includes(j.status))
    .map((j) => {
      const vehicle = vehicles?.find((v) => v.id === j.vehicle_id);
      const customer = customers?.find((c) => c.id === j.customer_id);
      const ageDays = Math.floor((Date.now() - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: j.id,
        job_number: j.job_number,
        status: j.status,
        ageDays,
        vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate_number})` : 'Unknown',
        customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown'
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);

  const today = new Date();
  const dueVehicles = (vehicles ?? [])
    .filter((v) => {
      const dateDue = v.next_service_date && new Date(v.next_service_date) <= today;
      const kmDue = v.next_service_odometer && v.odometer_km >= v.next_service_odometer;
      return dateDue || kmDue;
    })
    .map((v) => {
      const customer = customers?.find((c) => c.id === v.customer_id);
      return {
        id: v.id,
        label: `${v.make} ${v.model} (${v.plate_number})`,
        customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
        nextServiceDate: v.next_service_date,
        nextServiceOdometer: v.next_service_odometer,
        currentOdometer: v.odometer_km
      };
    });

  const STATUS_LABELS: Record<string, string> = {
    received: 'Received',
    diagnosing: 'Diagnosing',
    in_progress: 'In Progress',
    awaiting_parts: 'Awaiting Parts',
    pending_approval: 'Pending Approval',
    approved: 'Approved'
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Gauge className="w-6 h-6 text-amber-500" />
            Vehicle Status Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live snapshot of every open job, ageing, and service reminders.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">New</div>
            <div className="text-slate-200 font-bold text-2xl mt-1">{newJobs.length}</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-amber-400 uppercase">Working</div>
            <div className="text-amber-300 font-bold text-2xl mt-1">{workingJobs.length}</div>
          </div>
          <div className="bg-purple-950/30 border border-purple-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-purple-400 uppercase">Pending Approval</div>
            <div className="text-purple-300 font-bold text-2xl mt-1">{pendingApprovalJobs.length}</div>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-emerald-400 uppercase">Done</div>
            <div className="text-emerald-300 font-bold text-2xl mt-1">{doneJobs.length}</div>
          </div>
        </div>

        {/* Ageing open jobs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500" /> Open Jobs — Oldest First
            </h2>
          </div>
          {openJobsWithAge.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No open jobs right now — everything's caught up.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {openJobsWithAge.map((j) => (
                <a
                  key={j.id}
                  href={`/job-cards/${j.id}`}
                  className="p-3 px-4 flex items-center justify-between gap-3 text-sm hover:bg-slate-900/40"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-amber-500 font-semibold">{j.job_number}</span>
                    <span className="text-slate-500 text-xs ml-2">{STATUS_LABELS[j.status] ?? j.status}</span>
                    <div className="text-xs text-slate-500 truncate">
                      {j.customerName} · {j.vehicleLabel}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${
                      j.ageDays >= 3 ? 'bg-red-950/50 text-red-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {j.ageDays === 0 ? 'Today' : `${j.ageDays}d`}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Due for service */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Due / Overdue for Service ({dueVehicles.length})
            </h2>
          </div>
          {dueVehicles.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No vehicles currently due — reminders are set when a job completes.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {dueVehicles.map((v) => (
                <div key={v.id} className="p-3 px-4 text-sm">
                  <div className="text-slate-200">{v.label}</div>
                  <div className="text-xs text-slate-500">
                    {v.customerName}
                    {v.nextServiceDate && ` · Due ${new Date(v.nextServiceDate).toLocaleDateString('en-IN')}`}
                    {v.nextServiceOdometer && ` · Due at ${v.nextServiceOdometer.toLocaleString()} km (now ${v.currentOdometer.toLocaleString()} km)`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
