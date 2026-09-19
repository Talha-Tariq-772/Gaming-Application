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

const { changeUserRole, deleteUser, previewUserDeletion } = await import("@/src/lib/actions/admin-users");
const { isLastAdminDemotion, isLastAdminRemoval } = await import("@/src/lib/admin-guardrails");
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
/** Has one real order row — proves deleteUser soft-deletes rather than
 * hard-deletes a referenced account, and that the order survives intact. */
let customerWithOrder: { id: string; email: string };
let clientCustomer: SupabaseClient;
let clientAdminMain: SupabaseClient;
let clientAdminSecond: SupabaseClient;

const userIds: string[] = [];
let orderIdForCustomerWithOrder: string;

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

  const emailCustomerWithOrder = `admin-users-customer-order-${run}@example.com`;
  const { data: createdCustomerWithOrder, error: errCustomerWithOrder } = await service.auth.admin.createUser({
    email: emailCustomerWithOrder,
    password,
    email_confirm: true,
  });
  if (errCustomerWithOrder) throw errCustomerWithOrder;
  customerWithOrder = { id: createdCustomerWithOrder.user.id, email: emailCustomerWithOrder };
  userIds.push(customerWithOrder.id);

  const { data: createdOrder, error: orderErr } = await service
    .from("orders")
    .insert({ user_id: customerWithOrder.id, payment_reference: `admin-users-del-${run}`, amount_exact: 1000 })
    .select("id")
    .single();
  if (orderErr) throw orderErr;
  orderIdForCustomerWithOrder = createdOrder.id;

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
      // orders.user_id -> profiles(id) has no ON DELETE CASCADE either —
      // must go before deleting customerWithOrder, same reasoning as
      // audit_log above. Deleting the order (not the customer) is exactly
      // what proves deleteUser's soft-delete path leaves order history
      // untouched: if the delete tests below actually hard-deleted this
      // customer instead of soft-deleting them, this order would already
      // be gone (cascaded) or orphaned, and this delete would either be a
      // no-op or fail depending on which.
      label: "orderForCustomerWithOrder",
      run: async () => {
        if (orderIdForCustomerWithOrder) {
          await deleteWithRetry(() => service.from("orders").delete().eq("id", orderIdForCustomerWithOrder), "orderForCustomerWithOrder");
        }
      },
    },
    {
      label: "customer",
      run: async () => {
        if (customer?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
      },
    },
    {
      // Regardless of whether the tests below actually soft-deleted this
      // account, a plain hard delete cleans it up either way — GoTrue
      // allows a real delete on top of an already-soft-deleted user.
      label: "customerWithOrder",
      run: async () => {
        if (customerWithOrder?.id) {
          await deleteWithRetry(() => service.auth.admin.deleteUser(customerWithOrder.id), "customerWithOrder");
        }
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

describe("isLastAdminRemoval (pure guardrail logic)", () => {
  it("blocks when the target is admin and is the sole remaining one", () => {
    expect(isLastAdminRemoval("admin", 1)).toBe(true);
  });

  it("allows when other admins remain", () => {
    expect(isLastAdminRemoval("admin", 2)).toBe(false);
  });

  it("doesn't apply to a non-admin target, regardless of count", () => {
    expect(isLastAdminRemoval("customer", 1)).toBe(false);
    expect(isLastAdminRemoval("agent", 0)).toBe(false);
  });
});

describe("previewUserDeletion — CRITICAL: the order-history check deleteUser itself relies on", () => {
  it("a customer with zero orders/reviews/audit/news previews as hard-deletable, order count 0", async () => {
    sessionState.client = clientAdminMain;
    const result = await previewUserDeletion(customer.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderCount).toBe(0);
    expect(result.willHardDelete).toBe(true);
  });

  it("a customer with a real order previews as soft-deletable, with the real order count", async () => {
    sessionState.client = clientAdminMain;
    const result = await previewUserDeletion(customerWithOrder.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderCount).toBe(1);
    expect(result.willHardDelete).toBe(false);
  });

  it("a plain customer session is rejected outright", async () => {
    sessionState.client = clientCustomer;
    await expect(previewUserDeletion(adminSecond.id)).rejects.toThrow();
  });
});

describe("deleteUser — self-delete is always blocked, unconditionally (never merely a warning)", () => {
  it("adminMain attempting to delete their OWN account is rejected with SELF; account is untouched", async () => {
    sessionState.client = clientAdminMain;
    const result = await deleteUser(adminMain.id, adminMain.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("SELF");

    const { data: recheck } = await service.from("profiles").select("deleted_at").eq("id", adminMain.id).single();
    expect(recheck?.deleted_at).toBeNull();
  });
});

describe("deleteUser — non-admin callers rejected by the server action itself, not just a hidden UI button", () => {
  it("a plain customer session calling deleteUser on someone else is rejected", async () => {
    sessionState.client = clientCustomer;
    await expect(deleteUser(adminSecond.id, customer.id)).rejects.toThrow();

    const { data: recheck } = await service.from("profiles").select("deleted_at").eq("id", adminSecond.id).single();
    expect(recheck?.deleted_at).toBeNull();
  });

  it("throws when the passed adminId doesn't match the real authenticated session (spoofing attempt)", async () => {
    sessionState.client = clientCustomer; // real session is the customer
    await expect(deleteUser(customer.id, adminMain.id)).rejects.toThrow();
  });
});

describe("deleteUser — CRITICAL: a real admin session deleting ANOTHER user through the actual action", () => {
  it("hard-deletes a genuinely empty account (no orders/reviews/audit/news) — profile and auth user both actually gone", async () => {
    const email = `admin-users-hard-delete-${run}@example.com`;
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    const targetId = created.user.id;

    try {
      sessionState.client = clientAdminMain;
      const result = await deleteUser(targetId, adminMain.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.hardDeleted).toBe(true);

      const { data: profileRow, error: profileErr } = await service
        .from("profiles")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      expect(profileErr).toBeNull();
      expect(profileRow).toBeNull(); // real DELETE, cascaded — not just flagged

      const { data: authCheck } = await service.auth.admin.getUserById(targetId);
      expect(authCheck?.user).toBeNull();

      const { data: auditRows } = await service
        .from("audit_log")
        .select("actor_id, action, target_type, metadata")
        .eq("target_id", targetId)
        .eq("action", "user_deleted")
        .order("created_at", { ascending: false })
        .limit(1);
      expect(auditRows).toHaveLength(1);
      expect(auditRows?.[0]?.actor_id).toBe(adminMain.id);
      expect(auditRows?.[0]?.metadata).toMatchObject({ hard_deleted: true });
    } finally {
      // Best-effort only: the whole point of this test is that deleteUser
      // already removed this account. A second delete on an
      // already-gone user is expected to no-op/error harmlessly here —
      // this is not asserted, just a safety net if the test failed before
      // reaching the real delete call above.
      await service.auth.admin.deleteUser(targetId).catch(() => {});
    }
  });

  it("soft-deletes a customer WITH order history — profile stays, order remains intact and correctly attributed, sign-in is blocked afterward", async () => {
    sessionState.client = clientAdminMain;
    const result = await deleteUser(customerWithOrder.id, adminMain.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hardDeleted).toBe(false);

    // Profile row survives, flagged rather than removed.
    const { data: profileRow } = await service
      .from("profiles")
      .select("id, deleted_at")
      .eq("id", customerWithOrder.id)
      .single();
    expect(profileRow?.id).toBe(customerWithOrder.id);
    expect(profileRow?.deleted_at).not.toBeNull();

    // The order this customer placed is untouched and still attributed to them.
    const { data: orderRow } = await service
      .from("orders")
      .select("id, user_id")
      .eq("id", orderIdForCustomerWithOrder)
      .single();
    expect(orderRow?.user_id).toBe(customerWithOrder.id);

    // The account can no longer sign in.
    const freshClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: signInErr } = await freshClient.auth.signInWithPassword({
      email: customerWithOrder.email,
      password,
    });
    expect(signInErr).not.toBeNull();

    const { data: auditRows } = await service
      .from("audit_log")
      .select("actor_id, action, metadata")
      .eq("target_id", customerWithOrder.id)
      .eq("action", "user_deleted")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(auditRows).toHaveLength(1);
    expect(auditRows?.[0]?.metadata).toMatchObject({ hard_deleted: false, order_count: 1 });
  });

  it("a repeated delete on an already soft-deleted user is idempotent, not an error", async () => {
    sessionState.client = clientAdminMain;
    const result = await deleteUser(customerWithOrder.id, adminMain.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hardDeleted).toBe(false);
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
 *
 * Gated behind RUN_ADMIN_DEMOTION_RACE_TEST — does NOT run by default, even
 * in the full suite. The `finally` above restores every admin it touches,
 * but that's a promise this test keeps only if it gets to run to
 * completion: an interrupted process (killed mid-run, a crash between the
 * temporary demotions and the restore) leaves the real admin demoted, on
 * whatever project this suite is pointed at. That's an acceptable risk to
 * take deliberately, on purpose, against a project you know is safe to
 * briefly touch — not a risk this suite should take on every run against
 * whatever project happens to be configured, including one that will hold
 * real customer data. Run explicitly with:
 *   RUN_ADMIN_DEMOTION_RACE_TEST=1 npx vitest run tests/admin-users.test.ts
 */
describe.skipIf(!process.env.RUN_ADMIN_DEMOTION_RACE_TEST)(
  "prevent_last_admin_demotion trigger — real concurrency, not just sequential calls",
  () => {
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
  },
);

/**
 * prevent_last_admin_removal (20260909000001_delete_users.sql) shares one
 * function and one locking strategy across both the soft-delete (UPDATE)
 * and hard-delete (DELETE) triggers it backs — see that migration. This
 * exercises the UPDATE path directly against profiles.deleted_at, bypassing
 * deleteUser's auth-layer step (auth.admin.deleteUser(id, true)) entirely,
 * specifically because that call is documented as irreversible: unlike the
 * demotion race test above (which only ever touches profiles.role and can
 * freely restore it), there is no safe way to "undo" a real admin account
 * having its auth email/phone scrambled if this test's setup or a crash
 * left it in that state. Testing the trigger via a raw, fully-reversible
 * profiles UPDATE proves the exact same database boundary — both triggers
 * call the identical function with the identical row-locking approach —
 * without ever risking an irreversible action against whatever real admin
 * happens to be configured on this project.
 *
 * Same env-gated, same restore-in-finally discipline as the demotion race
 * test, and the same reasoning for why: NOT part of the default suite.
 *   RUN_ADMIN_DELETION_RACE_TEST=1 npx vitest run tests/admin-users.test.ts
 */
describe.skipIf(!process.env.RUN_ADMIN_DELETION_RACE_TEST)(
  "prevent_last_admin_removal trigger — real concurrency on the soft-delete path, not just sequential calls",
  () => {
    it("concurrently soft-deleting two different admins, with exactly 2 admins system-wide, lets exactly one succeed and never reaches zero", async () => {
      const { data: allAdmins, error: allAdminsErr } = await service
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .is("deleted_at", null);
      if (allAdminsErr) throw allAdminsErr;
      const otherAdminIds = allAdmins.map((p) => p.id).filter((id) => id !== adminMain.id && id !== adminSecond.id);

      try {
        for (const id of otherAdminIds) {
          const { error } = await service.from("profiles").update({ role: "customer" }).eq("id", id);
          if (error) throw error;
        }

        const { count: preRaceCount, error: preRaceErr } = await service
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .is("deleted_at", null);
        if (preRaceErr) throw preRaceErr;
        expect(preRaceCount).toBe(2);

        const now = new Date().toISOString();
        const [resultA, resultB] = await Promise.all([
          service.from("profiles").update({ deleted_at: now }).eq("id", adminMain.id),
          service.from("profiles").update({ deleted_at: now }).eq("id", adminSecond.id),
        ]);

        const results = [resultA, resultB];
        const successes = results.filter((r) => !r.error);
        const failures = results.filter((r) => r.error);
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0].error?.code).toBe("LA002");

        const { count: postRaceCount, error: postRaceErr } = await service
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .is("deleted_at", null);
        if (postRaceErr) throw postRaceErr;
        expect(postRaceCount).toBe(1); // exactly one survived — never zero
      } finally {
        await deleteWithRetry(
          () => service.from("profiles").update({ deleted_at: null }).eq("id", adminMain.id),
          "restore adminMain",
        );
        await deleteWithRetry(
          () => service.from("profiles").update({ deleted_at: null }).eq("id", adminSecond.id),
          "restore adminSecond",
        );
        for (const id of otherAdminIds) {
          await deleteWithRetry(() => service.from("profiles").update({ role: "admin" }).eq("id", id), `restore ${id}`);
        }
      }
    }, 30_000);
  },
);
