"use server";

import { ForbiddenError, requireAdmin } from "@/src/lib/auth/session";
import { mapOrderRow } from "@/src/lib/actions/order-mapping";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Order } from "@/src/types/database";

export type OrderDecisionResult =
  | { ok: true; order: Order }
  | { ok: false; error: "ORDER_NOT_FOUND" | "INVALID_TRANSITION" | "UNKNOWN"; message: string };

function mapRpcError(error: { message?: string }, action: string): OrderDecisionResult {
  const message = error.message ?? "";
  if (message.includes("ORDER_NOT_FOUND")) {
    return { ok: false, error: "ORDER_NOT_FOUND", message: "This order could not be found." };
  }
  if (message.includes("INVALID_TRANSITION")) {
    return {
      ok: false,
      error: "INVALID_TRANSITION",
      message: "This order isn't in a state that can be reviewed right now.",
    };
  }
  console.error(`[${action}]`, error);
  return { ok: false, error: "UNKNOWN", message: "Something went wrong reviewing this order." };
}

/**
 * approveOrder/rejectOrder both re-verify the caller is really an admin
 * from their session before doing anything — the passed adminId is cross-
 * checked against that verified identity (and used for reviewed_by/
 * actor_id), never trusted on its own. Not just a UI gate: this is the
 * actual authorization check, since orders has no client UPDATE policy at
 * all — only these service-role actions can ever change an order's status.
 */
export async function approveOrder(orderId: string, adminId: string): Promise<OrderDecisionResult> {
  const admin = await requireAdmin();
  if (admin.id !== adminId) throw new ForbiddenError("adminId does not match the authenticated session");

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("approve_order", {
    p_order_id: orderId,
    p_admin_id: admin.id,
  });

  if (error) return mapRpcError(error, "approveOrder");
  return { ok: true, order: mapOrderRow(data) };
}

export async function rejectOrder(
  orderId: string,
  adminId: string,
  reason: string,
): Promise<OrderDecisionResult> {
  const admin = await requireAdmin();
  if (admin.id !== adminId) throw new ForbiddenError("adminId does not match the authenticated session");

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("reject_order", {
    p_order_id: orderId,
    p_admin_id: admin.id,
    p_reason: reason,
  });

  if (error) return mapRpcError(error, "rejectOrder");
  return { ok: true, order: mapOrderRow(data) };
}
