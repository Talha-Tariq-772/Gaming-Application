"use server";

import { isLastAdminDemotion, isLastAdminRemoval } from "@/src/lib/admin-guardrails";
import { ForbiddenError, requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { ProfileRole } from "@/src/types/database";

export type ChangeRoleResult =
  | { ok: true; newRole: ProfileRole }
  | { ok: false; error: "LAST_ADMIN" | "NOT_FOUND" | "UNKNOWN"; message: string };

/**
 * SQLSTATE raised by trg_prevent_last_admin_demotion
 * (20260830000001_prevent_last_admin_demotion.sql) — the real boundary, a
 * BEFORE UPDATE trigger on profiles that locks and re-counts admins inside
 * the same transaction as the write. The count check below this file is
 * only advisory: a fast, friendly rejection in the common case, without a
 * round trip, but not itself race-proof or safe against a stray admin row.
 * When the trigger is what actually catches it (the advisory check passed
 * but the DB still says no — a concurrent demotion, most likely), this code
 * lets that surface as the same friendly LAST_ADMIN result instead of a raw
 * Postgres error.
 */
const LAST_ADMIN_TRIGGER_ERRCODE = "LA001";

/**
 * The security-critical admin action. Re-verifies the caller's role fresh
 * from the database via requireAdmin() — never trusts a client value —
 * and cross-checks the passed adminId against that verified session,
 * matching the same pattern as approveOrder/rejectOrder.
 *
 * The actual UPDATE deliberately goes through the admin's OWN session
 * client, not the service role. This is what makes the write really
 * exercise the profiles_update RLS policy and the
 * prevent_unauthorized_role_change trigger on every single call, not just
 * the TS-layer check above — belt and braces against a bug in this action
 * ever being the only thing standing between a customer and
 * self-promotion. (The trigger only cares whether the ACTOR's own role is
 * admin, not whose row is being updated, so this also correctly allows an
 * admin to change their own role — the self-demotion guardrail below is a
 * warning, not a block, per spec.)
 */
export async function changeUserRole(
  targetUserId: string,
  newRole: ProfileRole,
  adminId: string,
): Promise<ChangeRoleResult> {
  const admin = await requireAdmin();
  if (admin.id !== adminId) throw new ForbiddenError("adminId does not match the authenticated session");

  const service = createServiceClient();

  const { data: target, error: targetErr } = await service
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single();
  if (targetErr || !target) {
    return { ok: false, error: "NOT_FOUND", message: "This user could not be found." };
  }

  const oldRole = target.role as ProfileRole;
  if (oldRole === newRole) {
    return { ok: true, newRole };
  }

  // Guardrail: never leave zero admins.
  if (oldRole === "admin" && newRole !== "admin") {
    const { count, error: countErr } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) {
      console.error("[changeUserRole] admin count", countErr);
      return { ok: false, error: "UNKNOWN", message: "Something went wrong checking the admin count." };
    }
    if (isLastAdminDemotion(oldRole, newRole, count ?? 0)) {
      return {
        ok: false,
        error: "LAST_ADMIN",
        message: "Cannot remove the last remaining admin. Promote someone else first.",
      };
    }
  }

  const session = await createSessionClient();
  const { data: updated, error: updateErr } = await session
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId)
    .select("role")
    .single();

  if (updateErr || !updated) {
    if (updateErr?.code === LAST_ADMIN_TRIGGER_ERRCODE) {
      return {
        ok: false,
        error: "LAST_ADMIN",
        message: "Cannot remove the last remaining admin. Promote someone else first.",
      };
    }

    // Observed directly under real concurrent load (two admins demoted at
    // once): the side of the race that the trigger's FOR UPDATE lock blocks
    // doesn't always come back as LA001 — PostgREST can report PGRST116
    // ("0 rows") for that specific failure instead of surfacing the
    // trigger's own error. Since targetUserId was already confirmed to
    // exist a few lines up and nothing else in this flow deletes profiles
    // rows, "0 rows from an update-by-id whose id we just verified" is not
    // a real not-found case — check the row's actual current role rather
    // than trust the error code: if it's still oldRole, nothing was
    // written, and the last-admin trigger is the only thing in this path
    // that rejects a write without changing anything.
    if (updateErr?.code === "PGRST116") {
      const { data: recheck } = await service.from("profiles").select("role").eq("id", targetUserId).single();
      if (recheck?.role === oldRole) {
        return {
          ok: false,
          error: "LAST_ADMIN",
          message: "Cannot remove the last remaining admin. Promote someone else first.",
        };
      }
    }

    console.error("[changeUserRole] update", updateErr);
    return { ok: false, error: "UNKNOWN", message: "Something went wrong changing this user's role." };
  }

  const { error: auditErr } = await service.from("audit_log").insert({
    actor_id: admin.id,
    action: "role_changed",
    target_type: "profile",
    target_id: targetUserId,
    metadata: { old_role: oldRole, new_role: newRole },
  });
  if (auditErr) console.error("[changeUserRole] audit log", auditErr);

  return { ok: true, newRole: updated.role as ProfileRole };
}

