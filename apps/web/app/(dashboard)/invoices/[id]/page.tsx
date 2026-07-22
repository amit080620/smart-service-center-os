'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Receipt, IndianRupee, Wrench, Package } from 'lucide-react';

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  job_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  vehicle_label: string;
  plate_number: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  due_date: string;
}
interface LineItem {
  id: string;
  name: string;
  qty: number;
  unit_cost: number;
}
interface Payment {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque'
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [services, setServices] = useState<LineItem[]>([]);
  const [parts, setParts] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');

  async function loadAll() {
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}`);
    if (res.ok) {
      const data = await res.json();
      setInvoice(data.invoice);
      setServices(data.services);
      setParts(data.parts);
      setPayments(data.payments);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), method })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not record payment.');
      setSubmitting(false);
      return;
    }

    setAmount('');
    setSubmitting(false);
    loadAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-3xl mx-auto text-center text-slate-500 font-mono text-sm">Loading...</div>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-3xl mx-auto text-center text-slate-500 text-sm">Invoice not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-amber-500" />
              {invoice.invoice_number}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {invoice.customer_name} · {invoice.vehicle_label} ({invoice.plate_number}) · Job {invoice.job_number}
            </p>
          </div>
          <span
            className={`text-sm px-3 py-1.5 rounded-full font-medium ${
              invoice.status === 'paid' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
            }`}
          >
            {invoice.status === 'paid' ? 'Paid in Full' : 'Unpaid'}
          </span>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {/* Line items */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {services.length > 0 && (
            <div className="p-4 border-b border-slate-800/50">
              <div className="text-xs font-mono text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Services
              </div>
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm py-1">
                  <span className="text-slate-300 truncate">{s.name}</span>
                  <span className="font-mono text-slate-400 shrink-0">₹{(s.qty * s.unit_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {parts.length > 0 && (
            <div className="p-4 border-b border-slate-800/50">
              <div className="text-xs font-mono text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Package className="w-3 h-3" /> Parts
              </div>
              {parts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm py-1">
                  <span className="text-slate-300 truncate">
                    {p.name} <span className="text-slate-500 text-xs">×{p.qty}</span>
                  </span>
                  <span className="font-mono text-slate-400 shrink-0">₹{(p.qty * p.unit_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">₹{invoice.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GST</span>
              <span className="font-mono">₹{invoice.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold text-amber-500 pt-1.5 border-t border-slate-800">
              <span>Total</span>
              <span className="font-mono flex items-center gap-0.5">
                <IndianRupee className="w-3.5 h-3.5" /> {invoice.total.toLocaleString()}
              </span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-emerald-400 text-xs">
                <span>Paid</span>
                <span className="font-mono">₹{invoice.amount_paid.toLocaleString()}</span>
              </div>
            )}
            {invoice.balance_due > 0 && (
              <div className="flex justify-between text-red-400 text-xs">
                <span>Balance Due</span>
                <span className="font-mono">₹{invoice.balance_due.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Record payment */}
        {invoice.balance_due > 0 && (
          <form
            onSubmit={handleRecordPayment}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-end gap-3 flex-wrap"
          >
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0.01"
                max={invoice.balance_due}
                step="0.01"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={submitting}
                className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </form>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 text-xs font-mono text-slate-500 uppercase">
              Payment History
            </div>
            <div className="divide-y divide-slate-800/50">
              {payments.map((p) => (
                <div key={p.id} className="p-3 px-4 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{METHOD_LABELS[p.method] ?? p.method}</span>
                  <div className="text-right">
                    <div className="font-mono text-emerald-400">₹{p.amount.toLocaleString()}</div>
                    <div className="text-xs text-slate-600">{new Date(p.paid_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
