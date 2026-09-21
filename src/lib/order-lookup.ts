import "server-only";

import { mapOrderRow } from "@/src/lib/actions/order-mapping";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Order } from "@/src/types/database";

/**
 * Order lookup by bearer token, for the no-login /order-status/<token>
 * page.
 *
 * The SERVICE client, because orders' RLS policy keys off auth.uid() and
 * a guest has no session at all — there is no client role that could read
 * this row. The token IS the authorization: 32 random bytes, matched
 * exactly, and the only way to obtain one is to have created the order.
 *
 * Returns the order plus its line items and payment method, i.e. exactly
 * what the status page renders and nothing more. Notably it does NOT
 * return lookup_token back out: the caller already has it, and echoing a
 * bearer token into a page's props is how it ends up somewhere it
 * shouldn't be.
 */
export interface OrderLookupResult {
  order: Order;
  items: { id: string; title: string; price: number }[];
  paymentMethodLabel: string | null;
  hasScreenshot: boolean;
  screenshotUploadedAt: string | null;
}

export async function findOrderByLookupToken(
  token: string,
): Promise<OrderLookupResult | null> {
  // Cheap shape check before a database round trip. The column holds
  // 64 hex chars (encode(gen_random_bytes(32), 'hex')), so anything else
  // cannot match and is almost certainly someone poking at the route.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from("orders")
    .select("*")
    .eq("lookup_token", token)
    .maybeSingle();
  if (error || !row) return null;

  const order = mapOrderRow(row);

  const [{ data: itemRows }, { data: method }, { data: shot }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, price, product_type, game_id, hardware_product_id, gift_card_code_id")
      .eq("order_id", order.id),
    row.payment_method_id
      ? supabase.from("payment_methods").select("label").eq("id", row.payment_method_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("payment_screenshots")
      .select("uploaded_at")
      .eq("order_id", order.id)
      .maybeSingle(),
  ]);

  // Titles are resolved per product family. A line whose product was
  // deleted falls back to a neutral label rather than disappearing —
  // a buyer seeing fewer items than they paid for is worse than a
  // generic name.
  const items = await Promise.all(
    (itemRows ?? []).map(async (item) => {
      let title = "Item";
      if (item.game_id) {
        const { data } = await supabase.from("games").select("title").eq("id", item.game_id).maybeSingle();
        title = data?.title ?? title;
      } else if (item.hardware_product_id) {
        const { data } = await supabase
          .from("hardware_products")
          .select("name")
          .eq("id", item.hardware_product_id)
          .maybeSingle();
        title = data?.name ?? title;
      } else if (item.gift_card_code_id) {
        const { data: code } = await supabase
          .from("gift_card_codes")
          .select("product_id")
          .eq("id", item.gift_card_code_id)
          .maybeSingle();
        if (code?.product_id) {
          const { data } = await supabase
            .from("gift_card_products")
            .select("title")
            .eq("id", code.product_id)
            .maybeSingle();
          title = data?.title ?? title;
        }
      }
      return { id: item.id, title, price: Number(item.price) };
    }),
  );

  return {
    order,
    items,
    paymentMethodLabel: method?.label ?? null,
    hasScreenshot: Boolean(shot),
    screenshotUploadedAt: shot ? new Date(shot.uploaded_at).toISOString() : null,
  };
}
