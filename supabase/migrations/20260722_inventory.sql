-- Inventory tracking tables — run this in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  part_id uuid not null references public.parts(id),
  qty_on_hand integer not null default 0,
  reorder_level integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One inventory row per part per branch — the API checks this too, but
  -- the constraint makes it impossible to violate even by direct SQL.
  unique (branch_id, part_id)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id),
  type text not null, -- 'received' | 'sold' | 'adjusted'
  qty integer not null,
  reference_job_id uuid references public.job_cards(id),
  performed_by uuid not null references public.employees(id),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Indexes for the two most common lookups: "all inventory for a branch"
-- and "all transactions for an inventory row".
create index if not exists idx_inventory_org_branch on public.inventory (org_id, branch_id);
create index if not exists idx_inventory_transactions_inventory on public.inventory_transactions (inventory_id);
