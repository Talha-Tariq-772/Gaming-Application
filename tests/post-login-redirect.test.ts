import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolvePostLoginRedirect, type PostLoginProfile } from "@/src/lib/auth/post-login-redirect";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { randomTestPhone } from "./helpers/phone";

const ORIGIN = "https://example.com";

describe("resolvePostLoginRedirect — pure decision logic", () => {
  it("sends an incomplete profile (null phone_number) to /complete-profile, preserving next", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/checkout", { phone_number: null, role: "customer" });
    expect(url).toBe("https://example.com/complete-profile?next=%2Fcheckout");
  });

  it("sends a null profile (no row yet) to /complete-profile too", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/account", null);
    expect(url).toBe("https://example.com/complete-profile?next=%2Faccount");
  });

  it("does not double up next when it's already /complete-profile", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/complete-profile", { phone_number: null, role: "customer" });
    expect(url).toBe("https://example.com/complete-profile");
  });

  it("sends a complete customer profile to `next` (default /account)", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/account", { phone_number: "+92 300 1112222", role: "customer" });
    expect(url).toBe("https://example.com/account");
  });

  it("sends a complete customer profile to wherever they were headed, not just /account", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/checkout", { phone_number: "+92 300 1112222", role: "customer" });
    expect(url).toBe("https://example.com/checkout");
  });

  it("sends a complete admin profile straight to /admin, overriding next", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/account", { phone_number: "+92 300 1112222", role: "admin" });
    expect(url).toBe("https://example.com/admin");
  });

  it("sends a complete agent profile straight to /admin too", () => {
    const url = resolvePostLoginRedirect(ORIGIN, "/checkout", { phone_number: "+92 300 1112222", role: "agent" });
    expect(url).toBe("https://example.com/admin");
  });
});

describe("resolvePostLoginRedirect — fed real profile rows from the database", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  const run = randomUUID().slice(0, 8);
  const password = `PostLoginTest!${randomUUID()}`;

  let adminUser: { id: string; email: string };
  let customerUser: { id: string; email: string };

  beforeAll(async () => {
    const { data: createdAdmin, error: errAdmin } = await service.auth.admin.createUser({
      email: `postlogin-admin-${run}@example.com`,
      password,
      email_confirm: true,
    });
    if (errAdmin) throw errAdmin;
    adminUser = { id: createdAdmin.user.id, email: createdAdmin.user.email! };
    await service.from("profiles").update({ phone_number: randomTestPhone(), role: "admin" }).eq("id", adminUser.id);

    const { data: createdCustomer, error: errCustomer } = await service.auth.admin.createUser({
      email: `postlogin-customer-${run}@example.com`,
      password,
      email_confirm: true,
    });
    if (errCustomer) throw errCustomer;
    customerUser = { id: createdCustomer.user.id, email: createdCustomer.user.email! };
    await service.from("profiles").update({ phone_number: randomTestPhone() }).eq("id", customerUser.id);
  });

  afterAll(async () => {
    await runCleanupSteps([
      {
        label: "adminUser",
        run: async () => {
          if (adminUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminUser.id), "adminUser");
        },
      },
      {
        label: "customerUser",
        run: async () => {
          if (customerUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customerUser.id), "customerUser");
        },
      },
    ]);
  }, 30_000); // 2 independent steps, each capped at 8s worst case (see tests/helpers/cleanup.ts)

  it("admin: signs in, real profile row says role=admin, decision is /admin regardless of next", async () => {
    const client = await signedInClient(adminUser.email, password);
    const { data: profile, error } = await client
      .from("profiles")
      .select("phone_number, role")
      .eq("id", adminUser.id)
      .single();
    expect(error).toBeNull();

    const target = resolvePostLoginRedirect(ORIGIN, "/account", profile as PostLoginProfile);
    expect(target).toBe("https://example.com/admin");
  });

  it("customer: signs in, real profile row says role=customer, decision is /account as before", async () => {
    const client = await signedInClient(customerUser.email, password);
    const { data: profile, error } = await client
      .from("profiles")
      .select("phone_number, role")
      .eq("id", customerUser.id)
      .single();
    expect(error).toBeNull();

    const target = resolvePostLoginRedirect(ORIGIN, "/account", profile as PostLoginProfile);
    expect(target).toBe("https://example.com/account");
  });
});
