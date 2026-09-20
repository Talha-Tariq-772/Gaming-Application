"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

export type CostPriceActionResult = { ok: true; costPrice: number | null } | { ok: false; message: string };

/** Shared validation. Null is legal — it means "no cost recorded". */
function validateCost(costPrice: number | null): string | null {
  if (costPrice === null) return null;
  if (!Number.isFinite(costPrice)) return "Cost price must be a number.";
  if (costPrice < 0) return "Cost price can't be negative.";
  // numeric(10,2) — two decimal places, max 99,999,999.99.
  if (costPrice > 99_999_999.99) return "Cost price is too large.";
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sets a game's current cost AND records the change in
 * cost_price_history, in that order.
 *
 * Both writes matter and they are not interchangeable: the column is what
 * a *new* approval locks in, while the history row is what lets
 * cost_price_at() answer "what did this cost back then". Writing only the
 * column would silently make every past date report today's cost.
 *
 * `effectiveFrom` defaults to today but is settable, because cost changes
 * are often entered after the fact ("the supplier raised it on the 3rd").
 */
export async function setGameCostPrice(
  gameId: string,
  costPrice: number | null,
  options?: { effectiveFrom?: string; note?: string },
): Promise<CostPriceActionResult> {
  const admin = await requireAdmin();

  const invalid = validateCost(costPrice);
  if (invalid) return { ok: false, message: invalid };

  const value = costPrice === null ? null : round2(costPrice);
  const supabase = createServiceClient();

  const { error: updateErr } = await supabase
    .from("games")
    .update({ cost_price: value })
    .eq("id", gameId);
  if (updateErr) {
    console.error("[setGameCostPrice] update", updateErr);
    return { ok: false, message: "Something went wrong saving the cost price." };
  }

  // Clearing the cost isn't a priced event — there's nothing to record as
  // "the cost became null on this date", and a history row with a null
  // cost would break cost_price_at's not-null contract.
  if (value !== null) {
    const { error: historyErr } = await supabase.from("cost_price_history").insert({
      game_id: gameId,
      cost_price: value,
      effective_from: options?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      note: options?.note ?? null,
      created_by: admin.id,
    });
    if (historyErr) {
      // The column write already succeeded. Surface this rather than
      // swallowing it: the current cost is right but history now has a
      // gap, which silently degrades every historical lookup.
      console.error("[setGameCostPrice] history", historyErr);
      return {
        ok: false,
        message: "Cost price saved, but recording the change in history failed — historical reports may be inaccurate.",
      };
    }
  }

  return { ok: true, costPrice: value };
}

/** Same contract as setGameCostPrice, for a single variant. */
export async function setVariantCostPrice(
  variantId: string,
  costPrice: number | null,
  options?: { effectiveFrom?: string; note?: string },
): Promise<CostPriceActionResult> {
  const admin = await requireAdmin();

  const invalid = validateCost(costPrice);
  if (invalid) return { ok: false, message: invalid };

  const value = costPrice === null ? null : round2(costPrice);
  const supabase = createServiceClient();

  const { error: updateErr } = await supabase
    .from("game_variants")
    .update({ cost_price: value })
    .eq("id", variantId);
  if (updateErr) {
    console.error("[setVariantCostPrice] update", updateErr);
    return { ok: false, message: "Something went wrong saving the cost price." };
  }

  if (value !== null) {
    const { error: historyErr } = await supabase.from("cost_price_history").insert({
      variant_id: variantId,
      cost_price: value,
      effective_from: options?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      note: options?.note ?? null,
      created_by: admin.id,
    });
    if (historyErr) {
      console.error("[setVariantCostPrice] history", historyErr);
      return {
        ok: false,
        message: "Cost price saved, but recording the change in history failed — historical reports may be inaccurate.",
      };
    }
  }

  return { ok: true, costPrice: value };
}

