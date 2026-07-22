// Server-side Supabase client — for use in Server Components, Route
// Handlers (app/api/*), and Server Actions. Reads the signed-in user's
// session from cookies, so requests made with this client run AS that
// user, subject to Row Level Security — this is the "who is asking"
// client. For operations that need to bypass RLS entirely (like creating
// a new Supabase Auth user during signup), use admin.ts instead.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from a Server Component in some cases,
            // where cookies can't be set — safe to ignore if middleware
            // is also refreshing the session (see middleware.ts).
          }
        }
      }
    }
  );
}
