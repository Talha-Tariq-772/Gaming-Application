import "server-only";

import { requireAdmin, requireUser } from "@/src/lib/auth/session";
import { mapOrderRow } from "@/src/lib/actions/order-mapping";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { Order, OrderItem, OrderStatus, Profile } from "@/src/types/database";

/**
 * Explicit column list, never "*": order_items.cost_price is revoked from
 * anon/authenticated at the column level
 * (20260920000002_cost_price.sql) — a customer reading their own order
 * must not see what it cost us.
 */
const PUBLIC_ORDER_ITEM_COLUMNS =
  "id, order_id, game_id, credential_id, price, product_type, gift_card_code_id, hardware_product_id, variant_id, cost_locked_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderItemRow(row: any): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    gameId: row.game_id,
    giftCardCodeId: row.gift_card_code_id,
    hardwareProductId: row.hardware_product_id ?? null,
    productType: row.product_type,
    price: Number(row.price),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function splitOrdersAndItems(rows: any[]): { orders: Order[]; orderItems: OrderItem[] } {
  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  for (const row of rows) {
    const { order_items, ...orderRow } = row;
    orders.push(mapOrderRow(orderRow));
    for (const item of order_items ?? []) {
      orderItems.push(mapOrderItemRow(item));
    }
  }
  return { orders, orderItems };
}

/**
 * Relies on RLS to scope results, not an extra WHERE clause — the session
 * client here carries the real logged-in user's identity, and the orders
 * SELECT policy already restricts a customer session to their own rows.
 * requireUser still re-verifies the caller's session matches userId first,
 * so a mismatched id fails loudly instead of silently returning "your own
 * orders regardless of what id you passed" and masking a caller bug.
 */
export async function getOrdersForUser(userId: string): Promise<{ orders: Order[]; orderItems: OrderItem[] }> {
  await requireUser(userId);

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_items(${PUBLIC_ORDER_ITEM_COLUMNS})`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return splitOrdersAndItems(data ?? []);
}

/**
 * Same RLS-reliance as getOrdersForUser — the orders SELECT policy already
 * grants agent/admin sessions visibility into every order, so this needs
 * no explicit scoping either. filters.status is a plain narrowing filter,
 * not a security boundary.
 */
export async function getOrdersForAdmin(filters?: {
  status?: OrderStatus;
}): Promise<{ orders: Order[]; orderItems: OrderItem[] }> {
  await requireAdmin({ allowAgent: true });

  const supabase = await createSessionClient();
  let query = supabase.from("orders").select(`*, order_items(${PUBLIC_ORDER_ITEM_COLUMNS})`).order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  return splitOrdersAndItems(data ?? []);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    phoneVerified: row.phone_verified,
    role: row.role,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Admin-only customer lookup for order display (name/phone next to an
 * order). Service role since it needs to see any customer's profile
 * regardless of the caller's own row — requireAdmin is the actual
 * authorization check.
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  await requireAdmin({ allowAgent: true });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []).map(mapProfileRow);
}

/**
 * Full profile list for /admin/users. Session client, relying on the
 * existing profiles_select RLS policy (admin/agent see every row) rather
 * than an extra WHERE clause — same pattern as getOrdersForAdmin. Search
 * stays client-side (matching the page's existing filter UI) since the
 * profile list isn't expected to be large enough to need server-side
 * pagination/search.
 */
export async function getProfilesForAdmin(): Promise<Profile[]> {
  await requireAdmin({ allowAgent: true });

  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProfileRow);
}
