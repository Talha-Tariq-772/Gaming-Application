import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-aware Supabase client bound to the current request's session.
 * Uses the anon key (RLS applies as whoever is actually logged in, or
 * anon if nobody is) — this is what Server Components use for public
 * catalog reads, and what Server Actions use to independently verify who
 * is really calling them (never trust a client-supplied user/admin id).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render, not a Server Action/Route
            // Handler — cookies can't be written here. Harmless as long as
            // middleware (or the calling action) refreshes the session.
          }
        },
      },
    },
  );
}
