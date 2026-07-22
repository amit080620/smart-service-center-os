// Admin Supabase client — uses the service_role key, which BYPASSES Row
// Level Security entirely. This is what lets signup create a new Supabase
// Auth user, and what lets any API route read/write across the org-scoped
// tables without RLS getting in the way (since our own application code
// enforces the org_id scoping instead — see packages/auth).
//
// NEVER import this in a Client Component or anywhere that could ship to
// the browser. This file being imported at all requires
// SUPABASE_SERVICE_ROLE_KEY, which only exists in server-side environment
// variables (no NEXT_PUBLIC_ prefix — Next.js will not inline it into any
// client bundle).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let cachedClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL environment variables. ' +
      'Set these in your .env.local file (see .env.example) before starting the server.'
    );
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return cachedClient;
}
