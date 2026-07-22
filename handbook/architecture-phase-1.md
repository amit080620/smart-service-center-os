# Architecture — Phase 1: Auth Foundation

## Stack decision
Next.js (frontend + full API layer via Route Handlers) + Supabase, deployed
to Vercel as ONE native deployment. NestJS was considered and explicitly
rejected for now — it doesn't run as Vercel serverless functions without
the same adapter/bundling risk that caused a full session of deployment
debugging on the previous build. `apps/api` is reserved for a real future
need (background jobs, webhook listeners), not built.

## What's built (Phase 1 — this pass)
- Full turborepo scaffold: `apps/web`, `packages/{config,constants,
  validation,database,auth,permissions}` — all real, not stubs
- `packages/ui`, `utils`, `logger`, `apps/api` — placeholder stubs only,
  genuinely empty, reserved for when there's a real need
- Login + signup pages, Supabase Auth wired end-to-end
- Signup API route (org + branch + owner employee creation, with rollback
  if any step fails)
- Session middleware (cookie refresh on every request)
- Minimal protected `/dashboard` page — exists specifically to prove the
  full auth chain (cookie → server verification → employee/org/branch
  lookup) works end to end. Gets replaced module by module from here.

## Key architectural decisions carried forward from the previous build
- **Workshop Signal design language** (hazard-yellow + warm graphite,
  gauge-motif signature element) — validated in the previous build,
  reused rather than redesigned from scratch.
- **Centralized permissions** (`packages/permissions`) — the single most
  common bug in the previous build was a role check missing or
  copy-pasted slightly wrong in a new endpoint. Writing each rule once
  and importing it everywhere prevents that class of bug from recurring.
- **Centralized constants** (`packages/constants`) — role/status strings
  as typed const objects, not hand-typed strings scattered across the
  codebase. A typo becomes a compile error instead of a silent bug.
- **Shared Zod validation** (`packages/validation`) — one schema per
  entity, used by both the frontend form and the API route. Never trust
  client input without server-side re-validation.

## A real bug found and fixed during this build
`packages/database`'s single barrel export file mixed browser-safe code
(the client-side Supabase client) with server-only code (the
server/admin clients, which import `next/headers`). Since Client
Components imported from the same barrel, webpack tried to bundle
`next/headers` into the browser bundle and failed the build. Fixed with
proper `package.json` subpath exports: `@smartbizos/database` (browser-safe
root), `@smartbizos/database/server`, `@smartbizos/database/admin` —
each only importable from the context it's actually safe in.

## Database types
`packages/database/src/database.types.ts` is hand-written (not
auto-generated) to match the applied SQL schema, covering `organizations`,
`branches`, `employees` so far. Expand this file with each new module's
tables — Supabase's type system requires the exact shape (`Row`/`Insert`/
`Update`/`Relationships` per table, plus `Views`/`Functions`/`Enums`/
`CompositeTypes` at the schema level, even if empty) or every table
silently falls back to `never` typing.

## Verified before handoff
- `npx turbo run typecheck` — clean across all 11 packages
- `npx turbo run build` — full production build succeeds (verified with
  system fonts temporarily swapped in, since the sandbox this was built
  in blocks Google Fonts' CDN — Vercel's build servers won't have this
  restriction)

## Not yet done
- Live Supabase test (signup → check tables) — needs to happen after
  deployment, same as before
- Every module beyond auth (job cards, billing, inventory, payroll, etc.)
- CI (`.github/workflows`) — folder reserved, not built this pass
- Any of the deferred packages (`ui`, `utils`, `logger`, `events`, `sdk`)
