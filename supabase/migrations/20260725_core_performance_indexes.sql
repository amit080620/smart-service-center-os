-- Performance: indexes on the core tables that get queried on nearly
-- every page load. `if not exists` makes this safe to run even if some
-- of these already exist — this only adds what's missing.
--
-- Why this matters: every list page filters by org_id (and usually
-- `deleted_at is null` too); every detail page joins by a foreign key
-- (customer_id, vehicle_id, job_id, invoice_id...). Without an index,
-- Postgres has to scan the ENTIRE table for every one of these queries
-- — fine with a handful of rows, increasingly slow as real usage grows
-- job cards, invoices, and inventory transactions into the thousands.

-- Customers — every list/search, and every job-card creation's
-- customer lookup, filters on these.
create index if not exists idx_customers_org on public.customers (org_id) where deleted_at is null;
create index if not exists idx_customers_phone on public.customers (org_id, phone) where deleted_at is null;

-- Vehicles — filtered by org, by owner (customer_id), and searched by
-- plate number constantly.
create index if not exists idx_vehicles_org on public.vehicles (org_id) where deleted_at is null;
create index if not exists idx_vehicles_customer on public.vehicles (customer_id) where deleted_at is null;
create index if not exists idx_vehicles_plate on public.vehicles (org_id, plate_number) where deleted_at is null;

-- Job Cards — the single most-queried table in the app: the list page,
-- the vehicle-status board, reports, worker-wise stats, and the
-- vehicle/customer history pages all filter on these.
create index if not exists idx_job_cards_org on public.job_cards (org_id) where deleted_at is null;
create index if not exists idx_job_cards_customer on public.job_cards (customer_id) where deleted_at is null;
create index if not exists idx_job_cards_vehicle on public.job_cards (vehicle_id) where deleted_at is null;
create index if not exists idx_job_cards_technician on public.job_cards (assigned_technician_id) where deleted_at is null;
create index if not exists idx_job_cards_status on public.job_cards (org_id, status) where deleted_at is null;
create index if not exists idx_job_cards_created on public.job_cards (org_id, created_at);
create index if not exists idx_job_cards_completed on public.job_cards (org_id, completed_at);

-- Job line items — looked up by job_id on every job-card detail view,
-- and aggregated by service_id/part_id for the Reports "Top Performers"
-- analysis.
create index if not exists idx_job_services_job on public.job_services (job_id);
create index if not exists idx_job_services_service on public.job_services (service_id);
create index if not exists idx_job_parts_job on public.job_parts (job_id);
create index if not exists idx_job_parts_part on public.job_parts (part_id);

-- Invoices & Payments — the Billing list, Reports, and every invoice
-- print/detail page.
create index if not exists idx_invoices_org on public.invoices (org_id);
create index if not exists idx_invoices_job on public.invoices (job_id);
create index if not exists idx_invoices_created on public.invoices (org_id, created_at);
create index if not exists idx_payments_invoice on public.payments (invoice_id);
create index if not exists idx_payments_paid_at on public.payments (paid_at);

-- Item Master — Parts/Services catalogs, filtered by org and active
-- status on every list load, and by SKU when searching parts.
create index if not exists idx_services_org on public.services (org_id) where is_active;
create index if not exists idx_parts_org on public.parts (org_id) where is_active;
create index if not exists idx_parts_sku on public.parts (org_id, sku);

-- Employees — role-based permission checks and the Employees list both
-- filter on these; user_id is looked up on every single request to
-- resolve who's currently logged in.
create index if not exists idx_employees_org on public.employees (org_id) where deleted_at is null;
create index if not exists idx_employees_user on public.employees (user_id);
