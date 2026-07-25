'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList, Wrench, Package, Plus, Clock, Trash2, Printer, ShieldCheck } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import JobDetailsEditPanel from './JobDetailsEditPanel';

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
  is_insurance_claim: boolean;
  insurance_company: string;
  insurance_claim_number: string;
  insurance_approved_amount: number | null;
  estimated_cost: number;
  final_cost: number;
  assigned_technician_id: string | null;
  technician_accepted_at: string | null;
  technician_name: string | null;
}
interface Technician {
  id: string;
  full_name: string;
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
  sku?: string;
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
  const [canEditCompleted, setCanEditCompleted] = useState(false);
  const [overrideStatusValue, setOverrideStatusValue] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assigningTech, setAssigningTech] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<Catalog[]>([]);
  const [partCatalog, setPartCatalog] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  // Manual discount + GST, entered at completion time — both default to
  // 0 (no discount, no tax) unless the person filling this in adds them.
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState('0');
  const [gstAmount, setGstAmount] = useState('0');
  const [gstType, setGstType] = useState<'amount' | 'percentage'>('amount');
  const [nextServiceMonths, setNextServiceMonths] = useState('');
  const [nextServiceKm, setNextServiceKm] = useState('');

  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedItemType, setSelectedItemType] = useState<'service' | 'part' | null>(null);
  const [addItemQty, setAddItemQty] = useState('1');
  const [showQuickCreateItem, setShowQuickCreateItem] = useState(false);
  const [quickItemType, setQuickItemType] = useState<'service' | 'part'>('service');
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');
  const [quickItemSku, setQuickItemSku] = useState('');
  const [quickItemSubmitting, setQuickItemSubmitting] = useState(false);

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
      setTechnicians(data.technicians ?? []);
      setCanEditCompleted(data.canEditCompleted ?? false);
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

  // Separate from handleStatusChange — completing a job goes through the
  // dedicated endpoint that generates the invoice in the same operation,
  // not the plain status-update endpoint (which deliberately rejects
  // 'completed' entirely — see packages/validation).
  async function handleCompleteJob() {
    setStatusUpdating(true);
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discountType,
        discountValue: Number(discountValue) || 0,
        gstType,
        gstAmount: Number(gstAmount) || 0,
        ...(nextServiceMonths && { nextServiceMonths: Number(nextServiceMonths) }),
        ...(nextServiceKm && { nextServiceKm: Number(nextServiceKm) })
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not complete this job.');
      setStatusUpdating(false);
      return;
    }
    window.location.href = `/invoices/${data.invoice.id}`;
  }

  async function handleQuickCreateItem() {
    setQuickItemSubmitting(true);
    setError(null);

    const res =
      quickItemType === 'service'
        ? await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: quickItemName, baseCost: Number(quickItemPrice) || 0 })
          })
        : await fetch('/api/parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: quickItemName, sku: quickItemSku, unitCost: Number(quickItemPrice) || 0 })
          });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? `Could not create new ${quickItemType}.`);
      setQuickItemSubmitting(false);
      return;
    }

    // Add the freshly-created item straight onto this job — no need to
    // search for it again right after creating it.
    setError(null);
    const addRes = await fetch(`/api/job-cards/${jobId}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: quickItemType,
        itemId: data.id,
        qty: Number(addItemQty) || 1,
        unitCost: quickItemType === 'service' ? data.base_cost : data.unit_cost
      })
    });
    const addData = await addRes.json();
    if (!addRes.ok) {
      setError(addData.error?.message ?? 'Item was created in the catalog, but could not be added to this job.');
      setQuickItemSubmitting(false);
      return;
    }

    setQuickItemName('');
    setQuickItemPrice('');
    setQuickItemSku('');
    setShowQuickCreateItem(false);
    setShowAddItemForm(false);
    setQuickItemSubmitting(false);
    loadAll();
  }

  async function handleAddItem() {
    if (!selectedItemId || !selectedItemType) return;
    const catalog = selectedItemType === 'service' ? serviceCatalog : partCatalog;
    const item = catalog.find((c) => c.id === selectedItemId);
    if (!item) return;
    const unitCost = selectedItemType === 'service' ? item.base_cost : item.unit_cost;
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: selectedItemType, itemId: item.id, qty: Number(addItemQty) || 1, unitCost })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add item.');
      return;
    }
    setSelectedItemId('');
    setSelectedItemType(null);
    setAddItemQty('1');
    setShowAddItemForm(false);
    loadAll();
  }

  async function handleDeleteLineItem(type: 'service' | 'part', lineItemId: string) {
    if (!confirm('Remove this item? This cannot be undone.')) return;
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/line-items/${lineItemId}?type=${type}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not remove item.');
      return;
    }
    loadAll();
  }

  async function handleUpdateQty(type: 'service' | 'part', lineItemId: string, newQty: number) {
    if (newQty <= 0) {
      handleDeleteLineItem(type, lineItemId);
      return;
    }
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/line-items/${lineItemId}?type=${type}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: newQty })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update quantity.');
      return;
    }
    loadAll();
  }

  async function handleAssignTechnician(technicianId: string) {
    setAssigningTech(true);
    setError(null);
    const res = await fetch(`/api/job-cards/${jobId}/assign-technician`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianId: technicianId || null })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not assign technician.');
      setAssigningTech(false);
      return;
    }
    setAssigningTech(false);
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
  // Separate from isLocked (which correctly freezes line items at
  // 'completed') — status can still progress from 'completed' to
  // 'delivered' (handing the vehicle back), so only 'delivered'/
  // 'cancelled' should stop status progression entirely.
  const canProgressStatus = !['delivered', 'cancelled'].includes(job.status);
  // Line items can be added/edited/removed normally on an open job. Once
  // completed, only management roles can still touch them (server also
  // enforces a 15-day window from completion — this client check is just
  // for not showing controls that would obviously fail).
  const canEditLineItems = !isLocked || (job.status === 'completed' && canEditCompleted);
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

        <a
          href={`/print/estimates/${job.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
        >
          <Printer className="w-4 h-4" /> Print Estimate for Customer
        </a>

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {/* Status progression */}
        {canProgressStatus && job.status === 'approved' && (
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-5 space-y-4">
            <div className="text-sm text-emerald-200">
              This job is approved and ready to be completed — fill in discount/GST if needed (both default to 0),
              then generate the invoice.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Discount</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    min="0"
                    disabled={statusUpdating}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percentage')}
                    disabled={statusUpdating}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">GST</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    min="0"
                    disabled={statusUpdating}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                  />
                  <select
                    value={gstType}
                    onChange={(e) => setGstType(e.target.value as 'amount' | 'percentage')}
                    disabled={statusUpdating}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Invoice Total</label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm font-mono text-amber-500 font-semibold">
                  ₹
                  {(() => {
                    const afterDiscount =
                      job.estimated_cost -
                      (discountType === 'percentage'
                        ? Math.round(job.estimated_cost * ((Number(discountValue) || 0) / 100))
                        : Number(discountValue) || 0);
                    const gst =
                      gstType === 'percentage' ? Math.round(afterDiscount * ((Number(gstAmount) || 0) / 100)) : Number(gstAmount) || 0;
                    return (afterDiscount + gst).toLocaleString('en-IN');
                  })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-emerald-900/30">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Next Service In (months, optional)</label>
                <input
                  type="number"
                  value={nextServiceMonths}
                  onChange={(e) => setNextServiceMonths(e.target.value)}
                  min="0"
                  placeholder="e.g. 6"
                  disabled={statusUpdating}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Next Service At (+km, optional)</label>
                <input
                  type="number"
                  value={nextServiceKm}
                  onChange={(e) => setNextServiceKm(e.target.value)}
                  min="0"
                  placeholder="e.g. 5000"
                  disabled={statusUpdating}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <button
              onClick={handleCompleteJob}
              disabled={statusUpdating}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {statusUpdating ? 'Completing...' : 'Complete & Generate Invoice'}
            </button>
          </div>
        )}
        {canProgressStatus && job.status !== 'approved' && nextStatus && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
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

        {/* Admin override — jump to any status, not just the next one in
            sequence. Only management roles see/can use this; the server
            enforces the same rule independently. */}
        {(job.status !== 'completed' || canEditCompleted) && !['delivered', 'cancelled'].includes(job.status) && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              {showOverride ? 'Hide' : 'Change status manually (admin)'}
            </button>
            {showOverride && (
              <div className="mt-3 flex items-center gap-2 flex-wrap animate-fadeIn">
                <select
                  value={overrideStatusValue}
                  onChange={(e) => setOverrideStatusValue(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                >
                  <option value="">Select status...</option>
                  {STATUS_FLOW.filter((s) => s !== 'completed').map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={() => {
                    if (overrideStatusValue) handleStatusChange(overrideStatusValue);
                  }}
                  disabled={statusUpdating || !overrideStatusValue}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Apply
                </button>
                <span className="text-xs text-slate-600">"Completed" must go through the invoice button above.</span>
              </div>
            )}
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
          <div className="col-span-2 sm:col-span-4">
            <div className="text-xs font-mono text-slate-500 uppercase mb-1">Assigned Technician</div>
            {technicians.length === 0 ? (
              <div className="text-slate-500 text-xs">
                No technicians on staff yet —{' '}
                <a href="/employees" className="underline">
                  add one
                </a>
                .
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={job.assigned_technician_id ?? ''}
                  onChange={(e) => handleAssignTechnician(e.target.value)}
                  disabled={assigningTech}
                  className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-sm outline-none disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                {job.assigned_technician_id && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      job.technician_accepted_at ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
                    }`}
                  >
                    {job.technician_accepted_at ? 'Accepted' : 'Waiting for accept...'}
                  </span>
                )}
              </div>
            )}
          </div>
          {job.notes && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs font-mono text-slate-500 uppercase">Notes</div>
              <div className="text-slate-300 mt-0.5">{job.notes}</div>
            </div>
          )}
          {job.is_insurance_claim && (
            <div className="col-span-2 sm:col-span-4 bg-amber-950/20 border border-amber-900/40 rounded-xl p-3">
              <div className="text-xs font-mono text-amber-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Insurance Claim
              </div>
              <div className="text-slate-300 mt-1 text-sm">
                {job.insurance_company || 'Company not set'} {job.insurance_claim_number && `· Claim #${job.insurance_claim_number}`}
                {job.insurance_approved_amount !== null && ` · Approved ₹${job.insurance_approved_amount.toLocaleString('en-IN')}`}
              </div>
            </div>
          )}
        </div>

        <JobDetailsEditPanel
          job={{
            id: job.id,
            notes: job.notes,
            odometer_in: job.odometer_in,
            is_insurance_claim: job.is_insurance_claim,
            insurance_company: job.insurance_company,
            insurance_claim_number: job.insurance_claim_number,
            insurance_approved_amount: job.insurance_approved_amount
          }}
          canEdit={job.status !== 'completed' || canEditCompleted}
          onSaved={loadAll}
        />

        {/* Unified add — searches services and parts together, one flow
            instead of two separate buttons/forms to choose between. */}
        {canEditLineItems && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAddItemForm(!showAddItemForm)}
              className="w-full p-4 flex items-center justify-between text-sm font-semibold cursor-pointer hover:bg-slate-900/40"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" /> Add Service or Part
              </span>
              {showAddItemForm && <span className="text-xs text-slate-500">Cancel</span>}
            </button>
            {showAddItemForm && (
              <div className="p-4 border-t border-slate-800 space-y-3">
                {job.status === 'completed' && canEditCompleted && (
                  <div className="text-xs text-amber-300 bg-amber-950/20 rounded-lg p-2">
                    Editing a completed job — changes will update the invoice too.
                  </div>
                )}
                <SearchableSelect
                  items={[
                    ...serviceCatalog.map((s) => ({ id: `service:${s.id}`, realId: s.id, type: 'service' as const, name: s.name, price: s.base_cost })),
                    ...partCatalog.map((p) => ({ id: `part:${p.id}`, realId: p.id, type: 'part' as const, name: p.name, price: p.unit_cost, sku: p.sku }))
                  ]}
                  value={selectedItemId && selectedItemType ? `${selectedItemType}:${selectedItemId}` : ''}
                  onChange={(compositeId) => {
                    const [type, realId] = compositeId.split(':');
                    setSelectedItemType(type === 'service' ? 'service' : 'part');
                    setSelectedItemId(realId ?? '');
                  }}
                  getLabel={(item) => item.name}
                  getSubLabel={(item) => `${item.type === 'part' ? (item as any).sku + ' · ' : ''}₹${item.price} ${item.type === 'service' ? '(Service)' : '(Part)'}`}
                  getSearchText={(item) => `${item.name} ${item.type === 'part' ? (item as any).sku ?? '' : ''}`}
                  placeholder="Search services or parts (by name or part no)..."
                  onAddNew={(query) => {
                    setQuickItemName(query);
                    setShowQuickCreateItem(true);
                  }}
                  addNewLabel="New service/part"
                />

                {showQuickCreateItem && (
                  <div className="bg-slate-950 border border-amber-900/50 rounded-xl p-3 space-y-3 animate-fadeIn">
                    <div className="flex gap-2">
                      {(['service', 'part'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setQuickItemType(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-all ${
                            quickItemType === t ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={quickItemName}
                        onChange={(e) => setQuickItemName(e.target.value)}
                        placeholder={quickItemType === 'service' ? 'Service name' : 'Part name'}
                        disabled={quickItemSubmitting}
                        className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none disabled:opacity-50"
                      />
                      {quickItemType === 'part' && (
                        <input
                          value={quickItemSku}
                          onChange={(e) => setQuickItemSku(e.target.value)}
                          placeholder="Part no / SKU"
                          disabled={quickItemSubmitting}
                          className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none disabled:opacity-50"
                        />
                      )}
                      <input
                        type="number"
                        value={quickItemPrice}
                        onChange={(e) => setQuickItemPrice(e.target.value)}
                        placeholder={quickItemType === 'service' ? 'Base cost (₹)' : 'Unit cost (₹)'}
                        min="0"
                        disabled={quickItemSubmitting}
                        className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none disabled:opacity-50"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      This also creates a permanent entry in your {quickItemType === 'service' ? 'Services' : 'Parts'} catalog —
                      not just for this job.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleQuickCreateItem}
                        disabled={quickItemSubmitting || !quickItemName.trim() || (quickItemType === 'part' && !quickItemSku.trim())}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {quickItemSubmitting ? 'Creating...' : 'Create & Add to Job'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickCreateItem(false)}
                        className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Qty</label>
                    <input
                      type="number"
                      value={addItemQty}
                      onChange={(e) => setAddItemQty(e.target.value)}
                      min="1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddItem}
                    disabled={!selectedItemId}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50 mt-5"
                  >
                    Add to Job
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Services */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-amber-500" /> Services
            </h2>
          </div>
          {job.status === 'completed' && canEditCompleted && (
            <div className="px-4 py-2 bg-amber-950/20 text-amber-300 text-xs border-b border-slate-800">
              Editing a completed job — changes will update the invoice too.
            </div>
          )}
          {services.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No services added yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {services.map((s) => (
                <div key={s.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300 truncate">{s.service_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditLineItems && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateQty('service', s.id, s.qty - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 cursor-pointer text-xs"
                        >
                          −
                        </button>
                        <span className="text-xs text-slate-500 w-4 text-center">{s.qty}</span>
                        <button
                          onClick={() => handleUpdateQty('service', s.id, s.qty + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 cursor-pointer text-xs"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <span className="font-mono text-amber-500">₹{(s.qty * s.unit_cost).toLocaleString()}</span>
                    {canEditLineItems && (
                      <button
                        onClick={() => handleDeleteLineItem('service', s.id)}
                        className="text-slate-600 hover:text-red-400 cursor-pointer p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
          </div>
          {parts.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No parts added yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {parts.map((p) => (
                <div key={p.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300 truncate">{p.part_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditLineItems && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateQty('part', p.id, p.qty - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 cursor-pointer text-xs"
                        >
                          −
                        </button>
                        <span className="text-xs text-slate-500 w-4 text-center">{p.qty}</span>
                        <button
                          onClick={() => handleUpdateQty('part', p.id, p.qty + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 cursor-pointer text-xs"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <span className="font-mono text-amber-500">₹{(p.qty * p.unit_cost).toLocaleString()}</span>
                    {canEditLineItems && (
                      <button
                        onClick={() => handleDeleteLineItem('part', p.id)}
                        className="text-slate-600 hover:text-red-400 cursor-pointer p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
              <div key={log.id} className="p-3 px-4 text-xs text-slate-400 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <span className="min-w-0">{log.note || `${log.old_status ?? 'created'} → ${log.new_status}`}</span>
                <span className="font-mono text-slate-600 shrink-0">{new Date(log.changed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
