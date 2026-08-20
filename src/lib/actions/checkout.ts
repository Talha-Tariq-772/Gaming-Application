"use server";

import { requireAuthenticated, requireUser } from "@/src/lib/auth/session";
import { mapOrderRow } from "@/src/lib/actions/order-mapping";
import { getGamesByIds } from "@/src/lib/catalog";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Order } from "@/src/types/database";

export interface CreateOrderItem {
  gameId: string;
  paymentMethodId: string;
}

export type CreateOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      error: "OUT_OF_STOCK" | "GAME_NOT_FOUND" | "EMPTY_CART" | "UNKNOWN";
      gameId?: string;
      gameTitle?: string;
      message: string;
    };

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Creates a multi-item order — one order, one payment_reference, one
 * summed amount_exact, one order_items row per reserved credential. All of
 * it (order row -> reserve_credential per item -> finalize amount/window)
 * happens inside the create_order() Postgres function, in one transaction
 * — see supabase/migrations/20260820000001_multi_item_orders.sql. If any
 * single item is out of stock, raising inside that function rolls back
 * everything, including credentials already reserved earlier in the same
 * call — never a partial order.
 *
 * Every item is expected to carry the same paymentMethodId (checkout only
 * ever offers one payment method for the whole cart) — the order's single
 * payment_method_id column is set from the first item.
 */
export async function createOrder(
  userId: string,
  items: CreateOrderItem[],
  phoneNumber: string,
): Promise<CreateOrderResult> {
  // Re-verifies against the real session — userId is never trusted blindly.
  await requireUser(userId);

  if (items.length === 0) {
    return { ok: false, error: "EMPTY_CART", message: "Your cart is empty." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_user_id: userId,
    p_items: items.map((item) => ({ game_id: item.gameId, payment_method_id: item.paymentMethodId })),
    p_phone_number: phoneNumber,
  });

  if (error) {
    const message = error.message ?? "";

    const outOfStock = message.match(new RegExp(`OUT_OF_STOCK:(${UUID_RE})`, "i"));
    if (outOfStock) {
      const gameId = outOfStock[1];
      const [game] = await getGamesByIds([gameId]);
      return {
        ok: false,
        error: "OUT_OF_STOCK",
        gameId,
        gameTitle: game?.title,
        message: game ? `${game.title} just went out of stock.` : "One of the games in your cart just went out of stock.",
      };
    }

    const notFound = message.match(new RegExp(`GAME_NOT_FOUND:(${UUID_RE})`, "i"));
    if (notFound) {
      return {
        ok: false,
        error: "GAME_NOT_FOUND",
        gameId: notFound[1],
        message: "One of the games in your cart is no longer available.",
      };
    }

    if (message.includes("EMPTY_CART")) {
      return { ok: false, error: "EMPTY_CART", message: "Your cart is empty." };
    }

    console.error("[createOrder]", error);
    return { ok: false, error: "UNKNOWN", message: "Something went wrong creating your order." };
  }

  return { ok: true, order: mapOrderRow(data) };
}

export type ClaimPaymentResult =
  | { ok: true; order: Order }
  | { ok: false; error: "INVALID_STATE"; message: string };

/**
 * "I have made the payment." Only succeeds if the order is still
 * awaiting_payment, hasn't expired, and actually belongs to the caller's
 * real session — all enforced in the single UPDATE's WHERE clause, so
 * there's no separate read-then-write race window. Unchanged from the
 * single-item version — nothing about multi-item orders affects this.
 */
export async function claimPayment(orderId: string): Promise<ClaimPaymentResult> {
  const caller = await requireAuthenticated();

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "payment_claimed", claimed_at: nowIso, refund_policy_consented_at: nowIso })
    .eq("id", orderId)
    .eq("user_id", caller.id)
    .eq("status", "awaiting_payment")
    .gt("reserved_until", nowIso)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[claimPayment]", error);
    return { ok: false, error: "INVALID_STATE", message: "Could not confirm payment for this order." };
  }
  if (!data) {
    return {
      ok: false,
      error: "INVALID_STATE",
      message: "This order can no longer be marked as paid (it may have expired or already been actioned).",
    };
  }

  return { ok: true, order: mapOrderRow(data) };
}
