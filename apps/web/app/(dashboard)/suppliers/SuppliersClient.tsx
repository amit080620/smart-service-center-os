'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Plus, IndianRupee, ChevronDown, ChevronUp } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  total_pending: number;
  bill_count: number;
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
  canManage
}: {
  initialSuppliers: Supplier[];
  initialBills: Bill[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const suppliers = initialSuppliers;
  const bills = initialBills;

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [showBillForm, setShowBillForm] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  const [billAmount, setBillAmount] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billNotes, setBillNotes] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  async function handleAddSupplier(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contactPhone, address })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add supplier.');
      setSubmitting(false);
      return;
    }
    setName('');
    setContactPhone('');
    setAddress('');
    setShowSupplierForm(false);
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleAddBill(supplierId: string) {
    setError(null);
    const res = await fetch('/api/supplier-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, amount: Number(billAmount), billNumber, notes: billNotes })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not record bill.');
      return;
    }
    setBillAmount('');
    setBillNumber('');
    setBillNotes('');
    setShowBillForm(null);
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
              onClick={() => setShowSupplierForm(!showSupplierForm)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              New Supplier
            </button>
          )}
        </div>

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
            onSubmit={handleAddSupplier}
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
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Supplier'}
            </button>
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
                  <button
                    onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}
                    className="w-full p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/40"
                  >
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-semibold text-slate-200 truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {s.contact_phone} {s.bill_count > 0 && `· ${s.bill_count} bill${s.bill_count === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.total_pending > 0 ? (
                        <span className="font-mono text-red-400 font-semibold">₹{s.total_pending.toLocaleString('en-IN')} due</span>
                      ) : (
                        <span className="text-xs text-emerald-400">Settled</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-3">
                      {canManage && (
                        <button
                          onClick={() => setShowBillForm(showBillForm === s.id ? null : s.id)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Record New Bill
                        </button>
                      )}

                      {showBillForm === s.id && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-end gap-2 flex-wrap">
                          <div>
                            <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Amount (₹)</label>
                            <input
                              type="number"
                              value={billAmount}
                              onChange={(e) => setBillAmount(e.target.value)}
                              min="0.01"
                              className="w-28 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                            />
                          </div>
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
                              placeholder="e.g. brake pads batch"
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
                            />
                          </div>
                          <button
                            onClick={() => handleAddBill(s.id)}
                            disabled={!billAmount}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
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
