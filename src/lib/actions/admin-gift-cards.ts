"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { GiftCardProduct } from "@/src/types/database";

/**
 * Admin reads for the gift-card catalog.
 *
 * Scoped to what the image-management screen needs: the full list
 * including inactive rows, which the public getGiftCardProducts() can
 * never return (it goes through the anon client, where RLS hides them).
 *
 * The SERVICE client, not the admin's own session, for the same reason
 * getGamesForAdmin() uses it: gift_card_products.cost_price is revoked
 * from `authenticated` at the column level
 * (20260920000004_gift_card_cost_price.sql), so a `select *` as an admin
 * session would error. requireAdmin() is the authorization boundary.
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

/** Every gift-card product, active or not, in catalog order. */
export async function getGiftCardProductsForAdmin(): Promise<GiftCardProduct[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("gift_card_products")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapGiftCardProductRow);
}
