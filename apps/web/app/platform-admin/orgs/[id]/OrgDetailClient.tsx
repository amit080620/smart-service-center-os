'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, IndianRupee, Phone } from 'lucide-react';

interface Org {
  id: string;
  name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
}
interface Transaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' }
];

export default function OrgDetailClient({ org, balance, transactions }: { org: Org; balance: number; transactions: Transaction[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRecharge(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const res = await fetch(`/api/platform-admin/orgs/${org.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), method, notes })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not recharge wallet.');
      setSubmitting(false);
      return;
    }

    setAmount('');
    setNotes('');
    setSuccess(true);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <a href="/platform-admin" className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> All Organizations
        </a>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">{org.name}</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              {org.contact_phone && (
                <a href={`tel:${org.contact_phone}`} className="flex items-center gap-1 hover:text-amber-400">
                  <Phone className="w-3.5 h-3.5" /> {org.contact_phone}
                </a>
              )}
              {org.contact_email && <span>{org.contact_email}</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-slate-500 uppercase">Current Balance</div>
            <div className={`text-3xl font-bold ${balance < 0 ? 'text-red-400' : 'text-amber-500'}`}>₹{balance.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <form onSubmit={handleRecharge} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-amber-500" /> Record Recharge
          </h2>
          {error && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>}
          {success && <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs rounded-xl p-3">Recharge recorded.</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0.01"
                step="0.01"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Received Via</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !amount}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add Credit'}
          </button>
        </form>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold text-sm">Transaction History</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No wallet activity yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {transactions.map((t) => (
                <div key={t.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-300 truncate">{t.reason}</span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(t.created_at).toLocaleString('en-IN')} · Balance after: ₹{t.balance_after}
                    </div>
                  </div>
                  <span className={`font-mono font-semibold shrink-0 ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.type === 'credit' ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
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
