import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { Receipt, IndianRupee } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-amber-900/50 text-amber-300',
  paid: 'bg-emerald-900/50 text-emerald-300',
  voided: 'bg-slate-700 text-slate-300'
};

// Pure Server Component — no client-side interactivity on this page at
// all (invoices are only ever generated automatically, never created
// here directly), so there's no need for a separate Client Component
// split like the other list pages. Data is fetched once, directly,
// during server render.
export default async function InvoicesPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data: invoices } = await admin
    .from('invoices')
    .select('*')
    .eq('org_id', session.employee.org_id)
    .order('created_at', { ascending: false });

  let populated: Array<{
    id: string;
    invoice_number: string;
    job_number: string;
    customer_name: string;
    total: number;
    balance_due: number;
    status: string;
  }> = [];

  if (invoices && invoices.length > 0) {
    const jobIds = [...new Set(invoices.map((i) => i.job_id))];
    const { data: jobs } = await admin.from('job_cards').select('id, job_number, customer_id').in('id', jobIds);
    const customerIds = [...new Set((jobs ?? []).map((j) => j.customer_id))];
    const { data: customers } = customerIds.length
      ? await admin.from('customers').select('id, first_name, last_name').in('id', customerIds)
      : { data: [] };

    populated = invoices.map((inv) => {
      const job = jobs?.find((j) => j.id === inv.job_id);
      const customer = job ? customers?.find((c) => c.id === job.customer_id) : null;
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        job_number: job?.job_number ?? 'Unknown',
        customer_name: customer ? `${customer.first_name} ${customer.last_name}`.trim() : 'Unknown',
        total: inv.total,
        balance_due: inv.balance_due,
        status: inv.status
      };
    });
  }

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
          {populated.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No invoices yet — invoices are generated automatically when a job card is completed.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {populated.map((inv) => (
                <a
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-amber-500 font-semibold text-sm">{inv.invoice_number}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status] ?? 'bg-slate-700 text-slate-200'}`}
                      >
                        {inv.status === 'paid' ? 'Paid' : inv.status === 'sent' ? 'Unpaid' : inv.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mt-1 truncate">
                      {inv.customer_name} · {inv.job_number}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
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
