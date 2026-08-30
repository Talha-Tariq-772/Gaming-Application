/**
 * Shared between src/lib/catalog.ts (server-only) and
 * src/lib/use-games-by-ids.ts ("use client") — neither can import the
 * other's mapGameRow, so this constant is the one thing both need to stay
 * in sync on. See scripts/generate-game-placeholder.mjs for how the asset
 * itself was generated and why it's a PNG.
 *
 * The `games` table's cover_image_url column has no NOT NULL constraint
 * (supabase/migrations/20260818000002_games.sql), but Game.coverImageUrl
 * is typed as a required `string` — every render call site trusts that.
 * Falling back to `""` (the previous behavior) made that trust a lie:
 * next/image's <Image> throws on an empty src. This path keeps the
 * guarantee actually true.
 */
export const GAME_COVER_PLACEHOLDER = "/game-cover-placeholder.png";
