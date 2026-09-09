import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { normalisePhone, phoneToAuthEmail } from "@/src/lib/phone";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { randomTestPhone } from "./helpers/phone";

/**
 * Phone+password auth — see supabase/migrations/20260908000002_phone_password_auth.sql
 * and src/lib/actions/phone-auth.ts. Same live-Supabase integration
 * approach as every other server-action suite (server-session mocked to a
 * real Supabase client of our choosing; next/headers mocked since
 * requestIp/requestOrigin both call headers() directly).
 *
 * sessionState.client is always a FRESH anon-key client with no prior
 * session, never the service-role `service` client used for setup/
 * cleanup below — signUpWithPhone/signInWithPhone both call
 * signInWithPassword() on whatever createSessionClient() returns, which
 * mutates that client instance's own internal auth state to the newly
 * signed-in user's session. Reusing `service` for that would silently
 * flip its later `.from()` calls in this file from service-role
 * (RLS-bypassing) to that customer's own RLS-restricted session.
 *
 * TURNSTILE_SECRET_KEY in .env.local is Cloudflare's published
 * always-passes TEST secret (see .env.local's own comment) — any non-empty
 * token string verifies successfully against the real siteverify endpoint
 * when paired with that secret, so these tests exercise the real
 * verifyTurnstileToken() call over the network, not a mock of it.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const { signUpWithPhone, signInWithPhone } = await import("@/src/lib/actions/phone-auth");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function freshAnonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const TEST_TURNSTILE_TOKEN = "test-verification-token";

/** signUpWithPhone/signInWithPhone call redirect() on success, which
 * throws a special NEXT_REDIRECT error outside a real request — this
 * extracts the intended destination from it so a test can assert routing,
 * not just "it threw". */
function redirectTargetFrom(error: unknown): string {
  const digest = (error as { digest?: string })?.digest ?? "";
  // Next's redirect() digest shape: "NEXT_REDIRECT;<type>;<url>;<status>"
  const parts = digest.split(";");
  return parts[2] ?? "";
}

async function signUp(phoneNumber: string, password: string, recoveryEmail = ""): Promise<void> {
  sessionState.client = freshAnonClient();
  await expect(
    signUpWithPhone({ phoneNumber, password, recoveryEmail, turnstileToken: TEST_TURNSTILE_TOKEN, next: "/account" }),
  ).rejects.toThrow();
}

async function findAuthUserId(rawPhone: string): Promise<string> {
  const authEmail = phoneToAuthEmail(rawPhone)!;
  const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
  const user = users?.users.find((u) => u.email === authEmail);
  if (!user) throw new Error(`no auth user found for ${authEmail}`);
  return user.id;
}

const createdUserIds: string[] = [];

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "created auth users",
      run: async () => {
        await Promise.all(
          createdUserIds.map((id) => deleteWithRetry(() => service.auth.admin.deleteUser(id), `user ${id}`)),
        );
      },
    },
    {
      label: "login_attempts (test-only ip)",
      run: async () => {
        // "unknown" is only ever produced by the next/headers mock above —
        // a real request always has a forwarded-for/real-ip header. Safe
        // to wipe every attempt row it wrote so repeated suite runs (and
        // this file's own rate-limit test) never accumulate across runs.
        await deleteWithRetry(() => service.from("login_attempts").delete().eq("ip", "unknown"), "login_attempts");
      },
    },
  ]);
}, 30_000);

