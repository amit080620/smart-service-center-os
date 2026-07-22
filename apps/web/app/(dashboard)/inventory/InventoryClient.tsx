'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Plus, AlertTriangle, Minus } from 'lucide-react';

interface InventoryRow {
  id: string;
  part_id: string;
  qty_on_hand: number;
  reorder_level: number;
  part_name: string;
  sku: string;
  low_stock: boolean;
}

interface PartOption {
  id: string;
  name: string;
  sku: string;
}

export default function InventoryClient({
  initialInventory,
  untrackedParts
}: {
  initialInventory: InventoryRow[];
  untrackedParts: PartOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inventory = initialInventory;
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [partId, setPartId] = useState('');
  const [qtyOnHand, setQtyOnHand] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('5');

  // Per-row adjust state — which row's adjust form is open, and its values.
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'received' | 'adjusted'>('received');
  const [adjustNotes, setAdjustNotes] = useState('');

  async function handleStartTracking(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partId,
        qtyOnHand: Number(qtyOnHand),
        reorderLevel: Number(reorderLevel)
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add to inventory.');
      setSubmitting(false);
      return;
    }

    setPartId('');
    setQtyOnHand('0');
    setReorderLevel('5');
    setShowForm(false);
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleAdjust(inventoryId: string) {
    setError(null);
    const qty = adjustType === 'received' ? Math.abs(Number(adjustQty)) : Number(adjustQty);
    const res = await fetch(`/api/inventory/${inventoryId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: adjustType, qty, notes: adjustNotes })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not adjust stock.');
      return;
    }

    setAdjustingId(null);
    setAdjustQty('');
    setAdjustNotes('');
    startTransition(() => router.refresh());
  }

  const lowStockCount = inventory.filter((i) => i.low_stock).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Boxes className="w-6 h-6 text-amber-500" />
              Inventory
            </h1>
            <p className="text-sm text-slate-500 mt-1">Stock levels for parts at your branch.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={untrackedParts.length === 0}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Track Part
          </button>
        </div>

        {lowStockCount > 0 && (
          <div className="bg-red-950/30 border border-red-900/50 text-red-200 text-sm rounded-xl p-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {lowStockCount} {lowStockCount === 1 ? 'part is' : 'parts are'} at or below reorder level.
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {showForm && (
          <form
            onSubmit={handleStartTracking}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Part</label>
              <select
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
                required
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="">Select a part from your catalog...</option>
                {untrackedParts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Current Stock</label>
                <input
                  type="number"
                  value={qtyOnHand}
                  onChange={(e) => setQtyOnHand(e.target.value)}
                  required
                  min="0"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Reorder Level</label>
                <input
                  type="number"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  required
                  min="0"
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !partId}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Start Tracking'}
            </button>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {inventory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No parts tracked yet — use "Track Part" to start monitoring stock for parts from your catalog.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {inventory.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                        {row.part_name}
                        {row.low_stock && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 font-medium shrink-0">
                            Low Stock
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                        {row.sku} · reorder at {row.reorder_level}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-mono font-semibold text-lg ${row.low_stock ? 'text-red-400' : 'text-amber-500'}`}
                      >
                        {row.qty_on_hand}
                      </span>
                      <button
                        onClick={() => {
                          setAdjustingId(adjustingId === row.id ? null : row.id);
                          setAdjustQty('');
                          setAdjustNotes('');
                          setAdjustType('received');
                        }}
                        className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Adjust
                      </button>
                    </div>
                  </div>

                  {adjustingId === row.id && (
                    <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-end gap-2 flex-wrap animate-fadeIn">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Type</label>
                        <select
                          value={adjustType}
                          onChange={(e) => setAdjustType(e.target.value as 'received' | 'adjusted')}
                          className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                        >
                          <option value="received">Received (+)</option>
                          <option value="adjusted">Adjustment (±)</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Qty</label>
                        <input
                          type="number"
                          value={adjustQty}
                          onChange={(e) => setAdjustQty(e.target.value)}
                          placeholder={adjustType === 'received' ? '10' : '-2'}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Note</label>
                        <input
                          value={adjustNotes}
                          onChange={(e) => setAdjustNotes(e.target.value)}
                          placeholder="e.g. supplier delivery"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleAdjust(row.id)}
                        disabled={!adjustQty || Number(adjustQty) === 0}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
