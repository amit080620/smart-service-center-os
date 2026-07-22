'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Wrench, Plus, Clock, IndianRupee } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  base_cost: number;
  est_duration_minutes: number;
  category: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [duration, setDuration] = useState('60');
  const [category, setCategory] = useState('general');

  async function loadServices() {
    setLoading(true);
    const res = await fetch('/api/services');
    if (res.ok) setServices(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        baseCost: Number(baseCost),
        estDurationMinutes: Number(duration),
        category
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add service.');
      setSubmitting(false);
      return;
    }

    setName('');
    setDescription('');
    setBaseCost('');
    setDuration('60');
    setCategory('general');
    setShowForm(false);
    setSubmitting(false);
    loadServices();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-500" />
              Services Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">Repair and maintenance services you offer, with pricing.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            New Service
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            {error && (
              <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
            )}
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
            <div className="grid grid-cols-2 gap-4">
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
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Service'}
            </button>
          </form>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-mono">Loading...</div>
          ) : services.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No services yet — add your first one above.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {services.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-all">
                  <div>
                    <div className="font-semibold text-slate-200">{s.name}</div>
                    {s.description && <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>}
                  </div>
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" /> {s.est_duration_minutes}m
                    </span>
                    <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                      <IndianRupee className="w-3.5 h-3.5" /> {s.base_cost.toLocaleString()}
                    </span>
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