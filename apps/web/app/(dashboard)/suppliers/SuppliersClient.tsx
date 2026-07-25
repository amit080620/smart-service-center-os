'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Plus, IndianRupee, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react';
import FAB from '@/components/FAB';
import SearchableSelect from '@/components/SearchableSelect';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  total_pending: number;
  bill_count: number;
}
interface BillItem {
  id: string;
  part_id: string;
  part_name: string;
  sku: string;
  qty: number;
  unit_cost: number;
}
interface Bill {
  id: string;
  supplier_id: string;
  bill_number: string;
  amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  bill_date: string;
  notes: string;
  items: BillItem[];
}
interface Part {
  id: string;
  name: string;
  sku: string;
  unit_cost: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque'
};

export default function SuppliersClient({
  initialSuppliers,
  initialBills,
  parts,
  canManage
}: {
  initialSuppliers: Supplier[];
  initialBills: Bill[];
  parts: Part[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const suppliers = initialSuppliers;
  const bills = initialBills;

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [showBillForm, setShowBillForm] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  // The bill being drafted: a running "cart" of parts + qty + cost —
  // added one at a time, but the whole bill is saved in a single
  // request once. This replaces the old one-item-per-submit flow that
  // made recording a multi-part delivery painfully slow.
  const [draftItems, setDraftItems] = useState<Array<{ partId: string; partName: string; sku: string; qty: string; unitCost: string }>>([]);
  const [draftPartId, setDraftPartId] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftUnitCost, setDraftUnitCost] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billNotes, setBillNotes] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  function startEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setName(s.name);
    setContactPhone(s.contact_phone);
    setAddress(s.address);
    setShowSupplierForm(true);
  }

  function resetSupplierForm() {
    setName('');
    setContactPhone('');
    setAddress('');
    setShowSupplierForm(false);
    setEditingSupplierId(null);
  }

  async function handleSubmitSupplier(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = { name, contactPhone, address };
    const res = editingSupplierId
      ? await fetch(`/api/suppliers/${editingSupplierId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save supplier.');
      setSubmitting(false);
      return;
    }
    resetSupplierForm();
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  function handleAddDraftItem() {
    const part = parts.find((p) => p.id === draftPartId);
    if (!part) return;
    setDraftItems((prev) => [
      ...prev,
      { partId: part.id, partName: part.name, sku: part.sku, qty: draftQty, unitCost: draftUnitCost || String(part.unit_cost) }
    ]);
    setDraftPartId('');
    setDraftQty('1');
    setDraftUnitCost('');
  }

  function handleRemoveDraftItem(index: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  }

  function resetBillForm() {
    setDraftItems([]);
    setDraftPartId('');
    setDraftQty('1');
    setDraftUnitCost('');
    setBillNumber('');
    setBillNotes('');
    setShowBillForm(null);
  }

  async function handleSaveBill(supplierId: string) {
    setError(null);
    setSubmitting(true);
    const res = await fetch('/api/supplier-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        billNumber,
        notes: billNotes,
        items: draftItems.map((i) => ({ partId: i.partId, qty: Number(i.qty) || 0, unitCost: Number(i.unitCost) || 0 }))
      })
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not record bill.');
      return;
    }
    resetBillForm();
    startTransition(() => router.refresh());
  }

  async function handleRecordPayment(billId: string) {
    setError(null);
    const res = await fetch(`/api/supplier-bills/${billId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(paymentAmount), method: paymentMethod })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not record payment.');
      return;
    }
    setPaymentAmount('');
    setPaymentMethod('cash');
    setShowPaymentForm(null);
    startTransition(() => router.refresh());
  }

  const totalOwed = suppliers.reduce((sum, s) => sum + s.total_pending, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Truck className="w-6 h-6 text-amber-500" />
              Suppliers
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Parts suppliers and wholesalers — bills and payments you owe them.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => (showSupplierForm ? resetSupplierForm() : (resetSupplierForm(), setShowSupplierForm(true)))}
              className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              New Supplier
            </button>
          )}
        </div>
        {canManage && (
          <FAB
            onClick={() => (showSupplierForm ? resetSupplierForm() : (resetSupplierForm(), setShowSupplierForm(true)))}
            label="New Supplier"
          />
        )}

        {totalOwed > 0 && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-red-200 text-sm">Total pending across all suppliers</span>
            <span className="text-red-300 font-bold font-mono">₹{totalOwed.toLocaleString('en-IN')}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {showSupplierForm && (
          <form
            onSubmit={handleSubmitSupplier}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Supplier Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="ABC Auto Parts Wholesale"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Phone</label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Address (optional)</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                {submitting ? 'Saving...' : editingSupplierId ? 'Save Changes' : 'Save Supplier'}
              </button>
              <button
                type="button"
                onClick={resetSupplierForm}
                className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={`space-y-3 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {suppliers.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
              No suppliers yet — add your first one above.
            </div>
          ) : (
            suppliers.map((s) => {
              const supplierBills = bills.filter((b) => b.supplier_id === s.id);
              const isExpanded = expandedSupplier === s.id;
              return (
                <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="w-full p-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200 truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {s.contact_phone} {s.bill_count > 0 && `· ${s.bill_count} bill${s.bill_count === 1 ? '' : 's'}`}
                      </div>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.total_pending > 0 ? (
                        <span className="font-mono text-red-400 font-semibold">₹{s.total_pending.toLocaleString('en-IN')} due</span>
                      ) : (
                        <span className="text-xs text-emerald-400">Settled</span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => startEditSupplier(s)}
                          className="text-slate-500 hover:text-amber-400 cursor-pointer p-1"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedSupplier(isExpanded ? null : s.id)} className="cursor-pointer">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-3">
                      {canManage && (
                        <button
                          onClick={() => (showBillForm === s.id ? resetBillForm() : (resetBillForm(), setShowBillForm(s.id)))}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Record New Bill
                        </button>
                      )}

                      {showBillForm === s.id && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Part</label>
                              <SearchableSelect
                                items={parts}
                                value={draftPartId}
                                onChange={(id) => {
                                  setDraftPartId(id);
                                  const p = parts.find((x) => x.id === id);
                                  if (p) setDraftUnitCost(String(p.unit_cost));
                                }}
                                getLabel={(p) => p.name}
                                getSubLabel={(p) => p.sku}
                                getSearchText={(p) => `${p.name} ${p.sku}`}
                                placeholder="Search part..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Qty</label>
                              <input
                                type="number"
                                value={draftQty}
                                onChange={(e) => setDraftQty(e.target.value)}
                                min="1"
                                className="w-16 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2 text-sm outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Cost (₹)</label>
                              <input
                                type="number"
                                value={draftUnitCost}
                                onChange={(e) => setDraftUnitCost(e.target.value)}
                                min="0"
                                className="w-20 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2 text-sm outline-none"
                              />
                            </div>
                            <button
                              onClick={handleAddDraftItem}
                              disabled={!draftPartId}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              + Add Item
                            </button>
                          </div>

                          {draftItems.length > 0 && (
                            <div className="bg-slate-900 rounded-lg divide-y divide-slate-800">
                              {draftItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                                  <span className="text-slate-300 truncate">
                                    {item.partName} <span className="text-slate-500 text-xs">×{item.qty}</span>
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-amber-500">₹{(Number(item.qty) * Number(item.unitCost)).toLocaleString('en-IN')}</span>
                                    <button onClick={() => handleRemoveDraftItem(idx)} className="text-slate-600 hover:text-red-400 cursor-pointer">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                                <span className="text-slate-400">Bill Total</span>
                                <span className="font-mono text-amber-400">
                                  ₹{draftItems.reduce((sum, i) => sum + Number(i.qty) * Number(i.unitCost), 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-end gap-2 flex-wrap">
                            <div>
                              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Bill/Invoice #</label>
                              <input
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                                placeholder="optional"
                                className="w-32 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                              />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Notes</label>
                              <input
                                value={billNotes}
                                onChange={(e) => setBillNotes(e.target.value)}
                                placeholder="optional"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                              />
                            </div>
                            <button
                              onClick={() => handleSaveBill(s.id)}
                              disabled={submitting || draftItems.length === 0}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {submitting ? 'Saving...' : 'Save Bill'}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">Saving this bill also adds these quantities to your Inventory automatically.</p>
                        </div>
                      )}

                      {supplierBills.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs py-3">No bills recorded yet.</div>
                      ) : (
                        <div className="divide-y divide-slate-800/50">
                          {supplierBills.map((b) => (
                            <div key={b.id} className="py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm text-slate-300">
                                    {b.bill_number || 'No bill #'}{' '}
                                    <span className="text-xs text-slate-500">
                                      · {new Date(b.bill_date).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                  {b.notes && <div className="text-xs text-slate-500 truncate">{b.notes}</div>}
                                  {b.items.length > 0 && (
                                    <div className="text-xs text-slate-600 truncate">
                                      {b.items.map((i) => `${i.part_name} ×${i.qty}`).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono text-sm text-slate-200">₹{b.amount.toLocaleString('en-IN')}</div>
                                  {b.balance_due > 0 ? (
                                    <div className="text-xs text-red-400">₹{b.balance_due.toLocaleString('en-IN')} due</div>
                                  ) : (
                                    <div className="text-xs text-emerald-400">Paid</div>
                                  )}
                                </div>
                              </div>
                              {canManage && b.balance_due > 0 && (
                                <div className="mt-2">
                                  {showPaymentForm === b.id ? (
                                    <div className="flex items-end gap-2 flex-wrap">
                                      <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        min="0.01"
                                        max={b.balance_due}
                                        placeholder="Amount"
                                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs outline-none"
                                      />
                                      <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs outline-none"
                                      >
                                        {Object.entries(METHOD_LABELS).map(([v, l]) => (
                                          <option key={v} value={v}>
                                            {l}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleRecordPayment(b.id)}
                                        disabled={!paymentAmount}
                                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                                      >
                                        Pay
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowPaymentForm(b.id)}
                                      className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                                    >
                                      <IndianRupee className="w-3 h-3" /> Record Payment
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
