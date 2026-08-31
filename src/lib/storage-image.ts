import type { ProductType } from "@/src/types/database";

/**
 * Pure string builders for public Supabase Storage object URLs — no
 * network call, same as supabase-js's own
 * `storage.from(bucket).getPublicUrl()` does internally. Consumes the
 * object paths Session 1's scripts/upload-catalog-images.mjs wrote and the
 * cover_path/wallpaper_path prefix convention documented on the `games`
 * table (supabase/migrations/20260829000002_games_catalog_columns.sql).
 *
 * Deliberately NOT run through next/image: these are already exact,
 * pre-sized .webp derivatives (400/800 for covers, 640/1280/1920 for
 * wallpapers) — next/image's optimizer would just re-fetch and re-encode
 * files that don't need it, and its built-in loader can't be pointed at
 * fixed-width derivatives that already exist under exact filenames. Plain
 * <img srcSet> gives exact control over which derivative loads, which
 * StoreSlider (fetchpriority/lazy per slide) and the catalog grid both need.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function publicObjectUrl(bucket: string, objectPath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export interface ResponsiveImage {
  /** Largest derivative — a plain, valid <img src> fallback on its own. */
  src: string;
  /** Ready-to-use <img srcSet> value. */
  srcSet: string;
  /** Ascending by width, for callers that need one specific derivative
   * (StoreSlider preloads/prefetches an exact URL per slide). */
  sizes: { width: number; url: string }[];
}

function buildResponsiveImage(bucket: string, pathPrefix: string, widths: readonly number[]): ResponsiveImage {
  const sizes = widths.map((width) => ({ width, url: publicObjectUrl(bucket, `${pathPrefix}-${width}.webp`) }));
  return {
    src: sizes[sizes.length - 1].url,
    srcSet: sizes.map((s) => `${s.url} ${s.width}w`).join(", "),
    sizes,
  };
}

const COVER_WIDTHS = [400, 800] as const;
const WALLPAPER_WIDTHS = [640, 1280, 1920] as const;

/** covers/{slug} -> covers/{slug}-400.webp, covers/{slug}-800.webp (game-images bucket). */
export function gameCoverImage(coverPath: string): ResponsiveImage {
  return buildResponsiveImage("game-images", coverPath, COVER_WIDTHS);
}

/**
 * wallpapers/{slug} (games) or {slug}/header (memberships), both ->
 * -640/-1280/-1920.webp. Bucket depends on productType, not the path
 * string, since "contains a slash" isn't a reliable enough signal on its
 * own (a game slug could theoretically contain one).
 */
export function gameWallpaperImage(wallpaperPath: string, productType: ProductType): ResponsiveImage {
  const bucket = productType === "membership" ? "membership-images" : "game-images";
  return buildResponsiveImage(bucket, wallpaperPath, WALLPAPER_WIDTHS);
}

/**
 * The one generic, not-tied-to-any-game-row header for the /memberships
 * page itself — uploaded by scripts/upload-catalog-images.mjs to the
 * membership-images bucket ROOT as "header-{640,1280,1920}.webp" (from
 * public/membership/header.jpeg), distinct from each membership product's
 * own "{slug}/header-{width}.webp" (gameWallpaperImage above).
 */
export function membershipSectionHeaderImage(): ResponsiveImage {
  return buildResponsiveImage("membership-images", "header", WALLPAPER_WIDTHS);
}
