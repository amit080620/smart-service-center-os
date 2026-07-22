// Browser-side Supabase client — for use in Client Components ('use client').
// Uses the public anon key, safe to ship to the browser (protected by Row
// Level Security on the database side).
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
