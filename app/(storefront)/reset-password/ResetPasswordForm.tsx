"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Button from "@/components/Button";
import PasswordField from "@/src/components/auth/PasswordField";
import { createClient } from "@/src/lib/supabase/client";
import { passwordSchema } from "@/src/lib/validation";

/**
 * Reached only via the link generateLink({type: "recovery"}) produces
 * (src/lib/actions/password-reset.ts) — the Supabase browser client
 * detects the recovery tokens in the URL hash on load and establishes a
 * short-lived recovery session automatically (detectSessionInUrl,
 * default true), which is what makes updateUser({password}) below work
 * with no separate sign-in step.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Give the client a moment to parse the URL hash and establish the
    // recovery session before we render the form as usable.
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  const passwordResult = passwordSchema.safeParse(password);
  const passwordError =
    touched && password && !passwordResult.success ? passwordResult.error.issues[0]?.message : undefined;
  const canSubmit = passwordResult.success && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateErr) {
      setError("This reset link is invalid or has expired. Request a new one from the forgot-password page.");
      return;
    }
    router.push("/account");
  }

  if (!ready) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PasswordField
        label="New password"
        value={password}
        onChange={setPassword}
        onBlur={() => setTouched(true)}
        error={passwordError}
        autoComplete="new-password"
      />
      {error && <p className="text-sm text-nova-blood">{error}</p>}
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {submitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
