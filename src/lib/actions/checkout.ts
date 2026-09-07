"use server";

import { requireAuthenticated, requireUser } from "@/src/lib/auth/session";
import { mapOrderRow } from "@/src/lib/actions/order-mapping";
import { getGamesByIds } from "@/src/lib/catalog";
import { normalisePhone } from "@/src/lib/phone";
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
      error: "OUT_OF_STOCK" | "GAME_NOT_FOUND" | "EMPTY_CART" | "INVALID_PHONE" | "UNKNOWN";
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
 *
 * userId is optional: omit it for a guest checkout (no session required).
 * When it IS passed, the caller's real session is still re-verified
 * against it via requireUser — that protection is unchanged for anyone
 * who is signed in. A guest order stores its contact number as
 * orders.guest_phone (normalised E.164 via src/lib/phone.ts) instead of
 * writing to a profile, since there is no profile to write to.
 */
export async function createOrder(
  userId: string | undefined,
  items: CreateOrderItem[],
  phoneNumber: string,
): Promise<CreateOrderResult> {
  let guestPhone: string | null = null;
  if (userId) {
    // Re-verifies against the real session — userId is never trusted blindly.
    await requireUser(userId);
  } else {
    guestPhone = normalisePhone(phoneNumber);
    if (!guestPhone) {
      return { ok: false, error: "INVALID_PHONE", message: "Enter a valid phone number." };
    }
  }

  if (items.length === 0) {
    return { ok: false, error: "EMPTY_CART", message: "Your cart is empty." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_user_id: userId ?? null,
    p_items: items.map((item) => ({ game_id: item.gameId, payment_method_id: item.paymentMethodId })),
    p_phone_number: userId ? phoneNumber : null,
    p_guest_phone: guestPhone,
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
 * awaiting_payment and hasn't expired — enforced in the single UPDATE's
 * WHERE clause, so there's no separate read-then-write race window.
 *
 * Ownership check depends on whether the order has a user_id: a
 * signed-in order still requires the caller's real session to match it
 * (unchanged from before). A guest order has no session to check against
 * — the order id itself (a UUID, held locally by the browser that just
 * created it, never exposed to any other order) is what authorizes this
 * call, the same way a guest tracks an order on any e-commerce site.
 */
export async function claimPayment(orderId: string): Promise<ClaimPaymentResult> {
  const supabase = createServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchError || !existing) {
    return { ok: false, error: "INVALID_STATE", message: "This order could not be found." };
  }

  if (existing.user_id) {
    const caller = await requireAuthenticated();
    if (caller.id !== existing.user_id) {
      return { ok: false, error: "INVALID_STATE", message: "This order does not belong to you." };
    }
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "payment_claimed", claimed_at: nowIso, refund_policy_consented_at: nowIso })
    .eq("id", orderId)
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
