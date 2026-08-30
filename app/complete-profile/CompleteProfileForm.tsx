"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import { completeProfile } from "@/src/lib/actions/profile";
import { phoneSchema } from "@/src/lib/validation";

export default function CompleteProfileForm({ email, next }: { email: string; next: string }) {
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = phoneSchema.safeParse(phone);
  const clientError = touched && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!parsed.success) return;

    setSubmitting(true);
    setServerError(null);
    // On success, completeProfile calls redirect(), which throws and never
    // returns — reaching this line at all means it failed.
    const result = await completeProfile(phone, next);
    if (!result.ok) {
      setServerError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wider text-nova-smoke">Email</span>
        <p className="mt-2 rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-ash">
          {email}
        </p>
      </div>
      <div>
        <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-nova-smoke">
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="+92 300 1234567"
          aria-invalid={Boolean(clientError)}
          aria-describedby={clientError ? "phone-error" : undefined}
          className="mt-2 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
        />
        {clientError && (
          <p id="phone-error" className="mt-1 text-xs text-nova-blood">
            {clientError}
          </p>
        )}
      </div>
      {serverError && <p className="text-sm text-nova-blood">{serverError}</p>}
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
