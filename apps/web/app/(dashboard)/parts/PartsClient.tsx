'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, IndianRupee, Search, Pencil, Ban, RotateCcw } from 'lucide-react';
import FAB from '@/components/FAB';

const UNIT_OPTIONS = ['piece', 'litre', 'kg', 'meter', 'box', 'set', 'pair'];
const CATEGORY_OPTIONS = ['general', 'engine', 'brakes', 'electrical', 'body', 'suspension', 'tyres', 'fluids', 'filters'];

interface Part {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  supplier_id: string | null;
  supplier_name: string | null;
  unit_cost: number;
  discount_percent: number;
  hsn_sac_code: string;
  unit: string;
  is_active: boolean;
}
interface Supplier {
  id: string;
  name: string;
}

export default function PartsClient({
  initialParts,
  suppliers,
  canManage
}: {
  initialParts: Part[];
  suppliers: Supplier[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const parts = initialParts;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [supplierId, setSupplierId] = useState('');
  const [hsnSacCode, setHsnSacCode] = useState('');
  const [unit, setUnit] = useState('piece');
  const [category, setCategory] = useState('general');

  function resetForm() {
    setName('');
    setSku('');
    setUnitCost('');
    setDiscountPercent('0');
    setSupplierId('');
    setHsnSacCode('');
    setUnit('piece');
    setCategory('general');
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(p: Part) {
    setEditingId(p.id);
    setName(p.name);
    setSku(p.sku);
    setUnitCost(String(p.unit_cost));
    setDiscountPercent(String(p.discount_percent ?? 0));
    setSupplierId(p.supplier_id ?? '');
    setHsnSacCode(p.hsn_sac_code ?? '');
    setUnit(p.unit || 'piece');
    setCategory(p.category || 'general');
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      name,
      sku,
      unitCost: Number(unitCost),
      discountPercent: Number(discountPercent) || 0,
      supplierId: supplierId || null,
      hsnSacCode,
      unit,
      category
    };

    const res = editingId
      ? await fetch(`/api/parts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch('/api/parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save part.');
      setSubmitting(false);
      return;
    }

    resetForm();
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleToggleActive(p: Part) {
    setError(null);
    const res = await fetch(`/api/parts/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.is_active })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update part.');
      return;
    }
    startTransition(() => router.refresh());
  }

  const categoriesInUse = [...new Set(parts.map((p) => p.category).filter(Boolean))].sort();

  const visibleParts = parts.filter((p) => showInactive || p.is_active);
  const filteredParts = visibleParts.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-500" />
              Parts Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">Spare parts you stock, with SKU, vendor, and pricing.</p>
          </div>
          {canManage && (
            <button
              onClick={() => (showForm && !editingId ? resetForm() : (resetForm(), setShowForm(true)))}
              className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              New Part
            </button>
          )}
        </div>
        {canManage && (
          <FAB onClick={() => (showForm && !editingId ? resetForm() : (resetForm(), setShowForm(true)))} label="New Part" />
        )}

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or part number..."
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
            />
          </div>
          {categoriesInUse.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900/80 border border-slate-800 rounded-xl py-2.5 px-3 text-sm outline-none text-slate-300"
            >
              <option value="">All categories</option>
              {categoriesInUse.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          )}
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
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Part No / SKU</label>
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
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Unit of Measure</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 capitalize"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u} className="capitalize">
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 capitalize"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">HSN Code (optional)</label>
                <input
                  value={hsnSacCode}
                  onChange={(e) => setHsnSacCode(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. 8708"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Vendor / Supplier (optional)</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                >
                  <option value="">No vendor set</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1.5">
                    No suppliers yet —{' '}
                    <a href="/suppliers" className="underline">
                      add one
                    </a>{' '}
                    to link this part to a vendor.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Part'}
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
          {visibleParts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No parts yet — add your first one above.</div>
          ) : filteredParts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No parts match your search/filter.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredParts.map((p) => (
                <div key={p.id} className={`p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all ${!p.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                      {p.name}
                      {!p.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">Inactive</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                      {p.sku} {p.supplier_name && `· ${p.supplier_name}`} {p.discount_percent > 0 && `· ${p.discount_percent}% off`}
                      {p.hsn_sac_code && ` · HSN ${p.hsn_sac_code}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-0.5 text-amber-500 font-semibold font-mono text-sm">
                      <IndianRupee className="w-3.5 h-3.5" /> {p.unit_cost.toLocaleString()}
                      <span className="text-slate-500 font-normal text-xs">/{p.unit || 'piece'}</span>
                    </span>
                    {canManage && (
                      <>
                        <button onClick={() => startEdit(p)} className="text-slate-500 hover:text-amber-400 cursor-pointer p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer p-1"
                          title={p.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {p.is_active ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
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
