-- Storage bucket for organization logos — run this in Supabase SQL
-- Editor (Dashboard → SQL Editor → New query → paste → Run)
--
-- Public read (so print pages and anyone with the URL can view the
-- logo without being logged in — needed since a customer opening a
-- printed/shared invoice link isn't authenticated). Uploads only ever
-- happen through the server-side admin API route, which enforces the
-- org-settings permission itself, so no public write policy is needed.

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;
