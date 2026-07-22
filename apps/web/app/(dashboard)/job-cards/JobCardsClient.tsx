'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Gauge, Search } from 'lucide-react';

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  customer_name: string;
  vehicle_label: string;
  plate_number: string;
  estimated_cost: number;
  created_at: string;
  technician_name: string | null;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
}

interface Vehicle {
  id: string;
  customer_id: string;
  plate_number: string;
  make: string;
  model: string;
}

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

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-slate-700 text-slate-200',
  diagnosing: 'bg-blue-900/50 text-blue-300',
  in_progress: 'bg-amber-900/50 text-amber-300',
  awaiting_parts: 'bg-orange-900/50 text-orange-300',
  pending_approval: 'bg-purple-900/50 text-purple-300',
  approved: 'bg-emerald-900/50 text-emerald-300',
  completed: 'bg-emerald-700/50 text-emerald-200',
  delivered: 'bg-slate-600 text-slate-100',
  cancelled: 'bg-red-900/50 text-red-300'
};

export default function JobCardsClient({
  initialJobs,
  initialCustomers,
  initialVehicles
}: {
  initialJobs: JobCard[];
  initialCustomers: Customer[];
  initialVehicles: Vehicle[];
}) {
  const router = useRouter();
  const jobs = initialJobs;
  const customers = initialCustomers;
  const vehicles = initialVehicles;
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [odometerIn, setOdometerIn] = useState('');
  const [notes, setNotes] = useState('');

  const vehiclesForCustomer = vehicles.filter((v) => v.customer_id === customerId);

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.job_number.toLowerCase().includes(q) ||
      job.customer_name.toLowerCase().includes(q) ||
      job.vehicle_label.toLowerCase().includes(q) ||
      job.plate_number.toLowerCase().includes(q) ||
      (job.technician_name ?? '').toLowerCase().includes(q)
    );
  });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/job-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, vehicleId, odometerIn: Number(odometerIn), notes })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not create job card.');
      setSubmitting(false);
      return;
    }

    router.push(`/job-cards/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-amber-500" />
              Job Cards
            </h1>
            <p className="text-sm text-slate-500 mt-1">Vehicle repair tickets — from intake to delivery.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={customers.length === 0}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Job Card
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job number, customer, vehicle, plate, or technician..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
          />
        </div>

        {customers.length === 0 && (
          <div className="bg-amber-950/30 border border-amber-900/50 text-amber-200 text-sm rounded-xl p-4">
            You need a customer and vehicle on file before creating a job card — go to{' '}
            <a href="/customers" className="underline font-semibold">
              Clients
            </a>{' '}
            first.
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            {error && (
              <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Customer</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setVehicleId('');
                }}
                required
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
                disabled={submitting || !customerId}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="">{customerId ? 'Select a vehicle...' : 'Select a customer first'}</option>
                {vehiclesForCustomer.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} — {v.plate_number}
                  </option>
                ))}
              </select>
              {customerId && vehiclesForCustomer.length === 0 && (
                <p className="text-xs text-amber-400 mt-1.5">
                  This customer has no vehicles on file —{' '}
                  <a href="/vehicles" className="underline">
                    add one first
                  </a>
                  .
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Odometer In (km)</label>
              <input
                type="number"
                value={odometerIn}
                onChange={(e) => setOdometerIn(e.target.value)}
                required
                min="0"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={2}
                placeholder="Customer complaint, initial observations..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !vehicleId}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Job Card'}
            </button>
          </form>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No job cards yet — create your first one above.</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No job cards match "{searchQuery}".</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredJobs.map((job) => (
                <a
                  key={job.id}
                  href={`/job-cards/${job.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-amber-500 font-semibold text-sm">{job.job_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] ?? 'bg-slate-700 text-slate-200'}`}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mt-1 truncate">
                      {job.customer_name} · {job.vehicle_label} ({job.plate_number})
                      {job.technician_name && <span className="text-amber-500/70"> · {job.technician_name}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-amber-500 font-semibold font-mono">₹{job.estimated_cost.toLocaleString()}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
