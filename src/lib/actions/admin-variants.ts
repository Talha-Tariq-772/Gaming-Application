"use server";

import { isLastActiveVariantDeactivation, isValidPriceSource } from "@/src/lib/admin-guardrails";
import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { PriceSource, VariantMode } from "@/src/types/database";

/**
 * SQLSTATE raised by trg_prevent_last_active_variant_update/delete
 * (20260831000003_prevent_last_active_variant_removal.sql) — the real
 * boundary. See isLastActiveVariantDeactivation's comment for how this
 * mirrors changeUserRole/LAST_ADMIN_TRIGGER_ERRCODE.
 */
const LAST_VARIANT_TRIGGER_ERRCODE = "LV001";
const LAST_VARIANT_MESSAGE = "This game must keep at least one active variant.";

export interface AdminGameVariant {
  id: string;
  gameId: string;
  label: string;
  pricePkr: number;
  wasPricePkr: number | null;
  priceSource: PriceSource;
  sortOrder: number;
  /** Unlike the storefront-facing GameVariant (database.ts), this includes
   * inactive rows and the flag itself — the admin panel needs to see and
   * reactivate deactivated variants, not just the active subset. */
  isActive: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVariantRow(row: any): AdminGameVariant {
  return {
    id: row.id,
    gameId: row.game_id,
    label: row.label,
    pricePkr: Number(row.price_pkr),
    wasPricePkr: row.was_price_pkr === null ? null : Number(row.was_price_pkr),
    priceSource: row.price_source,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function fetchVariants(gameId: string): Promise<AdminGameVariant[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("game_variants")
    .select("*")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapVariantRow);
}

export type VariantActionResult =
  | { ok: true; variants: AdminGameVariant[] }
  | { ok: false; message: string };

export interface VariantInput {
  label: string;
  pricePkr: number;
  wasPricePkr: number | null;
  priceSource: PriceSource;
}

function validateVariantInput(input: VariantInput): string | null {
  if (!isValidPriceSource(input.priceSource)) return "Invalid price source.";
  if (input.wasPricePkr !== null && input.wasPricePkr <= input.pricePkr) {
    return "Was-price must be higher than the current price.";
  }
  return null;
}

export async function getVariantsForGame(gameId: string): Promise<VariantActionResult> {
  await requireAdmin();
  try {
    return { ok: true, variants: await fetchVariants(gameId) };
  } catch (error) {
    console.error("[getVariantsForGame]", error);
    return { ok: false, message: "Something went wrong loading variants." };
  }
}

export async function createVariant(gameId: string, input: VariantInput): Promise<VariantActionResult> {
  await requireAdmin();
  const validationError = validateVariantInput(input);
  if (validationError) return { ok: false, message: validationError };

  const service = createServiceClient();

  const { count, error: countErr } = await service
    .from("game_variants")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (countErr) {
    console.error("[createVariant] count", countErr);
    return { ok: false, message: "Something went wrong adding this variant." };
  }

  const { error } = await service.from("game_variants").insert({
    game_id: gameId,
    label: input.label,
    price_pkr: input.pricePkr,
    was_price_pkr: input.wasPricePkr,
    price_source: input.priceSource,
    // Appends after every existing variant (active or not) — admins can
    // reorder afterward with the up/down buttons if that's wrong.
    sort_order: count ?? 0,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "This game already has a variant with that label." };
    }
    if (error.code === "23514") {
      return { ok: false, message: "Was-price must be higher than the current price." };
    }
    console.error("[createVariant]", error);
    return { ok: false, message: "Something went wrong adding this variant." };
  }

  try {
    return { ok: true, variants: await fetchVariants(gameId) };
  } catch (error) {
    console.error("[createVariant] refetch", error);
    return { ok: false, message: "Variant added, but the list failed to refresh." };
  }
}

export async function updateVariant(
  gameId: string,
  variantId: string,
  input: VariantInput,
): Promise<VariantActionResult> {
  await requireAdmin();
  const validationError = validateVariantInput(input);
  if (validationError) return { ok: false, message: validationError };

  const service = createServiceClient();
  const { error } = await service
    .from("game_variants")
    .update({
      label: input.label,
      price_pkr: input.pricePkr,
      was_price_pkr: input.wasPricePkr,
      price_source: input.priceSource,
    })
    .eq("id", variantId)
    .eq("game_id", gameId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "This game already has a variant with that label." };
    }
    if (error.code === "23514") {
      return { ok: false, message: "Was-price must be higher than the current price." };
    }
    console.error("[updateVariant]", error);
    return { ok: false, message: "Something went wrong saving this variant." };
  }

  try {
    return { ok: true, variants: await fetchVariants(gameId) };
  } catch (error) {
    console.error("[updateVariant] refetch", error);
    return { ok: false, message: "Variant saved, but the list failed to refresh." };
  }
}

