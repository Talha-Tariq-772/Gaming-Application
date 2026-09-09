"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import ContinueWithGoogle from "@/src/components/auth/ContinueWithGoogle";
import PasswordField from "@/src/components/auth/PasswordField";
import PhoneField from "@/src/components/auth/PhoneField";
import Turnstile from "@/src/components/auth/Turnstile";
import { signUpWithPhone } from "@/src/lib/actions/phone-auth";
import { passwordSchema, phoneSchema, recoveryEmailSchema } from "@/src/lib/validation";

export default function SignUpForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryEmailTouched, setRecoveryEmailTouched] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const phoneResult = phoneSchema.safeParse(phone);

  const passwordResult = passwordSchema.safeParse(password);
  const passwordError =
    passwordTouched && password && !passwordResult.success ? passwordResult.error.issues[0]?.message : undefined;

  const recoveryEmailResult = recoveryEmailSchema.safeParse(recoveryEmail);
  const recoveryEmailError =
    recoveryEmailTouched && !recoveryEmailResult.success ? recoveryEmailResult.error.issues[0]?.message : undefined;

  const requiresTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const canSubmit =
    phoneResult.success &&
    passwordResult.success &&
    recoveryEmailResult.success &&
    (!requiresTurnstile || Boolean(turnstileToken)) &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPhoneTouched(true);
    setPasswordTouched(true);
    setRecoveryEmailTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    setServerError(null);
    // On success signUpWithPhone calls redirect(), which throws and never
    // returns — reaching this line at all means it failed.
    const result = await signUpWithPhone({ phoneNumber: phone, password, recoveryEmail, turnstileToken, next });
    if (!result.ok) {
      setServerError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PhoneField value={phone} onChange={setPhone} touched={phoneTouched} onTouch={() => setPhoneTouched(true)} />

      <PasswordField
        value={password}
        onChange={setPassword}
        onBlur={() => setPasswordTouched(true)}
        error={passwordError}
        autoComplete="new-password"
      />

      <div>
        <label
          htmlFor="recovery-email"
          className="block text-xs font-semibold uppercase tracking-wider text-nova-smoke"
        >
          Recovery email <span className="normal-case text-nova-smoke">(optional)</span>
        </label>
        <input
          id="recovery-email"
          type="email"
          value={recoveryEmail}
          onChange={(e) => setRecoveryEmail(e.target.value)}
          onBlur={() => setRecoveryEmailTouched(true)}
          placeholder="you@example.com"
          aria-invalid={Boolean(recoveryEmailError)}
          aria-describedby={recoveryEmailError ? "recovery-email-error" : "recovery-email-hint"}
          className="mt-2 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
        />
        <p id="recovery-email-hint" className="mt-1 text-xs text-nova-smoke">
          For password reset only — we will not email you otherwise.
        </p>
        {recoveryEmailError && (
          <p id="recovery-email-error" className="mt-1 text-xs text-nova-blood">
            {recoveryEmailError}
          </p>
        )}
      </div>

      <Turnstile onVerify={setTurnstileToken} />

      {serverError && <p className="text-sm text-nova-blood">{serverError}</p>}

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {submitting ? "Creating account…" : "Create account"}
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

      <p className="text-center text-sm text-nova-ash">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
          Log in
        </Link>
      </p>
    </form>
  );
}
