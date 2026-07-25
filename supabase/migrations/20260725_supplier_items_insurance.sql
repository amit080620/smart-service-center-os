-- Multi-item supplier bills + insurance claim tracking — run this in
-- Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists public.supplier_bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.supplier_bills(id),
  part_id uuid not null references public.parts(id),
  qty numeric not null,
  unit_cost numeric not null
);
create index if not exists idx_supplier_bill_items_bill on public.supplier_bill_items (bill_id);

alter table public.job_cards
  add column if not exists is_insurance_claim boolean not null default false,
  add column if not exists insurance_company text not null default '',
  add column if not exists insurance_claim_number text not null default '',
  add column if not exists insurance_approved_amount numeric;