/**
 * SQLSTATE raised by prevent_last_admin_removal
 * (20260909000001_delete_users.sql) — shared by both the soft-delete
 * (BEFORE UPDATE) and hard-delete (BEFORE DELETE) triggers, same "advisory
 * check + real trigger boundary" relationship LAST_ADMIN_TRIGGER_ERRCODE
 * has to changeUserRole above.
 */
const LAST_ADMIN_REMOVAL_ERRCODE = "LA002";

export type UserDeletionPreview =
  | { ok: true; orderCount: number; willHardDelete: boolean }
  | { ok: false; message: string };

/**
 * Read-only lookup for DeleteUserDialog: how many orders this user placed
 * (shown in the confirmation copy), and whether deleteUser will hard- or
 * soft-delete them. Checks the same four FKs Step 0 of this feature found
 * pointing at profiles(id) — orders.user_id, orders.reviewed_by,
 * audit_log.actor_id, news_posts.author_id. Best-effort hint only:
 * deleteUser re-derives all of this for real immediately before acting,
 * the same relationship DeleteGameDialog's willHardDelete prop has to
 * deleteGame's own check.
 */
export async function previewUserDeletion(targetUserId: string): Promise<UserDeletionPreview> {
  await requireAdmin();
  const supabase = createServiceClient();

  const [ordersAsCustomer, ordersReviewed, auditEntries, newsPosts] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("reviewed_by", targetUserId),
    supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_id", targetUserId),
    supabase.from("news_posts").select("id", { count: "exact", head: true }).eq("author_id", targetUserId),
  ]);
  for (const [label, result] of [
    ["orders", ordersAsCustomer],
    ["orders reviewed", ordersReviewed],
    ["audit_log", auditEntries],
    ["news_posts", newsPosts],
  ] as const) {
    if (result.error) {
      console.error(`[previewUserDeletion] ${label} check`, result.error);
      return { ok: false, message: "Something went wrong checking this user's history." };
    }
  }

  const orderCount = ordersAsCustomer.count ?? 0;
  const isReferenced =
    orderCount > 0 || (ordersReviewed.count ?? 0) > 0 || (auditEntries.count ?? 0) > 0 || (newsPosts.count ?? 0) > 0;

  return { ok: true, orderCount, willHardDelete: !isReferenced };
}

export type DeleteUserResult =
  | { ok: true; hardDeleted: boolean }
  | { ok: false; error: "SELF" | "LAST_ADMIN" | "NOT_FOUND" | "UNKNOWN"; message: string };

/**
 * Hard-deletes (auth.admin.deleteUser(id, false), cascading through
 * profiles.id's ON DELETE CASCADE from auth.users) only when the profile has
 * none of: orders placed, orders reviewed, audit_log entries authored, or
 * news_posts authored. Any of those present soft-deletes instead:
 * deleted_at is stamped on the profiles row — preserving it, and every row
 * that references it, exactly as-is — and the auth.users row is separately
 * soft-deleted (auth.admin.deleteUser(id, true): GoTrue's own
 * irreversible-but-non-destructive delete, which scrambles the auth
 * email/phone and blocks all future sign-in without touching
 * public.profiles at all). Net effect: the account can never sign in again,
 * but every order/review/audit/news row it's attached to stays correctly
 * attributed to it forever.
 *
 * Self-delete is rejected outright and unconditionally — never merely a
 * warning the way self-role-change is (see ChangeRoleDialog's isSelf
 * prop). Combined with that, the last-admin guard below only matters for a
 * DIFFERENT admin being deleted: an admin can never remove themselves, so
 * this app can only ever reach zero admins via two different admins each
 * deleting a different other admin at the same moment — exactly the race
 * trg_prevent_last_admin_soft_delete/trg_prevent_last_admin_hard_delete
 * (20260909000001_delete_users.sql) exist to block, the real boundary
 * behind the advisory isLastAdminRemoval check below.
 */
