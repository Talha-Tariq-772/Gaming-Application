"use server";

import { randomBytes } from "node:crypto";
import { ForbiddenError, requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";

export interface PasswordResetRequest {
  profileId: string;
  fullName: string | null;
  phoneNumber: string | null;
  requestedAt: string;
}

/**
 * Viewable by admin or agent (same allowAgent:true pattern as
 * getOrdersForAdmin) — an agent can see the queue and gather context, but
 * only an admin can actually issue a reset (manualPasswordReset below).
 */
export async function getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  await requireAdmin({ allowAgent: true });

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, password_reset_requested_at")
    .not("password_reset_requested_at", "is", null)
    .order("password_reset_requested_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    profileId: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    requestedAt: row.password_reset_requested_at as string,
  }));
}

export interface RecentOrderSummary {
  id: string;
  paymentReference: string;
  status: string;
  amountExact: number;
  createdAt: string;
}

/** What the agent checks the requester's story against — "recent order
 * details" per the task, not a full order history. */
export async function getRecentOrdersForProfile(profileId: string): Promise<RecentOrderSummary[]> {
  await requireAdmin({ allowAgent: true });

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, payment_reference, status, amount_exact, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    paymentReference: row.payment_reference,
    status: row.status,
    amountExact: Number(row.amount_exact),
    createdAt: row.created_at,
  }));
}

export type ManualResetResult =
  | { ok: true; temporaryPassword: string }
  | { ok: false; message: string };

function generateTemporaryPassword(): string {
  // 12 chars, base36 — comfortably over the 8-char minimum, and no
  // realistic chance of landing in the common-password denylist.
  return randomBytes(9).toString("base64url").slice(0, 12);
}

/**
 * Admin-only (not agent) — mirrors approveOrder/rejectOrder's own
 * admin-only mutation boundary in src/lib/actions/admin-orders.ts. Issues
 * a fresh random password directly (service role, bypasses the synthetic
 * email entirely) and returns it once so the acting admin can relay it to
 * the customer over WhatsApp after verifying their identity against
 * recent order details — the same human-verified, WhatsApp-mediated
 * pattern this app already uses for order fulfilment, not a new email
 * flow. Every call is logged to audit_log with the acting admin's real,
 * session-verified id.
 */
export async function manualPasswordReset(profileId: string, adminId: string): Promise<ManualResetResult> {
  const admin = await requireAdmin();
  if (admin.id !== adminId) throw new ForbiddenError("adminId does not match the authenticated session");

  const service = createServiceClient();
  const temporaryPassword = generateTemporaryPassword();

  const { error: updateErr } = await service.auth.admin.updateUserById(profileId, {
    password: temporaryPassword,
  });
  if (updateErr) {
    console.error("[manualPasswordReset]", updateErr);
    return { ok: false, message: "Could not reset this password. Try again." };
  }

  await service.from("profiles").update({ password_reset_requested_at: null }).eq("id", profileId);

  const { error: auditErr } = await service.from("audit_log").insert({
    actor_id: admin.id,
    action: "password_reset_manual",
    target_type: "profile",
    target_id: profileId,
    metadata: {},
  });
  if (auditErr) console.error("[manualPasswordReset] audit_log insert failed", auditErr);

  return { ok: true, temporaryPassword };
}
