"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import PhoneField from "@/src/components/auth/PhoneField";
import { requestPasswordReset } from "@/src/lib/actions/password-reset";
import { phoneSchema } from "@/src/lib/validation";

export default function ForgotPasswordForm() {
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const phoneResult = phoneSchema.safeParse(phone);
  const canSubmit = phoneResult.success && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPhoneTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    const result = await requestPasswordReset(phone);
    setResultMessage(result.message);
    setSubmitting(false);
  }

  if (resultMessage) {
    return <p className="text-center text-sm text-nova-bone">{resultMessage}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PhoneField value={phone} onChange={setPhone} touched={phoneTouched} onTouch={() => setPhoneTouched(true)} />
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {submitting ? "Submitting…" : "Send reset instructions"}
      </Button>
    </form>
  );
}
