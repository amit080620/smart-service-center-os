'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Printer,
  IndianRupee,
  ClipboardList,
  Boxes,
  Receipt,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Trophy,
  Settings2
} from 'lucide-react';

interface ReportData {
  fromDate: string;
  toDate: string;
  orgName: string;
  branchName: string;
  payments: Array<{ id: string; amount: number; method: string; paid_at: string; invoice_number: string }>;
  paymentsTotal: number;
  paymentsChangePct: number | null;
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
  revenueChangePct: number | null;
  outstandingTotal: number;
  jobsCreated: Array<{ id: string; job_number: string; status: string; label: string; created_at: string }>;
  jobsCompleted: Array<{ id: string; job_number: string; final_cost: number; label: string; completed_at: string | null }>;
  avgJobValue: number;
  inventoryTx: Array<{ id: string; type: string; qty: number; part_name: string; sku: string; notes: string; created_at: string }>;
  workerStats: Array<{
    id: string;
    name: string;
    jobCount: number;
    revenue: number;
    jobs: Array<{ id: string; job_number: string; label: string; final_cost: number }>;
  }>;
  unassignedCompletedCount: number;
  topServices: Array<{ name: string; revenue: number }>;
  topParts: Array<{ name: string; revenue: number }>;
  topCustomers: Array<{ name: string; spend: number }>;
  revenueTrend: Array<{ date: string; revenue: number; jobCount: number }>;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque'
};

type SectionKey = 'trend' | 'topPerformers' | 'payments' | 'invoices' | 'jobs' | 'workers' | 'inventory';

const SECTION_LABELS: Record<SectionKey, string> = {
  trend: 'Revenue Trend',
  topPerformers: 'Top Performers',
  payments: 'Payments Received',
  invoices: 'Invoices Raised',
  jobs: 'Job Cards',
  workers: 'Worker Performance',
  inventory: 'Inventory Movements'
};

