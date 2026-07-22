'use client';

import { useEffect, useState } from 'react';
import { Receipt, IndianRupee } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  job_number: string;
  customer_name: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  due_date: string;
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-amber-900/50 text-amber-300',
  paid: 'bg-emerald-900/50 text-emerald-300',
  voided: 'bg-slate-700 text-slate-300'
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/invoices')
      .then((res) => (res.ok ? res.json() : []))
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">GST invoices generated from completed job cards.</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-mono">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No invoices yet — invoices are generated automatically when a job card is completed.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {invoices.map((inv) => (
                <a
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-500 font-semibold text-sm">{inv.invoice_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status] ?? 'bg-slate-700 text-slate-200'}`}>
                        {inv.status === 'paid' ? 'Paid' : inv.status === 'sent' ? 'Unpaid' : inv.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mt-1">
                      {inv.customer_name} · {inv.job_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-500 font-semibold font-mono flex items-center gap-0.5 justify-end">
                      <IndianRupee className="w-3.5 h-3.5" /> {inv.total.toLocaleString()}
                    </div>
                    {inv.balance_due > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">₹{inv.balance_due.toLocaleString()} due</div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
