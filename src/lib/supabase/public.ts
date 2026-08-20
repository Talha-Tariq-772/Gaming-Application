import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Stateless anon-key client with no cookie/session dependency — safe to
 * call from anywhere (Server Components, Route Handlers, and build-time
 * contexts like generateStaticParams, which have no request/cookies at
 * all). Use this for public reads; use server-session.ts instead when a
 * query genuinely needs to know who's logged in.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
