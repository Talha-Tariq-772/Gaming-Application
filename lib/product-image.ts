import { PRODUCT_IMAGES, PRODUCT_IMAGE_DIMENSIONS } from "@/lib/generated/product-images";
import {
  GAME_COVER_PLACEHOLDER,
  GAME_COVER_PLACEHOLDER_WIDTH,
  GAME_COVER_PLACEHOLDER_HEIGHT,
  GAME_HEADER_PLACEHOLDER,
} from "@/src/lib/game-placeholder";
import { gameCoverImage, gameWallpaperImage } from "@/src/lib/storage-image";
import type { Game, GiftCardProduct } from "@/src/types/database";

/**
 * Card/header art resolution, in priority order:
 *
 *  1. lib/generated/product-images.ts (build-time manifest of
 *     public/products/card|header, keyed by slug) — the curated art for
 *     the current catalog lives here, so it wins by default.
 *  2. The game's own Supabase-managed image (coverPath/wallpaperPath,
 *     resolved to Storage derivative URLs via storage-image.ts) — this is
 *     the admin override path: a game added (or re-imaged) through the
 *     admin panel after this manifest was generated has no manifest entry
 *     yet, so its Storage upload is what renders.
 *  3. A static placeholder at the correct aspect ratio. Never throws.
 *
 * Card additionally falls back to game.coverImageUrl before the
 * placeholder — that field already resolves to GAME_COVER_PLACEHOLDER
 * itself when unset (see catalog.ts's mapGameRow), so it's a safe last
 * step rather than a real third tier.
 */

type ImageDims = { width: number; height: number };

function warnMiss(kind: "card" | "header", slug: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[product-image] no ${kind} art found for "${slug}" — using placeholder`);
  }
}

export function getCardImage(game: Pick<Game, "slug" | "coverPath" | "coverImageUrl">): string {
  const manifest = PRODUCT_IMAGES[game.slug]?.card;
  if (manifest) return manifest;

  if (game.coverPath) return gameCoverImage(game.coverPath).src;

  if (game.coverImageUrl && game.coverImageUrl !== GAME_COVER_PLACEHOLDER) return game.coverImageUrl;

  warnMiss("card", game.slug);
  return GAME_COVER_PLACEHOLDER;
}

/**
 * A HeaderImage caller not backed by a Game row (e.g. a gift-card product)
 * has a plain absolute header_image_url instead of a Storage wallpaperPath
 * — this branch is additive, mirroring the coverImageUrl fallback getCardImage
 * already has above; it never changes behavior for a real Game.
 */
type HeaderImageSource =
  | Pick<Game, "slug" | "wallpaperPath" | "productType">
  | { slug: string; wallpaperPath: null; headerImageUrl: string }
  // No header art and not a Game — falls straight through to the
  // placeholder below, same as a Game with a null wallpaperPath would,
  // without needing a fake productType value.
  | { slug: string; wallpaperPath: null };

export function getHeaderImage(game: HeaderImageSource): string {
  return getHeaderImageResponsive(game).src;
}

/**
 * Same priority chain as getHeaderImage, but also carries a `srcSet` when
 * one is meaningful — for callers (StoreSlider) that render responsively
 * across viewport widths. The local manifest ships exactly one derivative
 * per image (no srcSet: nothing to choose between), so `srcSet` is only
 * ever present on the Supabase-managed fallback, which still has its
 * original 640/1280/1920w derivatives.
 */
export function getHeaderImageResponsive(game: HeaderImageSource): { src: string; srcSet?: string } {
  const manifest = PRODUCT_IMAGES[game.slug]?.header;
  if (manifest) return { src: manifest };

  if ("headerImageUrl" in game) return { src: game.headerImageUrl };

  if (game.wallpaperPath) {
    const wallpaper = gameWallpaperImage(game.wallpaperPath, game.productType);
    return { src: wallpaper.src, srcSet: wallpaper.srcSet };
  }

  warnMiss("header", game.slug);
  return { src: GAME_HEADER_PLACEHOLDER };
}

/**
 * Gift-card art resolution, in priority order:
 *
 *  1. product.cardImageUrl from Supabase — the admin override, wins outright
 *     when set.
 *  2. The optimised per-platform art produced by
 *     scripts/optimise-gift-card-art.mjs, keyed off product.platform
 *     (lowercased, underscores to hyphens: "google_play" -> "google-play").
 *     Art is per-PLATFORM, not per-denomination — psn-10-us and psn-25-us
 *     intentionally resolve to the same file.
 *  3. The existing card placeholder — never throws.
 *
 * Returns a plain URL string, not a Game-shaped object: callers adapt a
 * GiftCardProduct to CardImage's existing { slug, title, coverPath: null,
 * coverImageUrl } shape using this as coverImageUrl, so it flows through
 * getCardImage's own unmodified coverImageUrl branch above — CardImage
 * itself needs no gift-card-specific code at all.
 */
export function getGiftCardImage(product: Pick<GiftCardProduct, "cardImageUrl" | "platform">): string {
  if (product.cardImageUrl) return product.cardImageUrl;

  const platformFile = product.platform.toLowerCase().replace(/_/g, "-");
  return `/products/gift-cards/optimised/${platformFile}.webp`;
}

/** Intrinsic pixel dimensions for whatever getCardImage would resolve to —
 * source art isn't uniformly sized (see PRODUCT_IMAGE_DIMENSIONS' own
 * comment), so components need the real numbers per image rather than one
 * assumed canonical size. Supabase-hosted and placeholder fallbacks don't
 * carry per-file dimensions, so those two steps use fixed known sizes. */
export function getCardImageDimensions(game: Pick<Game, "slug" | "coverPath">): ImageDims {
  const dims = PRODUCT_IMAGE_DIMENSIONS[game.slug];
  if (dims?.cardWidth && dims.cardHeight) {
    return { width: dims.cardWidth, height: dims.cardHeight };
  }
  // Storage-only games (no local manifest entry) don't have their true
  // dimensions available at build time — fall back to the catalog's
  // documented canonical card ratio (3:4) rather than guessing wrong.
  if (game.coverPath) return { width: 900, height: 1200 };
  return { width: GAME_COVER_PLACEHOLDER_WIDTH, height: GAME_COVER_PLACEHOLDER_HEIGHT };
}

/**
 * Hardware art resolution, in priority order:
 *
 *  1. The product's own first image_urls entry — hardware has no
 *     build-time art manifest and no Supabase Storage pipeline, just the
 *     paths an admin types into the form, so this is the only real
 *     source.
 *  2. The shared card placeholder — never throws.
 *
 * imageUrls is ordered and the first entry is the card image by
 * convention (see HardwareProduct.imageUrls). Entries are validated on
 * the way in (isUsableImageRef in src/lib/hardware-validation.ts), so
 * anything stored here is already a root-relative path or an http(s) URL
 * — this does not re-validate, it only handles absence.
 *
 * Returns a plain URL string, not a Game-shaped object, exactly like
 * getGiftCardImage: callers adapt a HardwareProduct to CardImage's
 * existing { slug, title, coverPath: null, coverImageUrl } shape using
 * this as coverImageUrl, so CardImage needs no hardware-specific code.
 */
export function getHardwareImage(product: { imageUrls: string[] }): string {
  const first = product.imageUrls.find((url) => url.trim().length > 0);
  return first ?? GAME_COVER_PLACEHOLDER;
}
