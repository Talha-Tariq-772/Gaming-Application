"use server";

import { redirect } from "next/navigation";
import { requireAuthenticated } from "@/src/lib/auth/session";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import { phoneSchema } from "@/src/lib/validation";

export type CompleteProfileResult = { ok: false; message: string };

/**
 * validation.ts's own docstring: client-side checks there are UX only,
 * "NOT a security boundary" — phoneSchema is re-run here server-side,
 * which is the actual enforcement.
 */
export async function completeProfile(phoneNumberRaw: string, next: string): Promise<CompleteProfileResult> {
  const caller = await requireAuthenticated();

  const parsed = phoneSchema.safeParse(phoneNumberRaw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid phone number." };
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.from("profiles").update({ phone_number: parsed.data }).eq("id", caller.id);

  if (error) {
    console.error("[completeProfile]", error);
    return { ok: false, message: "Something went wrong saving your phone number." };
  }

  redirect(next || "/account");
}
