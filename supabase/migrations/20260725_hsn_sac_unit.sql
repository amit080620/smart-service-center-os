-- Item Master upgrade: HSN/SAC code and unit of measure — run this in
-- Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

alter table public.services
  add column if not exists hsn_sac_code text not null default '',
  add column if not exists unit text not null default 'piece';

alter table public.parts
  add column if not exists hsn_sac_code text not null default '',
  add column if not exists unit text not null default 'piece';
