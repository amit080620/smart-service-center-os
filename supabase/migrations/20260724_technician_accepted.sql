-- Technician assignment acceptance tracking — run this in Supabase SQL
-- Editor (Dashboard → SQL Editor → New query → paste → Run)

alter table public.job_cards
  add column if not exists technician_accepted_at timestamptz;
