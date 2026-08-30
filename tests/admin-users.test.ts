import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/**
 * changeUserRole/getProfilesForAdmin internally call next/headers
 * (cookies()) via the session client — same fix as the rest of this suite:
 * mock @/src/lib/supabase/server-session so requireAdmin() sees a real,
 * already-signed-in Supabase client of our choosing.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { changeUserRole } = await import("@/src/lib/actions/admin-users");
const { isLastAdminDemotion } = await import("@/src/lib/admin-guardrails");
const { getProfilesForAdmin } = await import("@/src/lib/order-queries");

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
const password = `AdminUsersTest!${randomUUID()}`;

let customer: { id: string; email: string };
let adminMain: { id: string; email: string };
let adminSecond: { id: string; email: string };
let clientCustomer: SupabaseClient;
let clientAdminMain: SupabaseClient;
let clientAdminSecond: SupabaseClient;

const userIds: string[] = [];

beforeAll(async () => {
  const emailCustomer = `admin-users-customer-${run}@example.com`;
  const emailAdminMain = `admin-users-admin-main-${run}@example.com`;
  const emailAdminSecond = `admin-users-admin-second-${run}@example.com`;

  const { data: createdCustomer, error: errCustomer } = await service.auth.admin.createUser({
    email: emailCustomer,
    password,
    email_confirm: true,
  });
  if (errCustomer) throw errCustomer;
  customer = { id: createdCustomer.user.id, email: emailCustomer };
  userIds.push(customer.id);

  const { data: createdAdminMain, error: errAdminMain } = await service.auth.admin.createUser({
    email: emailAdminMain,
    password,
    email_confirm: true,
  });
  if (errAdminMain) throw errAdminMain;
  adminMain = { id: createdAdminMain.user.id, email: emailAdminMain };
  userIds.push(adminMain.id);

  const { data: createdAdminSecond, error: errAdminSecond } = await service.auth.admin.createUser({
    email: emailAdminSecond,
    password,
    email_confirm: true,
  });
  if (errAdminSecond) throw errAdminSecond;
  adminSecond = { id: createdAdminSecond.user.id, email: emailAdminSecond };
  userIds.push(adminSecond.id);

  const { error: promoteMainErr } = await service.from("profiles").update({ role: "admin" }).eq("id", adminMain.id);
  if (promoteMainErr) throw promoteMainErr;
  const { error: promoteSecondErr } = await service
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", adminSecond.id);
  if (promoteSecondErr) throw promoteSecondErr;

  clientCustomer = await signedInClient(customer.email, password);
  clientAdminMain = await signedInClient(adminMain.email, password);
  clientAdminSecond = await signedInClient(adminSecond.email, password);
});

// See tests/helpers/cleanup.ts for why each step below runs independently
// instead of as one linear await chain (or, as this used to be, a for-loop
// that stopped at the first failing deleteUser call).
afterAll(async () => {
  await runCleanupSteps([
    {
      // audit_log.actor_id -> profiles(id) has no ON DELETE CASCADE — must
      // go before deleting the users themselves.
      label: "audit_log",
      run: async () => {
        if (userIds.length) await deleteWithRetry(() => service.from("audit_log").delete().in("actor_id", userIds), "audit_log");
      },
    },
    {
      label: "customer",
      run: async () => {
        if (customer?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
      },
    },
    {
      label: "adminMain",
      run: async () => {
        if (adminMain?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminMain.id), "adminMain");
      },
    },
    {
      label: "adminSecond",
      run: async () => {
        if (adminSecond?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminSecond.id), "adminSecond");
      },
    },
  ]);
}, 60_000); // 4 independent steps, each capped at 8s worst case (see tests/helpers/cleanup.ts)

describe("isLastAdminDemotion (pure guardrail logic)", () => {
  it("blocks when the target is the sole admin and would leave zero", () => {
    expect(isLastAdminDemotion("admin", "customer", 1)).toBe(true);
    expect(isLastAdminDemotion("admin", "agent", 1)).toBe(true);
  });

  it("allows when other admins remain", () => {
    expect(isLastAdminDemotion("admin", "customer", 2)).toBe(false);
  });

  it("doesn't apply when the target wasn't an admin, or is staying an admin", () => {
    expect(isLastAdminDemotion("customer", "agent", 1)).toBe(false);
    expect(isLastAdminDemotion("agent", "customer", 0)).toBe(false);
    expect(isLastAdminDemotion("admin", "admin", 1)).toBe(false);
  });
});

describe("changeUserRole — CRITICAL: a real admin session changing ANOTHER user's role through the actual action", () => {
  it("adminMain (real authenticated session) promotes customer to agent — persisted, correct audit_log entry", async () => {
    sessionState.client = clientAdminMain;

    const result = await changeUserRole(customer.id, "agent", adminMain.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newRole).toBe("agent");

    const { data: recheck } = await service.from("profiles").select("role").eq("id", customer.id).single();
    expect(recheck?.role).toBe("agent");

    const { data: auditRows } = await service
      .from("audit_log")
      .select("actor_id, action, target_type, target_id, metadata")
      .eq("target_id", customer.id)
      .eq("action", "role_changed")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(auditRows).toHaveLength(1);
    expect(auditRows?.[0]?.actor_id).toBe(adminMain.id);
    expect(auditRows?.[0]?.target_type).toBe("profile");
    expect(auditRows?.[0]?.metadata).toEqual({ old_role: "customer", new_role: "agent" });

    // Restore for the next test.
    await service.from("profiles").update({ role: "customer" }).eq("id", customer.id);
  });

  it("adminMain demotes adminSecond to customer while another admin remains — succeeds", async () => {
    sessionState.client = clientAdminMain;

    const result = await changeUserRole(adminSecond.id, "customer", adminMain.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newRole).toBe("customer");

    const { data: recheck } = await service.from("profiles").select("role").eq("id", adminSecond.id).single();
    expect(recheck?.role).toBe("customer");

    // Restore for cleanliness / any later tests.
    await service.from("profiles").update({ role: "admin" }).eq("id", adminSecond.id);
  });

  it("an admin can change their OWN role through the real action (self-change stays allowed, self-escalation stays blocked elsewhere)", async () => {
    sessionState.client = clientAdminSecond;

    const result = await changeUserRole(adminSecond.id, "agent", adminSecond.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newRole).toBe("agent");

    const { data: recheck } = await service.from("profiles").select("role").eq("id", adminSecond.id).single();
    expect(recheck?.role).toBe("agent");

    // Restore.
    await service.from("profiles").update({ role: "admin" }).eq("id", adminSecond.id);
  });
});

describe("changeUserRole — non-admin callers rejected by the server action itself, not just a hidden UI button", () => {
  it("a plain customer session calling changeUserRole on someone else is rejected", async () => {
    sessionState.client = clientCustomer;
    await expect(changeUserRole(adminSecond.id, "customer", customer.id)).rejects.toThrow();

    const { data: recheck } = await service.from("profiles").select("role").eq("id", adminSecond.id).single();
    expect(recheck?.role).toBe("admin"); // unchanged
  });

  it("a plain customer session calling changeUserRole on THEMSELVES (self-escalation attempt) is rejected", async () => {
    sessionState.client = clientCustomer;
    await expect(changeUserRole(customer.id, "admin", customer.id)).rejects.toThrow();

    const { data: recheck } = await service.from("profiles").select("role").eq("id", customer.id).single();
    expect(recheck?.role).toBe("customer"); // unchanged
  });

  it("throws when the passed adminId doesn't match the real authenticated session (spoofing attempt)", async () => {
    sessionState.client = clientCustomer; // real session is the customer
    await expect(changeUserRole(customer.id, "customer", adminMain.id)).rejects.toThrow();
  });
});

describe("getProfilesForAdmin — non-admin hitting /admin/users gets nothing from the server action, not just a hidden button", () => {
  it("a plain customer session is rejected outright", async () => {
    sessionState.client = clientCustomer;
    await expect(getProfilesForAdmin()).rejects.toThrow();
  });

  it("a real admin session gets the full profile list, including our test users", async () => {
    sessionState.client = clientAdminMain;
    const profiles = await getProfilesForAdmin();
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain(customer.id);
    expect(ids).toContain(adminMain.id);
    expect(ids).toContain(adminSecond.id);
  });
});

/**
 * changeUserRole's own last-admin check (above this file, in
 * src/lib/actions/admin-users.ts) is a plain SELECT-then-UPDATE with no
 * locking — advisory only. The real boundary is
 * trg_prevent_last_admin_demotion (20260830000001_prevent_last_admin_
 * demotion.sql), a BEFORE UPDATE trigger on profiles that locks every admin
 * row before counting, inside the same transaction as the write. This is
 * the only test in the suite that proves that boundary actually holds under
 * a genuine race — two real concurrent demotions, not sequential calls,
 * through the real server action so the app-level check races too.
 *
 * The count this trigger enforces is GLOBAL, not scoped to this test's own
 * users, and this live project normally has exactly one real admin
 * (whoever owns it). Reaching the actual critical boundary (exactly 2
 * admins system-wide, so demoting either one is only safe if the other
 * survives) requires temporarily including every other admin in this
 * setup — there's no way to test a global invariant using only test-owned
 * rows while a real admin sits underneath it, permanently satisfying the
 * floor. Every admin this test touches is restored in a `finally`, using
 * deleteWithRetry so the restoration itself doesn't silently fail — this
 * is the one place in the suite where that actually matters beyond cleanup
 * hygiene, since leaving a real account demoted would be a real incident,
 * not just test-data debt.
 */
