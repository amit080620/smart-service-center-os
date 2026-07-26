-- Customer Engagement — birthday/anniversary tracking for wishes and
-- offers. Run this in Supabase SQL Editor (Dashboard → SQL Editor →
-- New query → paste → Run)

alter table public.customers
  add column if not exists date_of_birth date,
  add column if not exists anniversary_date date;
