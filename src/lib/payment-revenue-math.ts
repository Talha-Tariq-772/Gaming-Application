import type { PaymentMethodRevenue } from "@/src/types/database";

/**
 * Pure aggregation over the rows `getRevenueByPaymentMethod` returns.
 *
 * Deliberately a separate module from payment-revenue.ts, which is
 * `server-only`: AdminPaymentsClient is a client component and needs these
 * for its stat tiles and share column. AdminProfitClient hit the same wall
 * and solved it by re-implementing sumProfit()'s body inline, leaving two
 * copies of the same arithmetic to drift apart — this split keeps one.
 *
 * Nothing here filters or re-dates anything. Which orders count as revenue
 * is decided once, in SQL (see
 * supabase/migrations/20260921000001_payment_method_revenue.sql); these
 * functions only add up what that query already gated.
 */

export interface PaymentRevenueTotals {
  revenue: number;
  ordersCount: number;
  pendingOrders: number;
  pendingAmount: number;
  /** Mean confirmed order value. Zero rather than NaN when nothing has
   * been approved — the same guard sumProfit() puts on margin, and for the
   * same reason: NaN renders as "Rs NaN" in a StatCard. */
  averageOrderValue: number;
}

/** Grand total across every payment method. */
export function sumPaymentRevenue(rows: PaymentMethodRevenue[]): PaymentRevenueTotals {
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const ordersCount = rows.reduce((sum, r) => sum + r.ordersCount, 0);
  const pendingOrders = rows.reduce((sum, r) => sum + r.pendingOrders, 0);
  const pendingAmount = rows.reduce((sum, r) => sum + r.pendingAmount, 0);
  return {
    revenue,
    ordersCount,
    pendingOrders,
    pendingAmount,
    averageOrderValue: ordersCount === 0 ? 0 : revenue / ordersCount,
  };
}

/**
 * One method's share of total revenue, as a 0-1 fraction. Guards on the
 * denominator, so an empty reporting period renders "0%" rather than
 * "NaN%" — the divide-by-zero case is a real one here, since a period with
 * no approved orders still returns rows for methods that have pending
 * volume.
 */
export function revenueShare(revenue: number, totalRevenue: number): number {
  return totalRevenue === 0 ? 0 : revenue / totalRevenue;
}
