-- Prepaid Wallet system + Super Admin platform panel — run this in
-- Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

alter table public.vehicles
  add column if not exists vehicle_type text not null default 'car';

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  bike_job_price numeric not null default 5,
  car_job_price numeric not null default 10,
  low_balance_threshold numeric not null default 20,
  block_threshold numeric not null default -50,
  support_phone text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.org_wallets (
  org_id uuid primary key references public.organizations(id),
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  type text not null, -- 'credit' | 'debit'
  amount numeric not null,
  reason text not null default '',
  balance_after numeric not null,
  related_job_id uuid references public.job_cards(id),
  created_by uuid, -- platform_admins.id for manual recharges, null for automatic job-card debits
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_transactions_org on public.wallet_transactions (org_id);

-- Seed one settings row with the defaults you described (₹5/bike,
-- ₹10/car, warn at ₹20, block at -₹50) — edit anytime from
-- /platform-admin/settings instead of SQL after this.
insert into public.platform_settings (bike_job_price, car_job_price, low_balance_threshold, block_threshold, support_phone)
select 5, 10, 20, -50, ''
where not exists (select 1 from public.platform_settings);

-- Give your EXISTING org (created before this migration) a wallet with
-- ₹100 starting balance too, since new orgs going forward get this
-- automatically at signup but yours already exists.
insert into public.org_wallets (org_id, balance)
select id, 100 from public.organizations
where id not in (select org_id from public.org_wallets);