describe("signUpWithPhone", () => {
  it("creates a profile with the normalised phone and signs the user in", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignUp!${randomUUID().slice(0, 12)}`;

    await signUp(rawPhone, password);
    const userId = await findAuthUserId(rawPhone);
    createdUserIds.push(userId);

    const { data: profile } = await service
      .from("profiles")
      .select("phone_number, recovery_email")
      .eq("id", userId)
      .single();
    // profiles.phone_number stores validation.ts's spaced canonical form —
    // rawPhone from randomTestPhone() is already in that exact shape.
    expect(profile?.phone_number).toBe(rawPhone);
    expect(profile?.recovery_email).toBeNull();
  });

  it("stores an optional recovery email distinct from the synthetic auth email", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignUp!${randomUUID().slice(0, 12)}`;
    const recoveryEmail = `recovery-${randomUUID().slice(0, 8)}@example.com`;

    await signUp(rawPhone, password, recoveryEmail);
    const userId = await findAuthUserId(rawPhone);
    createdUserIds.push(userId);

    const { data: authUser } = await service.auth.admin.getUserById(userId);
    expect(authUser.user?.email).not.toBe(recoveryEmail); // synthetic auth email, never the recovery address

    const { data: profile } = await service.from("profiles").select("recovery_email").eq("id", userId).single();
    expect(profile?.recovery_email).toBe(recoveryEmail);
  });

  it("rejects a duplicate phone signup cleanly, without a raw Supabase error", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignUp!${randomUUID().slice(0, 12)}`;

    await signUp(rawPhone, password);
    createdUserIds.push(await findAuthUserId(rawPhone));

    // Same number, different raw formatting — must still collide, proving
    // the synthetic-email mapping is format-independent, not a string match.
    const differentlyFormatted = `0${rawPhone.slice(4).replace(" ", "")}`;
    sessionState.client = freshAnonClient();
    const second = await signUpWithPhone({
      phoneNumber: differentlyFormatted,
      password: `Different!${randomUUID().slice(0, 8)}`,
      recoveryEmail: "",
      turnstileToken: TEST_TURNSTILE_TOKEN,
      next: "/account",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).not.toMatch(/duplicate|constraint|sql|postgres/i);
    expect(second.message.length).toBeGreaterThan(0);

    // Still exactly one auth user for this phone — the rejected attempt
    // created nothing.
    const authEmail = phoneToAuthEmail(rawPhone)!;
    const { data: usersAfter } = await service.auth.admin.listUsers({ perPage: 200 });
    expect(usersAfter?.users.filter((u) => u.email === authEmail)).toHaveLength(1);
  });
});

describe("signInWithPhone", () => {
  it("logs in successfully and routes a plain customer to `next` (resolvePostLoginRedirect)", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignIn!${randomUUID().slice(0, 12)}`;

    await signUp(rawPhone, password);
    createdUserIds.push(await findAuthUserId(rawPhone));

    sessionState.client = freshAnonClient();
    try {
      await signInWithPhone({ phoneNumber: rawPhone, password, turnstileToken: TEST_TURNSTILE_TOKEN, next: "/checkout" });
      throw new Error("expected signInWithPhone to redirect (throw)");
    } catch (error) {
      expect(redirectTargetFrom(error)).toBe("http://localhost:3000/checkout");
    }
  });

  it("routes an admin-promoted phone account straight to /admin, overriding next", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignInAdmin!${randomUUID().slice(0, 12)}`;

    await signUp(rawPhone, password);
    const userId = await findAuthUserId(rawPhone);
    createdUserIds.push(userId);
    await service.from("profiles").update({ role: "admin" }).eq("id", userId);

    sessionState.client = freshAnonClient();
    try {
      await signInWithPhone({ phoneNumber: rawPhone, password, turnstileToken: TEST_TURNSTILE_TOKEN, next: "/account" });
      throw new Error("expected signInWithPhone to redirect (throw)");
    } catch (error) {
      expect(redirectTargetFrom(error)).toBe("http://localhost:3000/admin");
    }
  });

  it("never reveals whether a phone is registered — wrong password and unknown phone look identical", async () => {
    const rawPhone = randomTestPhone();
    const password = `SignInWrong!${randomUUID().slice(0, 12)}`;

    await signUp(rawPhone, password);
    createdUserIds.push(await findAuthUserId(rawPhone));

    sessionState.client = freshAnonClient();
    const wrongPassword = await signInWithPhone({
      phoneNumber: rawPhone,
      password: "definitely-wrong-password",
      turnstileToken: TEST_TURNSTILE_TOKEN,
      next: "/account",
    });

    sessionState.client = freshAnonClient();
    const unknownPhone = await signInWithPhone({
      phoneNumber: randomTestPhone(),
      password: "whatever-password",
      turnstileToken: TEST_TURNSTILE_TOKEN,
      next: "/account",
    });

    expect(wrongPassword.ok).toBe(false);
    expect(unknownPhone.ok).toBe(false);
    if (wrongPassword.ok || unknownPhone.ok) return;
    expect(wrongPassword.message).toBe(unknownPhone.message);
  });
});

describe("check_login_rate_limit", () => {
  it("allows 5 attempts per phone per window and blocks the 6th", async () => {
    const phone = normalisePhone(randomTestPhone())!;
    const ip = `rate-limit-test-${randomUUID().slice(0, 8)}`;

    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const { data, error } = await service.rpc("check_login_rate_limit", { p_phone: phone, p_ip: ip });
      expect(error).toBeNull();
      results.push(data === true);
    }

    expect(results.slice(0, 5)).toEqual([true, true, true, true, true]);
    expect(results[5]).toBe(false);

    await service.from("login_attempts").delete().eq("ip", ip);
  });

  it("blocks the 21st attempt from the same IP within the hour, even across different phones", async () => {
    const ip = `ip-limit-test-${randomUUID().slice(0, 8)}`;
    const results: boolean[] = [];

    for (let i = 0; i < 21; i++) {
      // A fresh phone every call so only the IP dimension can be
      // responsible for a block — the phone limit (5/15min) never
      // applies to any single one of these.
      const phone = normalisePhone(randomTestPhone())!;
      const { data, error } = await service.rpc("check_login_rate_limit", { p_phone: phone, p_ip: ip });
      expect(error).toBeNull();
      results.push(data === true);
    }

    expect(results.slice(0, 20)).toEqual(new Array(20).fill(true));
    expect(results[20]).toBe(false);

    await service.from("login_attempts").delete().eq("ip", ip);
  });
});

describe("RLS — a non-owner cannot read another phone-auth profile", () => {
  it("customer B's session cannot select customer A's profile row", async () => {
    const phoneA = randomTestPhone();
    const passwordA = `RlsA!${randomUUID().slice(0, 8)}`;
    const phoneB = randomTestPhone();
    const passwordB = `RlsB!${randomUUID().slice(0, 8)}`;

    await signUp(phoneA, passwordA);
    await signUp(phoneB, passwordB);

    const userIdA = await findAuthUserId(phoneA);
    const userIdB = await findAuthUserId(phoneB);
    createdUserIds.push(userIdA, userIdB);

    const emailB = phoneToAuthEmail(phoneB)!;
    const clientB = freshAnonClient();
    const { error: signInErr } = await clientB.auth.signInWithPassword({ email: emailB, password: passwordB });
    expect(signInErr).toBeNull();

    const { data, error } = await clientB.from("profiles").select("phone_number").eq("id", userIdA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