export default function ReportsClient({ report }: { report: ReportData }) {
  const router = useRouter();
  const [from, setFrom] = useState(report.fromDate);
  const [to, setTo] = useState(report.toDate);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  // What to actually show (and therefore print) — unchecking something
  // hides it from the screen too, so "what you see is what prints" with
  // no separate hidden state to manage.
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    trend: true,
    topPerformers: true,
    payments: true,
    invoices: true,
    jobs: true,
    workers: true,
    inventory: true
  });

  function toggleSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function applyRange() {
    router.push(`/reports?from=${from}&to=${to}`);
  }

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setFrom(today);
    setTo(today);
    router.push(`/reports?from=${today}&to=${today}`);
  }

  function setThisWeek() {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const start = monday.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    setFrom(start);
    setTo(today);
    router.push(`/reports?from=${start}&to=${today}`);
  }

  function setThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    setFrom(first);
    setTo(today);
    router.push(`/reports?from=${first}&to=${today}`);
  }

  function setLastMonth() {
    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const start = firstOfLastMonth.toISOString().slice(0, 10);
    const end = lastOfLastMonth.toISOString().slice(0, 10);
    setFrom(start);
    setTo(end);
    router.push(`/reports?from=${start}&to=${end}`);
  }

  // Which preset (if any) matches the range actually applied right now
  // (report.fromDate/toDate, from the URL) — not the date-input values,
  // which change as someone types before hitting Apply. This is what
  // decides which button gets the active highlight.
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStart = (() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  })();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10);

  let activePreset: 'today' | 'week' | 'month' | 'lastMonth' | null = null;
  if (report.fromDate === todayStr && report.toDate === todayStr) activePreset = 'today';
  else if (report.fromDate === weekStart && report.toDate === todayStr) activePreset = 'week';
  else if (report.fromDate === monthStart && report.toDate === todayStr) activePreset = 'month';
  else if (report.fromDate === lastMonthStart && report.toDate === lastMonthEnd) activePreset = 'lastMonth';

  function presetClass(key: typeof activePreset) {
    return activePreset === key
      ? 'bg-amber-500 text-slate-950 font-medium text-sm px-3 py-2 rounded-lg cursor-pointer'
      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg cursor-pointer';
  }

  const sameDay = report.fromDate === report.toDate;
  const rangeLabel = sameDay
    ? new Date(report.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : `${new Date(report.fromDate).toLocaleDateString('en-IN')} — ${new Date(report.toDate).toLocaleDateString('en-IN')}`;

  const maxTrendRevenue = Math.max(...report.revenueTrend.map((d) => d.revenue), 1);

  return (
    <div className="min-h-screen bg-slate-950 print:bg-white text-slate-100 print:text-black p-6 sm:p-8 print:p-4">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
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
          <div className="print:hidden flex gap-2">
            <button
              onClick={() => setShowSectionPicker(!showSectionPicker)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Settings2 className="w-4 h-4" /> Choose Sections
            </button>
            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Report
            </button>
          </div>
        </div>

        {showSectionPicker && (
          <div className="print:hidden bg-slate-900/80 border border-slate-800 rounded-2xl p-4 animate-fadeIn">
            <p className="text-xs text-slate-500 mb-3">
              Uncheck anything you don't need right now — this controls both what's shown here and what prints.
            </p>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => toggleSection(key)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  {SECTION_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
        )}

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
          <button onClick={applyRange} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
            Apply
          </button>
          <button onClick={setToday} className={presetClass('today')}>
            Today
          </button>
          <button onClick={setThisWeek} className={presetClass('week')}>
            This Week
          </button>
          <button onClick={setThisMonth} className={presetClass('month')}>
            This Month
          </button>
          <button onClick={setLastMonth} className={presetClass('lastMonth')}>
            Last Month
          </button>
        </div>

        {/* KPI cards with period-over-period comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="Revenue" value={`₹${report.invoicesTotal.toLocaleString('en-IN')}`} changePct={report.revenueChangePct} />
          <KpiCard label="Payments In" value={`₹${report.paymentsTotal.toLocaleString('en-IN')}`} changePct={report.paymentsChangePct} accent="emerald" />
          <KpiCard label="Outstanding" value={`₹${report.outstandingTotal.toLocaleString('en-IN')}`} accent="red" />
          <KpiCard label="Jobs Done" value={String(report.jobsCompleted.length)} />
          <KpiCard label="Avg Job Value" value={`₹${report.avgJobValue.toLocaleString('en-IN')}`} />
        </div>

        {/* Revenue Trend */}
        {sections.trend && report.revenueTrend.length > 1 && (
          <ReportSection icon={<TrendingUp className="w-4 h-4 text-amber-500 print:hidden" />} title="Revenue Trend">
            <div className="p-4 space-y-2">
              {report.revenueTrend.map((d) => (
                <div key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-slate-500 print:text-gray-600 shrink-0 font-mono text-xs">
                    {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex-1 bg-slate-800 print:bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${Math.max((d.revenue / maxTrendRevenue) * 100, d.revenue > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-slate-300 print:text-black shrink-0">
                    ₹{d.revenue.toLocaleString('en-IN')}
                  </span>
                  <span className="w-14 text-right text-xs text-slate-500 print:text-gray-600 shrink-0">{d.jobCount}j</span>
                </div>
              ))}
            </div>
          </ReportSection>
        )}

        {/* Top Performers */}
        {sections.topPerformers && (
          <ReportSection icon={<Trophy className="w-4 h-4 text-amber-500 print:hidden" />} title="Top Performers">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TopList title="Top Services" items={report.topServices.map((s) => ({ name: s.name, value: s.revenue }))} />
              <TopList title="Top Parts" items={report.topParts.map((p) => ({ name: p.name, value: p.revenue }))} />
              <TopList title="Top Customers" items={report.topCustomers.map((c) => ({ name: c.name, value: c.spend }))} />
            </div>
          </ReportSection>
        )}

        {/* Payments received */}
        {sections.payments && (
          <ReportSection icon={<IndianRupee className="w-4 h-4 text-emerald-400 print:hidden" />} title={`Payments Received (${report.payments.length})`}>
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
                  <span className="font-mono text-emerald-400 print:text-black shrink-0">₹{p.amount.toLocaleString('en-IN')}</span>
                </div>
              ))
            )}
          </ReportSection>
        )}

        {/* Invoices raised */}
        {sections.invoices && (
          <ReportSection icon={<Receipt className="w-4 h-4 text-amber-500 print:hidden" />} title={`Invoices Raised (${report.invoices.length})`}>
            {report.invoices.length === 0 ? (
              <EmptyRow text="No invoices in this period." />
            ) : (
              report.invoices.map((i) => (
                <div key={i.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-300 print:text-black">{i.invoice_number}</span>
                    <span className={`text-xs ml-2 ${i.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'} print:text-gray-600`}>
                      {i.status === 'paid' ? 'Paid' : `Due ₹${i.balance_due.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <span className="font-mono text-slate-300 print:text-black shrink-0">₹{i.total.toLocaleString('en-IN')}</span>
                </div>
              ))
            )}
          </ReportSection>
        )}

        {/* Jobs */}
        {sections.jobs && (
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
                    <span className="font-mono text-slate-300 print:text-black shrink-0">₹{j.final_cost.toLocaleString('en-IN')}</span>
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
        )}

        {/* Worker-wise performance */}
        {sections.workers && (
          <ReportSection
            icon={<UserCheck className="w-4 h-4 text-amber-500 print:hidden" />}
            title={`Worker-wise Performance (${report.workerStats.filter((w) => w.jobCount > 0).length} active)`}
          >
            {report.workerStats.filter((w) => w.jobCount > 0).length === 0 && report.unassignedCompletedCount === 0 ? (
              <EmptyRow text="No completed jobs by any technician in this period." />
            ) : (
              <>
                {report.workerStats
                  .filter((w) => w.jobCount > 0)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((w) => (
                    <div key={w.id} className="p-3 px-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-200 print:text-black font-semibold">{w.name}</span>
                        <span className="font-mono text-amber-500 print:text-black">₹{w.revenue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
                        {w.jobCount} vehicle{w.jobCount === 1 ? '' : 's'} — {w.jobs.map((j) => j.job_number).join(', ')}
                      </div>
                    </div>
                  ))}
                {report.unassignedCompletedCount > 0 && (
                  <div className="p-3 px-4 text-xs text-slate-500 print:text-gray-600">
                    {report.unassignedCompletedCount} completed job{report.unassignedCompletedCount === 1 ? '' : 's'} had no technician assigned.
                  </div>
                )}
              </>
            )}
          </ReportSection>
        )}

        {/* Inventory movements */}
        {sections.inventory && (
          <ReportSection icon={<Boxes className="w-4 h-4 text-amber-500 print:hidden" />} title={`Inventory Movements (${report.inventoryTx.length})`}>
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
                  <span className={`font-mono shrink-0 ${t.qty >= 0 ? 'text-emerald-400' : 'text-red-400'} print:text-black`}>
                    {t.qty >= 0 ? '+' : ''}
                    {t.qty}
                  </span>
                </div>
              ))
            )}
          </ReportSection>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  changePct,
  accent
}: {
  label: string;
  value: string;
  changePct?: number | null;
  accent?: 'emerald' | 'red';
}) {
  const valueColor = accent === 'emerald' ? 'text-emerald-400' : accent === 'red' ? 'text-red-400' : 'text-amber-500';
  return (
    <div className="bg-slate-900/60 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-2xl p-4">
      <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase">{label}</div>
      <div className={`${valueColor} print:text-black font-bold text-lg mt-1`}>{value}</div>
      {changePct !== undefined && changePct !== null && (
        <div className={`text-xs mt-0.5 flex items-center gap-0.5 ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'} print:text-gray-600`}>
          {changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {changePct >= 0 ? '+' : ''}
          {changePct}% vs previous period
        </div>
      )}
    </div>
  );
}

function TopList({ title, items }: { title: string; items: Array<{ name: string; value: number }> }) {
  return (
    <div>
      <div className="text-xs font-mono text-slate-500 print:text-gray-600 uppercase mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-600 print:text-gray-400">No data yet.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-300 print:text-black truncate">
                {idx + 1}. {item.name}
              </span>
              <span className="font-mono text-amber-500 print:text-black shrink-0">₹{item.value.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
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
