// Shared by every route that changes a job card's line items (add, edit
// qty, delete) — recalculates the job's total from what's actually
// stored, and if the job is already completed (has an invoice), keeps
// that invoice's numbers in sync too. Centralized here so all three
// routes apply the exact same recalculation, rather than three separate
// copies that could drift from each other over time.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@smartbizos/database';

export async function syncJobAndInvoiceTotals(
  admin: SupabaseClient<Database>,
  jobId: string,
  orgId: string,
  cgstRate: number,
  sgstRate: number
) {
  const [{ data: services }, { data: parts }] = await Promise.all([
    admin.from('job_services').select('qty, unit_cost').eq('job_id', jobId),
    admin.from('job_parts').select('qty, unit_cost').eq('job_id', jobId)
  ]);
  const subtotal =
    (services ?? []).reduce((sum, s) => sum + s.qty * s.unit_cost, 0) +
    (parts ?? []).reduce((sum, p) => sum + p.qty * p.unit_cost, 0);

  const { data: job } = await admin.from('job_cards').select('status').eq('id', jobId).maybeSingle();
  const isCompleted = job && ['completed', 'delivered'].includes(job.status);

  if (!isCompleted) {
    // Job still open — estimated_cost is just a running estimate, no
    // invoice exists yet to keep in sync.
    await admin
      .from('job_cards')
      .update({ estimated_cost: subtotal, final_cost: subtotal, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    return;
  }

  // Job already completed and billed — recompute GST the same way the
  // original completion did, and push the new numbers onto the existing
  // invoice rather than creating a second one.
  const tax = Math.round(subtotal * ((cgstRate + sgstRate) / 100));
  const total = subtotal + tax;

  await admin
    .from('job_cards')
    .update({ final_cost: total, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  const { data: invoice } = await admin.from('invoices').select('*').eq('job_id', jobId).eq('org_id', orgId).maybeSingle();
  if (invoice) {
    const newBalanceDue = total - invoice.amount_paid;
    await admin
      .from('invoices')
      .update({
        subtotal,
        tax,
        total,
        balance_due: newBalanceDue,
        status: newBalanceDue <= 0 ? 'paid' : 'sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', invoice.id);
  }
}