describe("prevent_last_admin_demotion trigger — real concurrency, not just sequential calls", () => {
  it("concurrently demoting two different admins, with exactly 2 admins system-wide, lets exactly one succeed and never reaches zero", async () => {
    const { data: allAdmins, error: allAdminsErr } = await service.from("profiles").select("id").eq("role", "admin");
    if (allAdminsErr) throw allAdminsErr;
    const otherAdminIds = allAdmins.map((p) => p.id).filter((id) => id !== adminMain.id && id !== adminSecond.id);

    try {
      // Bring the global admin count down to exactly 2 (adminMain +
      // adminSecond). Each of these is done sequentially and is safe on its
      // own — more than one admin exists at every step here, so none of
      // them can trip the guard themselves.
      for (const id of otherAdminIds) {
        const { error } = await service.from("profiles").update({ role: "customer" }).eq("id", id);
        if (error) throw error;
      }

      const { count: preRaceCount, error: preRaceErr } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (preRaceErr) throw preRaceErr;
      expect(preRaceCount).toBe(2);

      // The actual race. Both calls read sessionState.client at the moment
      // they invoke the (mocked) session client — set once, before either
      // is dispatched, so both act as adminMain; this test is about the
      // database boundary holding under concurrency, not about modeling two
      // independent human sessions.
      sessionState.client = clientAdminMain;
      const [resultA, resultB] = await Promise.all([
        changeUserRole(adminMain.id, "customer", adminMain.id),
        changeUserRole(adminSecond.id, "customer", adminMain.id),
      ]);

      const results = [resultA, resultB];
      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].ok === false && failures[0].error).toBe("LAST_ADMIN");

      const { count: postRaceCount, error: postRaceErr } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (postRaceErr) throw postRaceErr;
      expect(postRaceCount).toBe(1); // exactly one survived — never zero, and the race didn't let both through
    } finally {
      await deleteWithRetry(
        () => service.from("profiles").update({ role: "admin" }).eq("id", adminMain.id),
        "restore adminMain",
      );
      await deleteWithRetry(
        () => service.from("profiles").update({ role: "admin" }).eq("id", adminSecond.id),
        "restore adminSecond",
      );
      for (const id of otherAdminIds) {
        await deleteWithRetry(() => service.from("profiles").update({ role: "admin" }).eq("id", id), `restore ${id}`);
      }
    }
  }, 30_000);
});
