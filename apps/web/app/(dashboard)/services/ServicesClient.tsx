'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Plus, Clock, IndianRupee, Search, Pencil, Ban, RotateCcw } from 'lucide-react';
import FAB from '@/components/FAB';

interface Service {
  id: string;
  name: string;
  description: string;
  base_cost: number;
  discount_percent: number;
  est_duration_minutes: number;
  category: string;
  is_active: boolean;
}

export default function ServicesClient({ initialServices, canManage }: { initialServices: Service[]; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const services = initialServices;
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [duration, setDuration] = useState('60');

  function resetForm() {
    setName('');
    setDescription('');
    setBaseCost('');
    setDiscountPercent('0');
    setDuration('60');
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description);
    setBaseCost(String(s.base_cost));
    setDiscountPercent(String(s.discount_percent ?? 0));
    setDuration(String(s.est_duration_minutes));
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      name,
      description,
      baseCost: Number(baseCost),
      discountPercent: Number(discountPercent) || 0,
      estDurationMinutes: Number(duration)
    };

    const res = editingId
      ? await fetch(`/api/services/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save service.');
      setSubmitting(false);
      return;
    }

    resetForm();
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleToggleActive(s: Service) {
    setError(null);
    const res = await fetch(`/api/services/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.is_active })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update service.');
      return;
    }
    startTransition(() => router.refresh());
  }

  const visibleServices = services.filter((s) => showInactive || s.is_active);
  const filteredServices = visibleServices.filter((s) => {
    if (!searchQuery.trim()) return true;
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-500" />
              Services Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">Repair and maintenance services you offer, with pricing.</p>
          </div>
          {canManage && (
            <button
              onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))}
              className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              New Service
            </button>
          )}
        </div>
        {canManage && (
          <FAB onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))} label="New Service" />
        )}

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`text-xs px-3 py-2 rounded-xl cursor-pointer ${showInactive ? 'bg-slate-700 text-slate-200' : 'bg-slate-900/80 text-slate-500'}`}
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Service Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
                placeholder="Oil Change"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Base Cost (₹)</label>
                <input
                  type="number"
                  value={baseCost}
                  onChange={(e) => setBaseCost(e.target.value)}
                  required
                  min="0"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Default Discount (%)</label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  min="0"
                  max="100"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Est. Duration (min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="0"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Service'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {visibleServices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No services yet — add your first one above.</div>
          ) : filteredServices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No services match "{searchQuery}".</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredServices.map((s) => (
                <div key={s.id} className={`p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all ${!s.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                      {s.name}
                      {!s.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">Inactive</span>}
                    </div>
                    {s.description && <div className="text-xs text-slate-500 mt-0.5 truncate">{s.description}</div>}
                    {s.discount_percent > 0 && <div className="text-xs text-emerald-400 mt-0.5">{s.discount_percent}% default discount</div>}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-mono shrink-0">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" /> {s.est_duration_minutes}m
                    </span>
                    <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                      <IndianRupee className="w-3.5 h-3.5" /> {s.base_cost.toLocaleString()}
                    </span>
                    {canManage && (
                      <>
                        <button onClick={() => startEdit(s)} className="text-slate-500 hover:text-amber-400 cursor-pointer p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(s)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer p-1"
                          title={s.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {s.is_active ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
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
