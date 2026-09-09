"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePostLoginRedirect, type PostLoginProfile } from "@/src/lib/auth/post-login-redirect";
import { normalisePhone, phoneToAuthEmail } from "@/src/lib/phone";
import { requestIp } from "@/src/lib/request-ip";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import { verifyTurnstileToken } from "@/src/lib/turnstile";
import { loginFormSchema, signUpFormSchema } from "@/src/lib/validation";

export type PhoneAuthResult = { ok: false; message: string };

/** Never reveals whether a phone number is registered — used for every
 * login failure regardless of cause (malformed phone, unknown phone,
 * wrong password all look identical to the caller). */
const GENERIC_LOGIN_FAILURE = "Incorrect phone number or password.";
const RATE_LIMITED_MESSAGE = "Too many attempts. Please try again in a few minutes.";
const VERIFICATION_FAILED_MESSAGE = "Verification failed. Please try again.";

/** Server Actions don't get `request.url` the way Route Handlers do —
 * derived from headers() instead, same information a Route Handler would
 * read off the incoming request. */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function checkRateLimit(phoneKey: string, ip: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("check_login_rate_limit", { p_phone: phoneKey, p_ip: ip });
  if (error) {
    console.error("[phone-auth] rate limit check failed", error);
    return false; // fail closed — an outage here shouldn't turn into an open door
  }
  return data === true;
}

export async function signUpWithPhone(input: {
  phoneNumber: string;
  password: string;
  recoveryEmail: string;
  turnstileToken: string;
  next: string;
}): Promise<PhoneAuthResult> {
  const ip = await requestIp();

  const parsed = signUpFormSchema.safeParse({
    phoneNumber: input.phoneNumber,
    password: input.password,
    recoveryEmail: input.recoveryEmail,
  });
  // Rate-limited on the raw trimmed input when it doesn't even parse as a
  // phone, so a malformed-input probe still burns an attempt instead of
  // being free to retry indefinitely.
  const rateLimitKey = normalisePhone(input.phoneNumber) ?? input.phoneNumber.trim();
  const allowed = await checkRateLimit(rateLimitKey, ip);
  if (!allowed) return { ok: false, message: RATE_LIMITED_MESSAGE };

  const verified = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!verified) return { ok: false, message: VERIFICATION_FAILED_MESSAGE };

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const { phoneNumber: spacedPhone, password, recoveryEmail } = parsed.data;
  const authEmail = phoneToAuthEmail(input.phoneNumber);
  if (!authEmail) {
    // Can't happen — phoneSchema already validated the same input above —
    // but never assume two independent parsers stay in lockstep forever.
    return { ok: false, message: "Enter a valid Pakistani mobile number." };
  }

  const service = createServiceClient();
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true, // nothing can ever arrive at this address to confirm
    user_metadata: { phone_number: spacedPhone },
  });

  if (createErr || !created.user) {
    // Covers both a duplicate synthetic email (same phone signed up
    // before) and a duplicate profiles.phone_number (e.g. already claimed
    // via Google + /complete-profile) — handle_new_user's insert failing
    // rolls back the whole auth.users insert, so both surface here the
    // same way. Never the raw Supabase error.
    return {
      ok: false,
      message: "That phone number is already registered. Try logging in instead.",
    };
  }

  if (recoveryEmail) {
    const { error: updateErr } = await service
      .from("profiles")
      .update({ recovery_email: recoveryEmail })
      .eq("id", created.user.id);
    if (updateErr) console.error("[signUpWithPhone] recovery_email update failed", updateErr);
  }

  const sessionClient = await createSessionClient();
  const { error: signInErr } = await sessionClient.auth.signInWithPassword({ email: authEmail, password });
  if (signInErr) {
    console.error("[signUpWithPhone] post-signup sign-in failed", signInErr);
    return {
      ok: false,
      message: "Your account was created, but we couldn't sign you in automatically. Try logging in.",
    };
  }

  // A brand-new phone+password account always has phone_number set (just
  // written above) and the default 'customer' role — resolvePostLoginRedirect
  // would only ever return `next` for this shape, but going through it
  // anyway keeps this path honest to the one real redirect rule.
  const profile: PostLoginProfile = { phone_number: spacedPhone, role: "customer" };
  redirect(resolvePostLoginRedirect(await requestOrigin(), input.next || "/account", profile));
}

export async function signInWithPhone(input: {
  phoneNumber: string;
  password: string;
  turnstileToken: string;
  next: string;
}): Promise<PhoneAuthResult> {
  const ip = await requestIp();

  const parsed = loginFormSchema.safeParse({ phoneNumber: input.phoneNumber, password: input.password });
  const rateLimitKey = normalisePhone(input.phoneNumber) ?? input.phoneNumber.trim();
  const allowed = await checkRateLimit(rateLimitKey, ip);
  if (!allowed) return { ok: false, message: RATE_LIMITED_MESSAGE };

  const verified = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!verified) return { ok: false, message: VERIFICATION_FAILED_MESSAGE };

  if (!parsed.success) return { ok: false, message: GENERIC_LOGIN_FAILURE };

  const authEmail = phoneToAuthEmail(input.phoneNumber);
  if (!authEmail) return { ok: false, message: GENERIC_LOGIN_FAILURE };

  const supabase = await createSessionClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: parsed.data.password,
  });
  if (signInErr) return { ok: false, message: GENERIC_LOGIN_FAILURE };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: GENERIC_LOGIN_FAILURE };

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_number, role")
    .eq("id", user.id)
    .single();

  redirect(resolvePostLoginRedirect(await requestOrigin(), input.next || "/account", profile ?? null));
}
