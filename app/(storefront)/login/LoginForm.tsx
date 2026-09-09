"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import ContinueWithGoogle from "@/src/components/auth/ContinueWithGoogle";
import PasswordField from "@/src/components/auth/PasswordField";
import PhoneField from "@/src/components/auth/PhoneField";
import Turnstile from "@/src/components/auth/Turnstile";
import { signInWithPhone } from "@/src/lib/actions/phone-auth";
import { phoneSchema } from "@/src/lib/validation";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const phoneResult = phoneSchema.safeParse(phone);
  const requiresTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const canSubmit =
    phoneResult.success && password.length > 0 && (!requiresTurnstile || Boolean(turnstileToken)) && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPhoneTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    setServerError(null);
    // On success signInWithPhone calls redirect(), which throws and never
    // returns — reaching this line at all means it failed.
    const result = await signInWithPhone({ phoneNumber: phone, password, turnstileToken, next });
    if (!result.ok) {
      setServerError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PhoneField value={phone} onChange={setPhone} touched={phoneTouched} onTouch={() => setPhoneTouched(true)} />

      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />

      <Turnstile onVerify={setTurnstileToken} />

      {serverError && <p className="text-sm text-nova-blood">{serverError}</p>}

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      {/* Phone+password stays primary (see form above); Google is a
          secondary option for anyone who'd rather use it, or already has
          a Google-linked account — both paths must keep working. */}
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-nova-smoke">
        <span className="h-px flex-1 bg-nova-hairline" />
        Or
        <span className="h-px flex-1 bg-nova-hairline" />
      </div>
      <ContinueWithGoogle next={next} />

      <div className="flex flex-col items-center gap-2 text-sm text-nova-ash">
        <Link href="/forgot-password" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
