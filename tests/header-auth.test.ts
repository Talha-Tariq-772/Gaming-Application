import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { randomTestPhone } from "./helpers/phone";
import { collectText, findElementOfType } from "./helpers/react-tree";

/**
 * Header is an async Server Component that reads next/headers cookies()
 * via the session client — same constraint as every other server piece in
 * this suite, same fix: mock the session client to a real, already-signed-
 * in Supabase client of our choosing. Since Header returns JSX (plain
 * React element objects, not DOM), it can be called directly and the
 * returned tree inspected structurally — no renderer/testing-library
 * needed, and this exercises the exact same function Next actually calls.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { default: Header } = await import("@/components/Header");
const { default: HeaderAuthMenu } = await import("@/src/components/HeaderAuthMenu");

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

const run = randomUUID().slice(0, 8);
const password = `HeaderTest!${randomUUID()}`;

let incompleteUser: { id: string; email: string };
let completeUser: { id: string; email: string };
let adminUser: { id: string; email: string };
let agentUser: { id: string; email: string };
let clientIncomplete: SupabaseClient;
let clientComplete: SupabaseClient;
let clientAdmin: SupabaseClient;
let clientAgent: SupabaseClient;
let anonClient: SupabaseClient;

beforeAll(async () => {
  anonClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: createdIncomplete, error: errIncomplete } = await service.auth.admin.createUser({
    email: `header-incomplete-${run}@example.com`,
    password,
    email_confirm: true,
  });
  if (errIncomplete) throw errIncomplete;
  incompleteUser = { id: createdIncomplete.user.id, email: createdIncomplete.user.email! };

  const { data: createdComplete, error: errComplete } = await service.auth.admin.createUser({
    email: `header-complete-${run}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Complete Tester", avatar_url: "https://example.com/avatar-complete.png" },
  });
  if (errComplete) throw errComplete;
  completeUser = { id: createdComplete.user.id, email: createdComplete.user.email! };
  await service.from("profiles").update({ phone_number: randomTestPhone() }).eq("id", completeUser.id);

  const { data: createdAdmin, error: errAdmin } = await service.auth.admin.createUser({
    email: `header-admin-${run}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin Tester" },
  });
  if (errAdmin) throw errAdmin;
  adminUser = { id: createdAdmin.user.id, email: createdAdmin.user.email! };
  await service
    .from("profiles")
    .update({ phone_number: randomTestPhone(), role: "admin" })
    .eq("id", adminUser.id);

  const { data: createdAgent, error: errAgent } = await service.auth.admin.createUser({
    email: `header-agent-${run}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Agent Tester" },
  });
  if (errAgent) throw errAgent;
  agentUser = { id: createdAgent.user.id, email: createdAgent.user.email! };
  await service
    .from("profiles")
    .update({ phone_number: randomTestPhone(), role: "agent" })
    .eq("id", agentUser.id);

  clientIncomplete = await signedInClient(incompleteUser.email, password);
  clientComplete = await signedInClient(completeUser.email, password);
  clientAdmin = await signedInClient(adminUser.email, password);
  clientAgent = await signedInClient(agentUser.email, password);
});

// See tests/helpers/cleanup.ts for why each step below runs independently
// instead of as one linear await chain — that used to mean one failing
// deleteUser call (e.g. incompleteUser) permanently blocked the rest
// (completeUser/adminUser/agentUser), even though none of them depend on it.
afterAll(async () => {
  await runCleanupSteps([
    {
      label: "incompleteUser",
      run: async () => {
        if (incompleteUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(incompleteUser.id), "incompleteUser");
      },
    },
    {
      label: "completeUser",
      run: async () => {
        if (completeUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(completeUser.id), "completeUser");
      },
    },
    {
      label: "adminUser",
      run: async () => {
        if (adminUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminUser.id), "adminUser");
      },
    },
    {
      label: "agentUser",
      run: async () => {
        if (agentUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(agentUser.id), "agentUser");
      },
    },
  ]);
}, 60_000); // 4 independent steps, each capped at 8s worst case (see tests/helpers/cleanup.ts)

describe("Header — real-session auth states", () => {
  it("signed out: shows Sign In, no complete-profile link, no auth menu", async () => {
    sessionState.client = anonClient;
    const el = await Header();
    const text = collectText(el).join(" ");
    expect(text).toContain("Sign In");
    expect(text).not.toContain("Complete your profile");
    expect(findElementOfType(el, HeaderAuthMenu)).toBeNull();
  });

  it("signed in, phone_number null: shows 'Complete your profile', not Sign In or the auth menu", async () => {
    sessionState.client = clientIncomplete;
    const el = await Header();
    const text = collectText(el).join(" ");
    expect(text).toContain("Complete your profile");
    expect(text).not.toContain("Sign In");
    expect(findElementOfType(el, HeaderAuthMenu)).toBeNull();
  });

  it("signed in, profile complete (customer): shows the auth menu with real Google name/avatar, isStaff false", async () => {
    sessionState.client = clientComplete;
    const el = await Header();
    const text = collectText(el).join(" ");
    expect(text).not.toContain("Sign In");
    expect(text).not.toContain("Complete your profile");

    const menu = findElementOfType<{ name: string; avatarUrl: string | null; isStaff: boolean }>(
      el,
      HeaderAuthMenu,
    );
    expect(menu).not.toBeNull();
    expect(menu?.props.name).toBe("Complete Tester");
    expect(menu?.props.avatarUrl).toBe("https://example.com/avatar-complete.png");
    expect(menu?.props.isStaff).toBe(false);
  });

  it("signed in, profile complete, role=admin: auth menu reports isStaff true", async () => {
    sessionState.client = clientAdmin;
    const el = await Header();
    const menu = findElementOfType<{ isStaff: boolean }>(el, HeaderAuthMenu);
    expect(menu?.props.isStaff).toBe(true);
  });

  it("signed in, profile complete, role=agent: auth menu also reports isStaff true", async () => {
    sessionState.client = clientAgent;
    const el = await Header();
    const menu = findElementOfType<{ isStaff: boolean }>(el, HeaderAuthMenu);
    expect(menu?.props.isStaff).toBe(true);
  });
});
