"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { createClient } from "@/src/lib/supabase/client";

/**
 * Shared Google OAuth trigger for every auth entry point (/sign-in,
 * /login, /signup) — phone+password is the primary path on /login and
 * /signup, so this renders as a secondary ("ghost") action there; /sign-in
 * predates phone+password and still renders it as its one primary action
 * via the `variant` prop. Same signInWithOAuth call this app has always
 * used (originally only on /sign-in) — adding it to /login and /signup is
 * just making an existing, already-enabled provider reachable from more
 * entry points, not standing up a new one.
 */
export default function ContinueWithGoogle({
  next,
  variant = "secondary",
}: {
  next: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
    // On success the browser navigates away to Google — nothing else to do here.
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {error && <p className="text-sm text-nova-blood">{error}</p>}
      <Button type="button" variant={variant} onClick={handleClick} disabled={loading} className="w-full">
        {loading ? "Redirecting…" : "Continue with Google"}
      </Button>
    </div>
  );
}
