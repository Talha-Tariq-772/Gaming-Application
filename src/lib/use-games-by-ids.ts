"use client";

import { useEffect, useState } from "react";
import { GAME_COVER_PLACEHOLDER } from "@/src/lib/game-placeholder";
import { createClient } from "@/src/lib/supabase/client";
import type { Game, GameVariant } from "@/src/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVariantRow(row: any): GameVariant {
  return {
    id: row.id,
    gameId: row.game_id,
    label: row.label,
    pricePkr: Number(row.price_pkr),
    wasPricePkr: row.was_price_pkr === null ? null : Number(row.was_price_pkr),
    priceSource: row.price_source,
    sortOrder: row.sort_order,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGameRow(row: any): Game {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants = ((row.game_variants ?? []) as any[])
    .filter((v) => v.is_active)
    .map(mapVariantRow)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    price: Number(row.price),
    // `||`, not `??` — see catalog.ts's mapGameRow for why.
    coverImageUrl: row.cover_image_url || GAME_COVER_PLACEHOLDER,
    trailerUrl: row.trailer_url ?? "",
    genre: row.genre,
    platform: row.platform,
    setupGuide: row.setup_guide ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    productType: row.product_type,
    releaseDate: row.release_date,
    isNewArrival: row.is_new_arrival,
    isBestSeller: row.is_best_seller,
    variantMode: row.variant_mode,
    coverPath: row.cover_path,
    wallpaperPath: row.wallpaper_path,
    sliderPosition: row.slider_position,
    variants,
  };
}

export interface GamesByIdsResult {
  /** Currently-active real games among the requested ids — a requested id
   * missing from this list has since been deactivated or deleted. */
  games: Game[];
  /** False until the fetch for the current id set has resolved. Stays
   * false forever on a fetch error — callers should fail open (trust
   * their own cached data) rather than treat "couldn't check" as
   * "invalid", since a network hiccup shouldn't nuke someone's cart. */
  loaded: boolean;
}

const EMPTY_LOADED: GamesByIdsResult = { games: [], loaded: true };

/**
 * Client-side lookup of real, currently-active games by id — the source
 * of truth for cart validation (CartIntegrityGuard, useCartSummary).
 * Uses the browser Supabase client (catalog.ts's helpers are server-only
 * and can't run in "use client" code) and explicitly filters is_active
 * itself rather than relying on RLS alone, so a signed-in admin browsing
 * their own cart doesn't see inactive games as "still valid" here just
 * because their session can see them elsewhere.
 */
export function useGamesByIds(ids: string[]): GamesByIdsResult {
  const key = [...new Set(ids)].sort().join(",");
  // Tracks which key `games` actually answers — cart-store's persisted
  // items start out empty for one render before zustand rehydrates (see
  // useHydrated), so `key` can jump from "" to a real id set after this
  // hook has already mounted. Deriving `loaded` from a key match (rather
  // than a plain boolean set once per fetch) means that jump is never
  // mistaken for "confirmed empty" during the render before the new
  // fetch resolves — it only means "not this key's answer yet".
  const [state, setState] = useState<{ key: string; games: Game[] }>({ key: "", games: [] });

  useEffect(() => {
    if (!key) {
      setState({ key: "", games: [] });
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("games")
      // Plain "*", not the game_variants embed catalog.ts's store-facing
      // queries use — cart validation only reads id/isActive/price, and
      // keeping this independent of Session 1's schema matches
      // getGamesByIds's identical reasoning (see catalog.ts). mapGameRow
      // below defaults variants to [] when the embed is absent.
      .select("*")
      .eq("is_active", true)
      .in("id", key.split(","))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useGamesByIds]", error);
          return;
        }
        setState({ key, games: (data ?? []).map(mapGameRow) });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return EMPTY_LOADED;
  return { games: state.key === key ? state.games : [], loaded: state.key === key };
}
