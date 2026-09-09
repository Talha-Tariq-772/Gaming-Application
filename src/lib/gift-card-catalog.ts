import "server-only";

import { cache } from "react";
import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { GiftCardFilters, GiftCardProduct } from "@/src/types/database";

/**
 * Real Supabase-backed gift-card catalog reads (anon key, always
 * is_active only — matches gift_card_products' RLS policy for
 * anon/customer, see supabase/migrations/20260901000002_gift_cards.sql).
 * Mirrors src/lib/catalog.ts's getGames/getGameBySlug shape exactly —
 * gift cards are a separate table, not a third games.product_type value,
 * but the query/mapping conventions are the same.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGiftCardProductRow(row: any): GiftCardProduct {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    platform: row.platform,
    region: row.region,
    denominationValue: row.denomination_value === null ? null : Number(row.denomination_value),
    denominationCurrency: row.denomination_currency,
    pricePkr: Number(row.price_pkr),
    cardImageUrl: row.card_image_url,
    headerImageUrl: row.header_image_url,
    description: row.description ?? "",
    redemptionInstructions: row.redemption_instructions ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Strips characters that would break PostgREST's `.or()` filter-string syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export async function getGiftCardProducts(filters: GiftCardFilters = {}): Promise<GiftCardProduct[]> {
  return safeAsync("gift card products", async () => {
    const { platform, region, search, sort = "newest", isActive = true } = filters;

    const supabase = createClient();
    let query = supabase.from("gift_card_products").select("*").eq("is_active", isActive);

    if (platform && platform.length > 0) query = query.in("platform", platform);
    if (region && region.length > 0) query = query.in("region", region);

    const term = search ? sanitizeSearchTerm(search) : "";
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    switch (sort) {
      case "price_asc":
        query = query.order("price_pkr", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price_pkr", { ascending: false });
        break;
      case "name":
        query = query.order("title", { ascending: true });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapGiftCardProductRow);
  });
}

/**
 * Service-role, by-id, regardless of is_active — mirrors catalog.ts's
 * getGamesByIds exactly (same reasoning: order/cart validation and
 * checkout error messages need a product's own title/data even after it's
 * been deactivated, and the anon-key gift_card_products_select policy
 * would otherwise hide it).
 */
export async function getGiftCardProductsByIds(ids: string[]): Promise<GiftCardProduct[]> {
  if (ids.length === 0) return [];
  return safeAsync("gift card products by id", async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("gift_card_products").select("*").in("id", ids);
    if (error) throw error;
    return (data ?? []).map(mapGiftCardProductRow);
  });
}

/**
 * Resolves order_items.gift_card_code_id -> its gift-card product, for
 * order-history/admin display. gift_card_codes has zero client-readable
 * RLS policies (service role only, see 20260901000002_gift_cards.sql), so
 * this two-step lookup can only ever run server-side.
 */
export async function getGiftCardProductsForCodeIds(
  codeIds: string[],
): Promise<Map<string, GiftCardProduct>> {
  const result = new Map<string, GiftCardProduct>();
  if (codeIds.length === 0) return result;

  return safeAsync("gift card products for order items", async () => {
    const supabase = createServiceClient();
    const { data: codes, error: codesError } = await supabase
      .from("gift_card_codes")
      .select("id, product_id")
      .in("id", codeIds);
    if (codesError) throw codesError;
    if (!codes || codes.length === 0) return result;

    const productIds = [...new Set(codes.map((c) => c.product_id as string))];
    const products = await getGiftCardProductsByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const code of codes) {
      const product = productById.get(code.product_id as string);
      if (product) result.set(code.id as string, product);
    }
    return result;
  });
}

/**
 * React.cache-wrapped so a request that reads this twice (generateMetadata
 * + the detail body, same as getGameBySlug) shares one round trip.
 */
export const getGiftCardProductBySlug = cache(async (slug: string): Promise<GiftCardProduct | null> => {
  return safeAsync("gift card product", async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gift_card_products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGiftCardProductRow(data) : null;
  });
});
