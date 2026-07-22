# Smart Service Center OS — Project Summary & Roadmap

**Last updated:** Phase 2 complete (Billing module).
**Purpose of this document:** a single reference for what's built, what's
verified, and what's planned — so a new session (or a new developer) can
pick this up quickly without re-deriving decisions already made.

---

## 1. Stack & Architecture

- **Frontend + API:** Next.js 15 (App Router), deployed natively to Vercel
  — no adapter, no custom bundling. `apps/web/app/api/*` are Route
  Handlers, each its own serverless function.
- **Database + Auth:** Supabase (Postgres + Supabase Auth).
- **Monorepo:** Turborepo, npm workspaces.
- **Why this stack (not the previous Express + Vite build):** that build
  required extensive custom bundling to work on Vercel and repeatedly
  broke in production. Next.js is Vercel's native framework — this
  category of problem doesn't come up.
- **`apps/api`:** reserved, intentionally empty. Only build this if a
  genuine always-on process is needed later (background jobs, webhook
  listeners) — Vercel serverless can't do those.

### Package layout
```
apps/web/            Next.js app — all UI pages + all API routes
packages/
  config/             shared tsconfig
  constants/          ROLES, ORG_STATUS, JOB_STATUS etc. — typed, not raw strings
  validation/         Zod schemas — same schema used client-side AND server-side
  database/           Supabase clients (browser/server/admin) + typed schema
  auth/               getSessionContext() — session verification, used by every protected route
  permissions/        canApproveJobCard() etc. — centralized role checks
  ui, utils, logger    reserved, not yet built out
```

