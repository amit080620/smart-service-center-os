-- Adds discount and GST-type support to invoices — run this in Supabase
-- SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

alter table public.invoices
  add column if not exists discount integer not null default 0,
  add column if not exists tax_type text not null default 'cgst_sgst';
