-- Estimate vs Actual tracking — run this in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

alter table public.job_cards
  add column if not exists approved_estimate_amount numeric;
