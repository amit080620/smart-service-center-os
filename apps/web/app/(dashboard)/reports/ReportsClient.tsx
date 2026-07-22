'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Printer, IndianRupee, ClipboardList, Boxes, Receipt } from 'lucide-react';

interface ReportData {
  fromDate: string;
  toDate: string;
  orgName: string;
  branchName: string;
  payments: Array<{ id: string; amount: number; method: string; paid_at: string; invoice_number: string }>;
  paymentsTotal: number;
  invoices: Array<{
    id: string;
    invoice_number: string;
    total: number;
    amount_paid: number;
    balance_due: number;
    status: string;
    created_at: string;
  }>;
  invoicesTotal: number;
  outstandingTotal: number;
  jobsCreated: Array<{ id: string; job_number: string; status: string; label: string; created_at: string }>;
  jobsCompleted: Array<{ id: string; job_number: string; final_cost: number; label: string; completed_at: string | null }>;
  inventoryTx: Array<{ id: string; type: string; qty: number; part_name: string; sku: string; notes: string; created_at: string }>;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque'
};

export default function ReportsClient({ report }: { report: ReportData }) {
  const router = useRouter();
  const [from, setFrom] = useState(report.fromDate);
  const [to, setTo] = useState(report.toDate);

  function applyRange() {
    router.push(`/reports?from=${from}&to=${to}`);
  }

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setFrom(today);
    setTo(today);
    router.push(`/reports?from=${today}&to=${today}`);
  }

  function setThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    setFrom(first);
    setTo(today);
    router.push(`/reports?from=${first}&to=${today}`);
  }

  const sameDay = report.fromDate === report.toDate;
  const rangeLabel = sameDay
    ? new Date(report.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : `${new Date(report.fromDate).toLocaleDateString('en-IN')} — ${new Date(report.toDate).toLocaleDateString('en-IN')}`;

  return (
    <div className="min-h-screen bg-slate-950 print:bg-white text-slate-100 print:text-black p-6 sm:p-8 print:p-4">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        {/* Header + controls (controls hidden in print) */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2 print:text-black">
              <BarChart3 className="w-6 h-6 text-amber-500 print:hidden" />
              Reports
            </h1>
            <p className="text-sm text-slate-500 print:text-gray-600 mt-1">
              {report.orgName} · {report.branchName} · {rangeLabel}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>

        <div className="print:hidden bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm outline-none"
            />
          </div>
          <button
            onClick={applyRange}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
          >
            Apply
          </button>
          <button
            onClick={setToday}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={setThisMonth}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg cursor-pointer"
          >
            This Month
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase">Payments In</div>
            <div className="text-emerald-400 print:text-black font-bold text-lg mt-1">
              ₹{report.paymentsTotal.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-slate-900/60 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase">Invoiced</div>
            <div className="text-amber-500 print:text-black font-bold text-lg mt-1">
              ₹{report.invoicesTotal.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-slate-900/60 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase">Outstanding</div>
            <div className="text-red-400 print:text-black font-bold text-lg mt-1">
              ₹{report.outstandingTotal.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-slate-900/60 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase">Jobs Done</div>
            <div className="text-slate-200 print:text-black font-bold text-lg mt-1">{report.jobsCompleted.length}</div>
          </div>
        </div>

        {/* Payments received */}
        <ReportSection
          icon={<IndianRupee className="w-4 h-4 text-emerald-400 print:hidden" />}
          title={`Payments Received (${report.payments.length})`}
        >
          {report.payments.length === 0 ? (
            <EmptyRow text="No payments in this period." />
          ) : (
            report.payments.map((p) => (
              <div key={p.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="text-slate-300 print:text-black">{p.invoice_number}</span>
                  <span className="text-slate-500 print:text-gray-600 text-xs ml-2">
                    {METHOD_LABELS[p.method] ?? p.method} · {new Date(p.paid_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="font-mono text-emerald-400 print:text-black shrink-0">
                  ₹{p.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))
          )}
        </ReportSection>

        {/* Invoices raised */}
        <ReportSection
          icon={<Receipt className="w-4 h-4 text-amber-500 print:hidden" />}
          title={`Invoices Raised (${report.invoices.length})`}
        >
          {report.invoices.length === 0 ? (
            <EmptyRow text="No invoices in this period." />
          ) : (
            report.invoices.map((i) => (
              <div key={i.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="text-slate-300 print:text-black">{i.invoice_number}</span>
                  <span
                    className={`text-xs ml-2 ${i.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'} print:text-gray-600`}
                  >
                    {i.status === 'paid' ? 'Paid' : `Due ₹${i.balance_due.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <span className="font-mono text-slate-300 print:text-black shrink-0">
                  ₹{i.total.toLocaleString('en-IN')}
                </span>
              </div>
            ))
          )}
        </ReportSection>

        {/* Jobs */}
        <ReportSection
          icon={<ClipboardList className="w-4 h-4 text-amber-500 print:hidden" />}
          title={`Job Cards — Created (${report.jobsCreated.length}) / Completed (${report.jobsCompleted.length})`}
        >
          {report.jobsCreated.length === 0 && report.jobsCompleted.length === 0 ? (
            <EmptyRow text="No job card activity in this period." />
          ) : (
            <>
              {report.jobsCompleted.map((j) => (
                <div key={`c-${j.id}`} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="text-slate-300 print:text-black">{j.job_number}</span>
                    <span className="text-emerald-400 print:text-gray-600 text-xs ml-2">Completed</span>
                    <span className="text-slate-500 print:text-gray-600 text-xs ml-2 truncate">{j.label}</span>
                  </div>
                  <span className="font-mono text-slate-300 print:text-black shrink-0">
                    ₹{j.final_cost.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              {report.jobsCreated.map((j) => (
                <div key={`n-${j.id}`} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="text-slate-300 print:text-black">{j.job_number}</span>
                    <span className="text-slate-500 print:text-gray-600 text-xs ml-2">New · {j.status}</span>
                    <span className="text-slate-500 print:text-gray-600 text-xs ml-2 truncate">{j.label}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </ReportSection>

        {/* Inventory movements */}
        <ReportSection
          icon={<Boxes className="w-4 h-4 text-amber-500 print:hidden" />}
          title={`Inventory Movements (${report.inventoryTx.length})`}
        >
          {report.inventoryTx.length === 0 ? (
            <EmptyRow text="No inventory movements in this period." />
          ) : (
            report.inventoryTx.map((t) => (
              <div key={t.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 truncate">
                  <span className="text-slate-300 print:text-black">{t.part_name}</span>
                  <span className="text-slate-500 print:text-gray-600 text-xs ml-2">
                    {t.type}
                    {t.notes ? ` · ${t.notes}` : ''} · {new Date(t.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <span
                  className={`font-mono shrink-0 ${t.qty >= 0 ? 'text-emerald-400' : 'text-red-400'} print:text-black`}
                >
                  {t.qty >= 0 ? '+' : ''}
                  {t.qty}
                </span>
              </div>
            ))
          )}
        </ReportSection>
      </div>
    </div>
  );
}

function ReportSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/60 print:bg-white border border-slate-800 print:border-gray-300 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 print:border-gray-300">
        <h2 className="font-semibold flex items-center gap-2 text-sm print:text-black">
          {icon}
          {title}
        </h2>
      </div>
      <div className="divide-y divide-slate-800/50 print:divide-gray-200">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="p-4 text-center text-slate-500 print:text-gray-500 text-xs">{text}</div>;
}
