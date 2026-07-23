-- Supplier payment tracking — run this in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  contact_phone text not null default '',
  contact_email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id),
  bill_number text not null default '',
  amount numeric not null,
  amount_paid numeric not null default 0,
  balance_due numeric not null,
  status text not null default 'unpaid', -- 'unpaid' | 'paid'
  bill_date date not null default current_date,
  notes text not null default '',
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.supplier_bills(id),
  amount numeric not null,
  method text not null, -- 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque'
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references public.employees(id)
);

create index if not exists idx_supplier_bills_org on public.supplier_bills (org_id);
create index if not exists idx_supplier_bills_supplier on public.supplier_bills (supplier_id);
create index if not exists idx_supplier_payments_bill on public.supplier_payments (bill_id);
