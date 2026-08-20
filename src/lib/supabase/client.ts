import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-safe Supabase client. Uses only the public anon key — safe to
 * import from any "use client" component.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
