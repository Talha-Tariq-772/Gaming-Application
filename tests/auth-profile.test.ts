import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Covers what can actually be verified without a real browser OAuth
 * round-trip: the handle_new_user() trigger populating email, the
 * null-phone_number state that drives the /complete-profile redirect, the
 * completeProfile server action actually persisting a phone number, and
 * that a second "sign-in" (a fresh session for the same already-complete
 * user) sees phone_number already set. The literal "click Sign in with
 * Google" step needs a real browser and a real Google account — no tool
 * here can drive that; that part must be verified by hand.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { completeProfile } = await import("@/src/lib/actions/profile");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function cleanup(makeRequest: () => PromiseLike<{ error: unknown }>, label: string, retries = 5) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await makeRequest();
    if (!error) return;
    if (attempt >= retries) throw new Error(`cleanup failed (${label}): ${JSON.stringify(error)}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}

const run = randomUUID().slice(0, 8);
const password = `AuthProfileTest!${randomUUID()}`;

let userA: { id: string; email: string };
let userB: { id: string; email: string };
let clientA: SupabaseClient;
let clientB: SupabaseClient;

beforeAll(async () => {
  const emailA = `auth-profile-a-${run}@example.com`;
  const emailB = `auth-profile-b-${run}@example.com`;

  const { data: createdA, error: errA } = await service.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  userA = { id: createdA.user.id, email: emailA };

  const { data: createdB, error: errB } = await service.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;
  userB = { id: createdB.user.id, email: emailB };

  clientA = await signedInClient(userA.email, password);
  clientB = await signedInClient(userB.email, password);
});

afterAll(async () => {
  if (userA?.id) await cleanup(() => service.auth.admin.deleteUser(userA.id), "userA");
  if (userB?.id) await cleanup(() => service.auth.admin.deleteUser(userB.id), "userB");
});

describe("handle_new_user() trigger", () => {
  it("copies auth.users.email into profiles.email on signup", async () => {
    const { data: profile, error } = await service
      .from("profiles")
      .select("email, phone_number")
      .eq("id", userA.id)
      .single();
    expect(error).toBeNull();
    expect(profile?.email).toBe(userA.email);
    // The state that middleware/the callback route check for /complete-profile.
    expect(profile?.phone_number).toBeNull();
  });
});

describe("completeProfile server action", () => {
  it("rejects a non-Pakistani phone number without touching the row", async () => {
    sessionState.client = clientA;
    const result = await completeProfile("not-a-phone-number", "/account");
    expect(result.ok).toBe(false);

    const { data: recheck } = await service.from("profiles").select("phone_number").eq("id", userA.id).single();
    expect(recheck?.phone_number).toBeNull();
  });

  it("persists a valid phone number and normalizes it, simulating first-time profile completion", async () => {
    sessionState.client = clientA;
    // completeProfile calls redirect() on success, which throws outside a
    // real Next.js request context — reaching a normal return here would
    // mean it *failed* validation, so a throw is the success path.
    await expect(completeProfile("0300 1234567", "/account")).rejects.toThrow();

    const { data: recheck } = await service.from("profiles").select("phone_number").eq("id", userA.id).single();
    expect(recheck?.phone_number).toBe("+92 300 1234567");
  });

  it("a second session for the same now-complete user sees phone_number already set (skip-straight-through)", async () => {
    const freshSession = await signedInClient(userA.email, password);
    const { data: profile, error } = await freshSession
      .from("profiles")
      .select("phone_number")
      .eq("id", userA.id)
      .single();
    expect(error).toBeNull();
    expect(profile?.phone_number).toBe("+92 300 1234567");
  });

  it("throws when the caller's session doesn't match — cannot complete someone else's profile", async () => {
    sessionState.client = clientB;
    // completeProfile always operates on the caller's own session id via
    // requireAuthenticated(), so this call updates B's own row, not A's —
    // asserting A's row is untouched is the meaningful check here.
    await expect(completeProfile("0301 7654321", "/account")).rejects.toThrow();

    const { data: recheckA } = await service.from("profiles").select("phone_number").eq("id", userA.id).single();
    expect(recheckA?.phone_number).toBe("+92 300 1234567"); // unchanged by B's call
  });
});

describe("RLS still blocks cross-user profile access with a real session (new email column included)", () => {
  it("customer B cannot read customer A's email/phone via direct select", async () => {
    const { data } = await clientB.from("profiles").select("email, phone_number").eq("id", userA.id);
    expect(data ?? []).toHaveLength(0);
  });
});
