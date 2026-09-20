import "server-only";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type {
  CostPriceHistoryEntry,
  ProfitByProduct,
  ProfitGranularity,
  ProfitPoint,
} from "@/src/types/database";

/**
 * Every read here goes through the SERVICE client, never the session
 * client, because the cost columns and cost_price_history are revoked
 * from anon and authenticated at the database level
 * (supabase/migrations/20260920000002_cost_price.sql). requireAdmin() is
 * the authorization boundary — the same arrangement getCredentialStock()
 * uses for game_credentials, and for the same reason: there is no client
 * role that should ever be able to read this.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistoryRow(row: any): CostPriceHistoryEntry {
  return {
    id: row.id,
    gameId: row.game_id,
    variantId: row.variant_id,
    giftCardProductId: row.gift_card_product_id,
    costPrice: Number(row.cost_price),
    effectiveFrom: row.effective_from,
    note: row.note,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Cost-change history for one game, newest effective date first. */
export async function getCostHistoryForGame(gameId: string): Promise<CostPriceHistoryEntry[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cost_price_history")
    .select("*")
    .eq("game_id", gameId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapHistoryRow);
}

/**
 * What a game (or one of its variants) cost on a given date, resolved by
 * the same `cost_price_at` function approve_order uses to lock costs in —
 * so an admin checking "what would this have cost in March?" sees exactly
 * what the lock would have written.
 */
export async function getCostPriceAt(
  gameId: string | null,
  variantId: string | null,
  giftCardProductId: string | null,
  at: Date,
): Promise<number | null> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("cost_price_at", {
    p_game_id: gameId,
    p_variant_id: variantId,
    p_gift_card_product_id: giftCardProductId,
    p_at: at.toISOString(),
  });
  if (error) throw error;
  return data === null || data === undefined ? null : Number(data);
}

export interface ProfitRange {
  from: Date;
  to: Date;
}

/** Bucketed revenue/cost/profit over time. */
export async function getProfitSeries(
  granularity: ProfitGranularity,
  range: ProfitRange,
): Promise<ProfitPoint[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_profit_series", {
    p_granularity: granularity,
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    bucket: row.bucket,
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    itemsSold: Number(row.items_sold),
    itemsMissingCost: Number(row.items_missing_cost),
  }));
}

/** Net profit per product, most profitable first. */
export async function getProfitByProduct(range: ProfitRange): Promise<ProfitByProduct[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_profit_by_product", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    gameId: row.game_id,
    title: row.title,
    slug: row.slug,
    productType: row.product_type === "gift_card" ? "gift_card" : "game",
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    itemsSold: Number(row.items_sold),
    itemsMissingCost: Number(row.items_missing_cost),
  }));
}

export interface ProfitTotals {
  revenue: number;
  cost: number;
  profit: number;
  itemsSold: number;
  itemsMissingCost: number;
  /** Profit as a share of revenue, 0-1. Zero when there's no revenue —
   * never NaN, which would render as "NaN%" in the UI. */
  margin: number;
}

/** Aggregate of a series. Pure — exported for direct unit testing. */
export function sumProfit(points: Pick<ProfitPoint, "revenue" | "cost" | "profit" | "itemsSold" | "itemsMissingCost">[]): ProfitTotals {
  const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const cost = points.reduce((sum, p) => sum + p.cost, 0);
  const itemsSold = points.reduce((sum, p) => sum + p.itemsSold, 0);
  const itemsMissingCost = points.reduce((sum, p) => sum + p.itemsMissingCost, 0);
  const profit = revenue - cost;
  return {
    revenue,
    cost,
    profit,
    itemsSold,
    itemsMissingCost,
    margin: revenue === 0 ? 0 : profit / revenue,
  };
}

/** Cost-change history for one gift-card product, newest first. */
export async function getCostHistoryForGiftCard(
  giftCardProductId: string,
): Promise<CostPriceHistoryEntry[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cost_price_history")
    .select("*")
    .eq("gift_card_product_id", giftCardProductId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapHistoryRow);
}
