import { redirect } from 'next/navigation';
import { getSessionContext, getActiveBranchId } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import BranchSwitcher from '@/components/BranchSwitcher';
import {
  ClipboardList,
  IndianRupee,
  AlertTriangle,
  Boxes,
  Wallet,
  Plus,
  ArrowRight,
  Clock,
  Cake
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  diagnosing: 'Diagnosing',
  in_progress: 'In Progress',
  awaiting_parts: 'Awaiting Parts',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// The real home screen — a genuine "what needs my attention today"
// snapshot instead of the auth-chain placeholder this used to be.
// Deliberately a condensed summary that links out to the detailed
// pages (Job Cards, Vehicle Status, Reports, Wallet) rather than
// duplicating their full functionality here.
export default async function DashboardPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }
  const { employee, org } = session;

  const admin = createSupabaseAdminClient();
  const activeBranchId = await getActiveBranchId(org.id, employee.branch_id);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [{ data: allJobs }, { data: todayInvoices }, { data: inventory }, { data: wallet }, { data: parts }, { data: customers }] =
    await Promise.all([
      admin
        .from('job_cards')
        .select('*')
        .eq('org_id', org.id)
        .eq('branch_id', activeBranchId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      admin.from('invoices').select('total, created_at, job_id').eq('org_id', org.id).gte('created_at', todayIso),
      admin.from('inventory').select('*').eq('org_id', org.id).eq('branch_id', activeBranchId),
      admin.from('org_wallets').select('balance').eq('org_id', org.id).maybeSingle(),
      admin.from('parts').select('id, name').eq('org_id', org.id),
      admin.from('customers').select('id, date_of_birth, anniversary_date').eq('org_id', org.id).is('deleted_at', null)
    ]);

  const todayMD = new Date().toISOString().slice(5, 10);
  const occasionsToday = (customers ?? []).filter(
    (c) => (c.date_of_birth && c.date_of_birth.slice(5, 10) === todayMD) || (c.anniversary_date && c.anniversary_date.slice(5, 10) === todayMD)
  ).length;

  const jobs = allJobs ?? [];
  const jobsToday = jobs.filter((j) => j.created_at >= todayIso);
  const completedToday = jobs.filter((j) => j.completed_at && j.completed_at >= todayIso);
  const pendingApproval = jobs.filter((j) => j.status === 'pending_approval');
  const openJobs = jobs.filter((j) => !['completed', 'delivered', 'cancelled'].includes(j.status));
  const revenueToday = (todayInvoices ?? []).reduce((sum, i) => sum + i.total, 0);
  const lowStockItems = (inventory ?? []).filter((i) => i.qty_on_hand <= i.reorder_level);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Welcome back, {employee.full_name.split(' ')[0]}</h1>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              {org.name}
              <BranchSwitcher />
            </div>
          </div>
          <a
            href="/job-cards"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> New Job Card
          </a>
        </div>

        {/* Today's snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Jobs Today</div>
            <div className="text-slate-200 font-bold text-2xl mt-1">{jobsToday.length}</div>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-emerald-400 uppercase">Completed Today</div>
            <div className="text-emerald-300 font-bold text-2xl mt-1">{completedToday.length}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Revenue Today
            </div>
            <div className="text-amber-500 font-bold text-2xl mt-1">₹{revenueToday.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Open Jobs</div>
            <div className="text-slate-200 font-bold text-2xl mt-1">{openJobs.length}</div>
          </div>
        </div>

        {/* Needs attention */}
        {(pendingApproval.length > 0 || lowStockItems.length > 0 || occasionsToday > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {occasionsToday > 0 && (
              <a
                href="/marketing"
                className="bg-pink-950/30 border border-pink-900/50 rounded-2xl p-4 flex items-center justify-between hover:bg-pink-950/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Cake className="w-5 h-5 text-pink-400 shrink-0" />
                  <div>
                    <div className="text-pink-200 font-semibold text-sm">
                      {occasionsToday} customer{occasionsToday === 1 ? '' : 's'} celebrating today
                    </div>
                    <div className="text-xs text-pink-400/70">Send a birthday/anniversary wish</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-pink-400 shrink-0" />
              </a>
            )}
            {pendingApproval.length > 0 && (
              <a
                href="/job-cards"
                className="bg-purple-950/30 border border-purple-900/50 rounded-2xl p-4 flex items-center justify-between hover:bg-purple-950/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0" />
                  <div>
                    <div className="text-purple-200 font-semibold text-sm">{pendingApproval.length} job(s) pending approval</div>
                    <div className="text-xs text-purple-400/70">Customer sign-off needed to proceed</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
              </a>
            )}
            {lowStockItems.length > 0 && (
              <a
                href="/inventory"
                className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-950/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Boxes className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-amber-200 font-semibold text-sm">{lowStockItems.length} part(s) low on stock</div>
                    <div className="text-xs text-amber-400/70">At or below reorder level</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* Wallet mini-card */}
        {wallet && (
          <a
            href="/platform-billing"
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-900/40 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <div className="text-xs font-mono text-slate-500 uppercase">Wallet Balance</div>
                <div className={`font-bold ${wallet.balance < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                  ₹{wallet.balance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </a>
        )}

        {/* Open jobs list */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4 text-amber-500" /> Open Jobs
            </h2>
            <a href="/job-cards" className="text-xs text-amber-500 hover:text-amber-400 cursor-pointer">
              View all →
            </a>
          </div>
          {openJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No open jobs right now — all caught up.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {openJobs.slice(0, 8).map((j) => (
                <a key={j.id} href={`/job-cards/${j.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 cursor-pointer">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-500 font-semibold text-sm">{j.job_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {STATUS_LABELS[j.status] ?? j.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {new Date(j.created_at).toLocaleDateString('en-IN')}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
