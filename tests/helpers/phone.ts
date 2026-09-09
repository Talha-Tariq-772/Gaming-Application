import { randomInt } from "node:crypto";

/**
 * A normalisePhone()-valid Pakistani mobile number (src/lib/phone.ts:
 * local part is "3" followed by 9 digits) that's actually unique per
 * call, not a shared literal. profiles.phone_number carries a real
 * UNIQUE constraint, and Vitest runs test files concurrently by
 * default — two files hardcoding the same literal (e.g. "+92 300
 * 3334444") reliably collide whenever they land in the same run,
 * regardless of each file's own randomUUID()-derived `run` suffix used
 * for emails/slugs elsewhere. That pattern doesn't carry over cleanly
 * here since a UUID's hex digits (a-f) aren't valid phone digits — this
 * generates real random digits instead, keeping the same "unique per
 * call, not hardcoded" intent. Formatted with the same "+92 XXX
 * XXXXXXX" spacing the literals it replaces used, so any test asserting
 * shape rather than an exact number still passes.
 */
export function randomTestPhone(): string {
  const local = "3" + String(randomInt(0, 1_000_000_000)).padStart(9, "0");
  return `+92 ${local.slice(0, 3)} ${local.slice(3)}`;
}