### Design language
"Workshop Signal" — hazard-yellow (#ffc93c) + warm graphite background,
carried forward from the previous build (validated, not redesigned).
Space Grotesk (display) + Inter (body) + JetBrains Mono (data/labels).

### Hard-won technical lessons (don't re-discover these)
1. **Supabase's TypeScript types silently become `never`** if a table
   definition is missing `Relationships` (even as `[]`), or if the schema
   is missing `Views`/`Functions`/`Enums`/`CompositeTypes` (even as empty
   `Record<string, never>`). Every table in `database.types.ts` follows
   this exact shape — copy the pattern for new tables.
2. **`packages/database`'s root export must stay browser-safe only.**
   `createSupabaseServerClient`/`createSupabaseAdminClient` live at
   `@smartbizos/database/server` and `/admin` specifically so a Client
   Component importing from the package root never accidentally pulls in
   `next/headers` and breaks the build.
3. Every API route independently verifies `org_id` ownership before
   acting — never trust a client-supplied id. This was the single most
   common security bug in the previous build.

---

## 2. What's built and verified (as of this document)

Every module below has been: typechecked (`turbo run typecheck`), built
(`turbo run build`), manually tested locally, pushed, and manually tested
on the live production domain (`sc.theray.in`).

| Module | What it does |
|---|---|
| **Auth** | Signup (creates org + branch + owner employee + Supabase Auth user, with rollback on failure), login, session middleware |
| **Customers** | List + create. Org-scoped, duplicate-phone check |
| **Vehicles** | List + create, linked to a customer. Duplicate-plate check |
| **Services catalog** | List + create. Name, cost, est. duration |
| **Parts catalog** | List + create. SKU, cost, supplier. Duplicate-SKU check |
| **Job Cards** | Create (from customer+vehicle), add service/part line items (cost auto-recalculated from stored items, never a drifting running total), full status lifecycle (received → diagnosing → in_progress → awaiting_parts → pending_approval → **approved** [permission-gated: branch manager/org owner only] → **completed** [via dedicated endpoint, see below] → delivered), full status-change history log |
| **Billing / Invoices** | **Dedicated `complete` endpoint** (not a plain status change) that: locks the job, recalculates the subtotal from line items, applies GST from the org's own settings (cgst/sgst rate), generates a sequential invoice number (`INV-<year>-<seq>`), creates the invoice, marks the job completed — all in one operation, so a job can never be "completed" with no invoice. Payment recording (cash/card/UPI/bank transfer/cheque), partial payments supported, invoice status auto-updates to "paid" at full balance, job card's `payment_status` reflects back |

### A note on the current payment recording
Right now, "recording a payment" is **manual entry only** — an employee
types in the amount and method after receiving payment some other way
(cash in hand, a UPI transfer they saw arrive, etc.). There is **no real
payment gateway integration yet** — that's a planned module (see below).

---

## 3. What's planned — in the order discussed

### 3a. Inventory tracking
Distinct from the Parts *catalog* (which is just "what parts exist and
their price"). Inventory tracks actual stock levels per branch:
`qty_on_hand`, `reorder_level`, low-stock alerts, and a transaction log
(every stock movement — received, sold/deducted on job completion,
manually adjusted). When a job card completes, parts used should
automatically deduct from inventory (this was intentionally deferred out
of the Billing module — see the `complete` endpoint's code comments).

### 3b. Employees & Attendance
Employee management (add/edit/deactivate — mirrors the owner-creation
flow from signup, but for adding staff after the fact), role assignment,
daily attendance recording (present/absent/half-day, overtime hours).

### 3c. Payroll
Depends on Employees & Attendance being built first. Calculates pay per
employee per period from attendance + salary/hourly-rate, with
incentive/deduction adjustments, an approval step, and a "settle" action
that finalizes a payroll period as paid.

### 3d. Reports
Revenue reports, technician performance (jobs completed, revenue
generated per technician), parts usage, payroll summaries. Likely
CSV export, matching the previous build's pattern.

### 3e. WhatsApp integration
Automated messages to customers at key moments — job created, status
changed, invoice ready, payment confirmed, service-due reminders. Needs
a real WhatsApp Business API provider account (this is an external
service dependency, not something buildable without picking a provider
first — e.g. Meta's own Cloud API, or a reseller like Gupshup/Twilio).

### 3f. Razorpay — two separate, distinct integrations

**This is a two-sided payment model — worth stating precisely so it's
built correctly the first time:**

**Side A — End customer pays the service center (for their vehicle
service).** This is Razorpay integrated *into* each service center's
invoice flow — when their customer views/pays an invoice, real money
moves from that customer to that service center's own account. This
replaces/extends the current manual "record a payment" flow with an
actual payment gateway. Each org (service center) would need their own
Razorpay account connected (Razorpay Route / linked accounts, or each
org enters their own API keys — needs a decision).

**Side B — The service center pays YOU (the SaaS platform owner) for
using the platform.** This is a completely separate Razorpay integration
— a subscription/billing system where each org (not their end customers)
pays SmartBizOS itself. Two pricing models to support:
1. **Pay-per-ticket:** ₹10 per job card created (usage-based billing)
2. **Annual subscription:** one payment covers a full year, unlimited job
   cards

These two integrations are architecturally unrelated (different payer,
different payee, different purpose) and should be built as two separate
pieces of work, likely in this order: Side B (subscription billing)
first, since it gates whether an org can keep using the product at all;
Side A (customer-facing payment collection) second, since it's a value-add
on top of an already-paying org.

**Open decisions to make before building Side B specifically:**
- Does the 14-day trial (already implemented — `trial_ends_at` on the
  org) block all usage on expiry, or just certain features?
- For pay-per-ticket: billed how — deducted from a pre-paid balance, or
  invoiced monthly in arrears?
- Does an org choose one model at signup, or can they switch later?

---

## 4. Things explicitly deferred / not forgotten, just not urgent

- `packages/ui`, `utils`, `logger` — real shared code, currently empty
  stubs. Worth building out once there's enough duplication across
  modules to justify it (e.g. a shared `<Button>` once 4+ pages have
  near-identical button styling).
- `.github/workflows` (CI) — would have caught several of the earlier
  Vercel deployment issues before they reached production. Worth doing
  before this goes further, not just "eventually."
- `tests/` (E2E, Playwright) — same reasoning as CI.
- Legal (ToS, Privacy Policy) — needed before any real customer signs up
  for real money, i.e. before Razorpay Side B goes live.

---

## 5. How to resume work in a new session

1. Read this document first.
2. Check `handbook/architecture-phase-1.md` for the deeper reasoning
   behind the auth foundation specifically (the Vercel/Supabase-typing
   lessons are documented there in more detail).
3. Pick the next module from Section 3, in order (or reorder based on
   actual business priority at the time).
4. Every new module should follow the established pattern: extend
   `database.types.ts` (with the full Row/Insert/Update/Relationships
   shape), add Zod schemas to `packages/validation`, build API routes
   under `apps/web/app/api/`, build the UI page(s) under
   `apps/web/app/(dashboard)/`, typecheck, build, test locally, hand off,
   test on production.