export async function deleteUser(targetUserId: string, adminId: string): Promise<DeleteUserResult> {
  const admin = await requireAdmin();
  if (admin.id !== adminId) throw new ForbiddenError("adminId does not match the authenticated session");

  if (targetUserId === admin.id) {
    return { ok: false, error: "SELF", message: "You cannot delete your own account." };
  }

  const service = createServiceClient();

  const { data: target, error: targetErr } = await service
    .from("profiles")
    .select("id, role, deleted_at")
    .eq("id", targetUserId)
    .single();
  if (targetErr || !target) {
    return { ok: false, error: "NOT_FOUND", message: "This user could not be found." };
  }
  // Idempotent: a stale UI re-submitting delete on an already-deleted row
  // is treated as success rather than an error.
  if (target.deleted_at) {
    return { ok: true, hardDeleted: false };
  }

  const role = target.role as ProfileRole;

  if (role === "admin") {
    const { count, error: countErr } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .is("deleted_at", null);
    if (countErr) {
      console.error("[deleteUser] admin count", countErr);
      return { ok: false, error: "UNKNOWN", message: "Something went wrong checking the admin count." };
    }
    if (isLastAdminRemoval(role, count ?? 0)) {
      return {
        ok: false,
        error: "LAST_ADMIN",
        message: "Cannot delete the last remaining admin. Promote someone else first.",
      };
    }
  }

  const [ordersAsCustomer, ordersReviewed, auditEntries, newsPosts] = await Promise.all([
    service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    service.from("orders").select("id", { count: "exact", head: true }).eq("reviewed_by", targetUserId),
    service.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_id", targetUserId),
    service.from("news_posts").select("id", { count: "exact", head: true }).eq("author_id", targetUserId),
  ]);
  for (const [label, result] of [
    ["orders", ordersAsCustomer],
    ["orders reviewed", ordersReviewed],
    ["audit_log", auditEntries],
    ["news_posts", newsPosts],
  ] as const) {
    if (result.error) {
      console.error(`[deleteUser] ${label} check`, result.error);
      return { ok: false, error: "UNKNOWN", message: "Something went wrong checking this user's history." };
    }
  }
  const isReferenced =
    (ordersAsCustomer.count ?? 0) > 0 ||
    (ordersReviewed.count ?? 0) > 0 ||
    (auditEntries.count ?? 0) > 0 ||
    (newsPosts.count ?? 0) > 0;

  if (isReferenced) {
    // The DB write goes first, specifically so a LAST_ADMIN rejection from
    // trg_prevent_last_admin_soft_delete never leaves this account
    // auth-layer-banned while its profile row is still untouched — that
    // would lock out an admin the trigger just said must not be removable.
    const { error: updateErr } = await service
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (updateErr) {
      if (updateErr.code === LAST_ADMIN_REMOVAL_ERRCODE) {
        return {
          ok: false,
          error: "LAST_ADMIN",
          message: "Cannot delete the last remaining admin. Promote someone else first.",
        };
      }
      console.error("[deleteUser] soft delete", updateErr);
      return { ok: false, error: "UNKNOWN", message: "Something went wrong deleting this user." };
    }

    const { error: authErr } = await service.auth.admin.deleteUser(targetUserId, true);
    if (authErr) {
      // Compensating rollback — don't leave the profile flagged deleted if
      // its account can still actually sign in.
      const { error: revertErr } = await service
        .from("profiles")
        .update({ deleted_at: null })
        .eq("id", targetUserId);
      if (revertErr) console.error("[deleteUser] rollback after auth failure", revertErr);
      console.error("[deleteUser] auth soft delete", authErr);
      return { ok: false, error: "UNKNOWN", message: "Something went wrong deleting this user." };
    }

    const { error: auditErr } = await service.from("audit_log").insert({
      actor_id: admin.id,
      action: "user_deleted",
      target_type: "profile",
      target_id: targetUserId,
      metadata: { hard_deleted: false, order_count: ordersAsCustomer.count ?? 0 },
    });
    if (auditErr) console.error("[deleteUser] audit log", auditErr);

    return { ok: true, hardDeleted: false };
  }

  const { error: authErr } = await service.auth.admin.deleteUser(targetUserId, false);
  if (authErr) {
    // Best-effort: GoTrue may not reliably surface the raw trigger errcode
    // through a cascaded auth.users delete failure. When it does, this
    // still turns it into the same friendly LAST_ADMIN result; when it
    // doesn't, the trigger has still blocked the delete at the DB level —
    // only the message surfaced to the UI is generic instead of specific.
    if (authErr.code === LAST_ADMIN_REMOVAL_ERRCODE) {
      return {
        ok: false,
        error: "LAST_ADMIN",
        message: "Cannot delete the last remaining admin. Promote someone else first.",
      };
    }
    console.error("[deleteUser] hard delete", authErr);
    return { ok: false, error: "UNKNOWN", message: "Something went wrong deleting this user." };
  }

  // The profiles row is already gone (cascaded from auth.users).
  // audit_log.target_id is a bare uuid with no FK constraint, so logging it
  // here is safe even though the row it names no longer exists.
  const { error: auditErr } = await service.from("audit_log").insert({
    actor_id: admin.id,
    action: "user_deleted",
    target_type: "profile",
    target_id: targetUserId,
    metadata: { hard_deleted: true },
  });
  if (auditErr) console.error("[deleteUser] audit log", auditErr);

  return { ok: true, hardDeleted: true };
}
