"use server";

import { sendEmail } from "@/src/lib/email";
import { phoneToAuthEmail } from "@/src/lib/phone";
import { requestIp } from "@/src/lib/request-ip";
import { SITE_URL } from "@/src/lib/site-config";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { phoneSchema } from "@/src/lib/validation";

export type RequestPasswordResetResult = { ok: true; message: string } | { ok: false; message: string };

/** Same wording whether or not the phone is actually registered — a
 * reset-request form is exactly the kind of place enumeration (an
 * attacker learning which phone numbers have accounts) matters just as
 * much as it does at login. */
const GENERIC_RESET_MESSAGE =
  "If that number has an account, we're on it — check your email if you added one, or wait to hear from us on WhatsApp.";

/**
 * Two branches, both silent about whether the phone actually exists:
 * - A recovery email is on file: generate a real Supabase recovery link
 *   and email it there (never to the synthetic auth address, which can't
 *   receive mail).
 * - No recovery email: stamp password_reset_requested_at so the request
 *   surfaces in /admin/resets, where an agent verifies identity against
 *   recent order details before manually issuing a new password over
 *   WhatsApp — the same human-verified, WhatsApp-mediated pattern this
 *   app already uses for order fulfilment.
 */
export async function requestPasswordReset(phoneRaw: string): Promise<RequestPasswordResetResult> {
  const ip = await requestIp();
  const parsed = phoneSchema.safeParse(phoneRaw);

  const service = createServiceClient();
  await service.rpc("check_login_rate_limit", { p_phone: parsed.success ? parsed.data : phoneRaw.trim(), p_ip: ip });
  // Rate limit is advisory here (best-effort abuse throttling) rather than
  // a hard gate — a reset request that's over the limit still gets the
  // exact same generic response as one that isn't, so the limit itself
  // can't be used to distinguish a registered number from an unregistered
  // one either.

  if (!parsed.success) return { ok: true, message: GENERIC_RESET_MESSAGE };

  const { data: profile } = await service
    .from("profiles")
    .select("id, recovery_email")
    .eq("phone_number", parsed.data)
    .maybeSingle();

  if (!profile) return { ok: true, message: GENERIC_RESET_MESSAGE };

  if (profile.recovery_email) {
    const authEmail = phoneToAuthEmail(phoneRaw);
    if (authEmail) {
      const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
        type: "recovery",
        email: authEmail,
        options: { redirectTo: `${SITE_URL}/reset-password` },
      });
      if (linkErr) {
        console.error("[requestPasswordReset] generateLink failed", linkErr);
      } else {
        await sendEmail({
          to: profile.recovery_email,
          subject: "Reset your PSCBUNDLE password",
          text: `Someone requested a password reset for your PSCBUNDLE account. If this was you, use this link to set a new password:\n\n${linkData.properties.action_link}\n\nIf you didn't request this, you can ignore this email.`,
        });
      }
    }
  } else {
    await service
      .from("profiles")
      .update({ password_reset_requested_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  return { ok: true, message: GENERIC_RESET_MESSAGE };
}
