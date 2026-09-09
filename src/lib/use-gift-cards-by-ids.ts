"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import type { GiftCardProduct } from "@/src/types/database";

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

export interface GiftCardsByIdsResult {
  /** Currently-active real gift-card products among the requested ids — a
   * requested id missing from this list has since been deactivated or
   * deleted. */
  products: GiftCardProduct[];
  /** False until the fetch for the current id set has resolved. Stays
   * false forever on a fetch error — callers should fail open (trust
   * their own cached data) rather than treat "couldn't check" as
   * "invalid". */
  loaded: boolean;
}

const EMPTY_LOADED: GiftCardsByIdsResult = { products: [], loaded: true };

/**
 * Client-side lookup of real, currently-active gift-card products by id —
 * the gift-card half of cart validation (CartIntegrityGuard,
 * useCartSummary). Mirrors use-games-by-ids.ts's useGamesByIds exactly,
 * same reasoning throughout (browser client, explicit is_active filter
 * rather than relying on RLS alone, key-based `loaded` tracking).
 */
export function useGiftCardsByIds(ids: string[]): GiftCardsByIdsResult {
  const key = [...new Set(ids)].sort().join(",");
  const [state, setState] = useState<{ key: string; products: GiftCardProduct[] }>({
    key: "",
    products: [],
  });

  useEffect(() => {
    if (!key) {
      setState({ key: "", products: [] });
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("gift_card_products")
      .select("*")
      .eq("is_active", true)
      .in("id", key.split(","))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useGiftCardsByIds]", error);
          return;
        }
        setState({ key, products: (data ?? []).map(mapGiftCardProductRow) });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return EMPTY_LOADED;
  return { products: state.key === key ? state.products : [], loaded: state.key === key };
}
