'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList, Wrench, Package, Plus, Clock } from 'lucide-react';

interface JobDetail {
  id: string;
  job_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  vehicle_label: string;
  plate_number: string;
  odometer_in: number;
  notes: string;
  estimated_cost: number;
  final_cost: number;
}
interface LineService {
  id: string;
  service_name: string;
  qty: number;
  unit_cost: number;
}
interface LinePart {
  id: string;
  part_name: string;
  sku: string;
  qty: number;
  unit_cost: number;
}
interface StatusLog {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  note: string;
}
interface Catalog {
  id: string;
  name: string;
  base_cost?: number;
  unit_cost?: number;
}

const STATUS_FLOW = [
  'received',
  'diagnosing',
  'in_progress',
  'awaiting_parts',
  'pending_approval',
  'approved',
  'completed',
  'delivered'
];
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

export default function JobCardDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [services, setServices] = useState<LineService[]>([]);
  const [parts, setParts] = useState<LinePart[]>([]);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<Catalog[]>([]);
  const [partCatalog, setPartCatalog] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState('1');

  async function loadAll() {
    setLoading(true);
    const [detailRes, servicesRes, partsRes] = await Promise.all([
      fetch(`/api/job-cards/${jobId}`),
      fetch('/api/services'),
      fetch('/api/parts')
    ]);
    if (detailRes.ok) {
      const data = await detailRes.json();
      setJob(data.job);
      setServices(data.services);
      setParts(data.parts);
      setStatusLogs(data.statusLogs);
    }
    if (servicesRes.ok) setServiceCatalog(await servicesRes.json());
    if (partsRes.ok) setPartCatalog(await partsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleStatusChange(newStatus: string) {
    setStatusUpdating(true);
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update status.');
      setStatusUpdating(false);
      return;
    }
    setStatusUpdating(false);
    loadAll();
  }

  async function handleAddService() {
    const svc = serviceCatalog.find((s) => s.id === selectedServiceId);
    if (!svc) return;
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', itemId: svc.id, qty: 1, unitCost: svc.base_cost })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add service.');
      return;
    }
    setSelectedServiceId('');
    setShowServiceForm(false);
    loadAll();
  }

  async function handleAddPart() {
    const part = partCatalog.find((p) => p.id === selectedPartId);
    if (!part) return;
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'part', itemId: part.id, qty: Number(partQty), unitCost: part.unit_cost })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add part.');
      return;
    }
    setSelectedPartId('');
    setPartQty('1');
    setShowPartForm(false);
    loadAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto text-center text-slate-500 font-mono text-sm">Loading...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto text-center text-slate-500 text-sm">Job card not found.</div>
      </div>
    );
  }

  const isLocked = ['completed', 'delivered', 'cancelled'].includes(job.status);
  const currentIndex = STATUS_FLOW.indexOf(job.status);
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-amber-500" />
              {job.job_number}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {job.customer_name} · {job.vehicle_label} ({job.plate_number})
            </p>
          </div>
          <span className="text-sm px-3 py-1.5 rounded-full font-medium bg-amber-900/40 text-amber-300 border border-amber-800">
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {/* Status progression */}
        {!isLocked && nextStatus && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              Move to next stage: <span className="text-slate-200 font-medium">{STATUS_LABELS[nextStatus]}</span>
            </div>
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={statusUpdating}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-50"
            >
              {statusUpdating ? 'Updating...' : `Mark as ${STATUS_LABELS[nextStatus]}`}
            </button>
          </div>
        )}

        {/* Job info */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Odometer In</div>
            <div className="text-slate-200 mt-0.5">{job.odometer_in.toLocaleString()} km</div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Phone</div>
            <div className="text-slate-200 mt-0.5">{job.customer_phone}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-mono text-slate-500 uppercase">Total Estimate</div>
            <div className="text-amber-500 font-semibold mt-0.5">₹{job.estimated_cost.toLocaleString()}</div>
          </div>
          {job.notes && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs font-mono text-slate-500 uppercase">Notes</div>
              <div className="text-slate-300 mt-0.5">{job.notes}</div>
            </div>
          )}
        </div>

        {/* Services */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-amber-500" /> Services
            </h2>
            {!isLocked && (
              <button
                onClick={() => setShowServiceForm(!showServiceForm)}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          {showServiceForm && (
            <div className="p-4 border-b border-slate-800 flex gap-2">
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
              >
                <option value="">Select a service...</option>
                {serviceCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₹{s.base_cost}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddService}
                disabled={!selectedServiceId}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
          {services.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No services added yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {services.map((s) => (
                <div key={s.id} className="p-3 px-4 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{s.service_name}</span>
                  <span className="font-mono text-amber-500">₹{(s.qty * s.unit_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Parts */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-amber-500" /> Parts
            </h2>
            {!isLocked && (
              <button
                onClick={() => setShowPartForm(!showPartForm)}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          {showPartForm && (
            <div className="p-4 border-b border-slate-800 flex gap-2">
              <select
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
              >
                <option value="">Select a part...</option>
                {partCatalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.unit_cost}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={partQty}
                onChange={(e) => setPartQty(e.target.value)}
                min="1"
                className="w-20 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
              />
              <button
                onClick={handleAddPart}
                disabled={!selectedPartId}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
          {parts.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No parts added yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {parts.map((p) => (
                <div key={p.id} className="p-3 px-4 flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {p.part_name} <span className="text-slate-500 font-mono text-xs">×{p.qty}</span>
                  </span>
                  <span className="font-mono text-amber-500">₹{(p.qty * p.unit_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status history */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500" /> History
            </h2>
          </div>
          <div className="divide-y divide-slate-800/50">
            {statusLogs.map((log) => (
              <div key={log.id} className="p-3 px-4 text-xs text-slate-400 flex items-center justify-between">
                <span>{log.note || `${log.old_status ?? 'created'} → ${log.new_status}`}</span>
                <span className="font-mono text-slate-600">{new Date(log.changed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
