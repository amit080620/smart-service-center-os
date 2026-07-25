-- Per-org custom pricing override — run this in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

alter table public.org_wallets
  add column if not exists custom_bike_price numeric,
  add column if not exists custom_car_price numeric;
