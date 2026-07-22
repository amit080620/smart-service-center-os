'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, IndianRupee } from 'lucide-react';

interface Part {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  supplier: string;
  unit_cost: number;
}

export default function PartsClient({ initialParts }: { initialParts: Part[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const parts = initialParts;
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sku, unitCost: Number(unitCost), supplier })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add part.');
      setSubmitting(false);
      return;
    }

    setName('');
    setSku('');
    setUnitCost('');
    setSupplier('');
    setShowForm(false);
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-500" />
              Parts Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">Spare parts you stock, with SKU and pricing.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            New Part
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Part Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Brake Pad Set"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">SKU</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="BRK-001"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Unit Cost (₹)</label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                  min="0"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Supplier (optional)</label>
                <input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
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
              {submitting ? 'Saving...' : 'Save Part'}
            </button>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {parts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No parts yet — add your first one above.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {parts.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                      {p.sku} {p.supplier && `· ${p.supplier}`}
                    </div>
                  </div>
                  <span className="flex items-center gap-0.5 text-amber-500 font-semibold font-mono text-sm shrink-0">
                    <IndianRupee className="w-3.5 h-3.5" /> {p.unit_cost.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
