"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import { createClient } from "@/src/lib/supabase/client";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
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
    <div className="flex flex-col items-center gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="button" variant="primary" onClick={handleSignIn} disabled={loading}>
        {loading ? "Redirecting…" : "Sign in with Google"}
      </Button>
    </div>
  );
}
