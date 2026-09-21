import "server-only";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { PaymentMethodRevenue } from "@/src/types/database";

/**
 * Revenue split by the account the money actually arrived in.
 *
 * Same arrangement as src/lib/cost-price.ts: the RPC is `security
 * definer` — it reads every order row regardless of RLS — and is revoked
 * from anon and authenticated at the database level
 * (supabase/migrations/20260921000001_payment_method_revenue.sql), so the
 * service client is the only way to reach it and requireAdmin() is the
 * authorization boundary.
 *
 * The approved-only gate lives in SQL, not here. Re-filtering or
 * re-dating the rows in this module would create a second definition of
 * "confirmed revenue" that could drift from the one approve_order
 * enforces — the whole point of keeping it in the query.
 */

export interface PaymentRevenueRange {
  from: Date;
  to: Date;
}

/** Confirmed revenue per payment method, largest first. */
export async function getRevenueByPaymentMethod(
  range: PaymentRevenueRange,
): Promise<PaymentMethodRevenue[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_revenue_by_payment_method", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    paymentMethodId: row.payment_method_id,
    label: row.label,
    ordersCount: Number(row.orders_count),
    revenue: Number(row.revenue),
    pendingOrders: Number(row.pending_orders),
    pendingAmount: Number(row.pending_amount),
  }));
}