/**
 * Deactivate/reactivate. Deactivating the last active variant for a game is
 * rejected — see isLastActiveVariantDeactivation's comment for the two-layer
 * (advisory app check + real DB trigger) reasoning.
 */
export async function setVariantActive(
  gameId: string,
  variantId: string,
  isActive: boolean,
): Promise<VariantActionResult> {
  await requireAdmin();
  const service = createServiceClient();

  if (!isActive) {
    const { count, error: countErr } = await service
      .from("game_variants")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("is_active", true);
    if (countErr) {
      console.error("[setVariantActive] count", countErr);
      return { ok: false, message: "Something went wrong updating this variant." };
    }
    if (isLastActiveVariantDeactivation(true, false, count ?? 0)) {
      return { ok: false, message: LAST_VARIANT_MESSAGE };
    }
  }

  const { error } = await service
    .from("game_variants")
    .update({ is_active: isActive })
    .eq("id", variantId)
    .eq("game_id", gameId);
  if (error) {
    if (error.code === LAST_VARIANT_TRIGGER_ERRCODE) {
      return { ok: false, message: LAST_VARIANT_MESSAGE };
    }
    console.error("[setVariantActive]", error);
    return { ok: false, message: "Something went wrong updating this variant." };
  }

  try {
    return { ok: true, variants: await fetchVariants(gameId) };
  } catch (error) {
    console.error("[setVariantActive] refetch", error);
    return { ok: false, message: "Variant updated, but the list failed to refresh." };
  }
}

/**
 * Swaps sort_order with the adjacent variant (by current sort_order, ties
 * broken by created_at — matches fetchVariants' own ordering). A no-op,
 * not an error, when the variant is already at that edge of the list.
 */
export async function reorderVariant(
  gameId: string,
  variantId: string,
  direction: "up" | "down",
): Promise<VariantActionResult> {
  await requireAdmin();
  const service = createServiceClient();

  const { data: rows, error } = await service
    .from("game_variants")
    .select("id, sort_order")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !rows) {
    console.error("[reorderVariant] list", error);
    return { ok: false, message: "Something went wrong reordering variants." };
  }

  const index = rows.findIndex((r) => r.id === variantId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index !== -1 && swapIndex >= 0 && swapIndex < rows.length) {
    const a = rows[index];
    const b = rows[swapIndex];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      service.from("game_variants").update({ sort_order: b.sort_order }).eq("id", a.id),
      service.from("game_variants").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) {
      console.error("[reorderVariant] swap", err1, err2);
      return { ok: false, message: "Something went wrong reordering variants." };
    }
  }

  try {
    return { ok: true, variants: await fetchVariants(gameId) };
  } catch (error) {
    console.error("[reorderVariant] refetch", error);
    return { ok: false, message: "Something went wrong reordering variants." };
  }
}

export type VariantModeResult = { ok: true; variantMode: VariantMode } | { ok: false; message: string };

export async function setVariantMode(gameId: string, variantMode: VariantMode): Promise<VariantModeResult> {
  await requireAdmin();
  if (variantMode !== "single" && variantMode !== "multi") {
    return { ok: false, message: "Invalid variant mode." };
  }

  const service = createServiceClient();
  const { error } = await service.from("games").update({ variant_mode: variantMode }).eq("id", gameId);
  if (error) {
    console.error("[setVariantMode]", error);
    return { ok: false, message: "Something went wrong updating variant mode." };
  }
  return { ok: true, variantMode };
}
