"use server";

import { isLastAdminDemotion } from "@/src/lib/admin-guardrails";
import { ForbiddenError, requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { ProfileRole } from "@/src/types/database";

export type ChangeRoleResult =
  | { ok: true; newRole: ProfileRole }
  | { ok: false; error: "LAST_ADMIN" | "NOT_FOUND" | "UNKNOWN"; message: string };

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
