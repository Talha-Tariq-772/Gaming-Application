"use server";

import { isValidGamePlatform } from "@/src/lib/admin-guardrails";
import { purgeGameImages } from "@/src/lib/actions/admin-images";
import { requireAdmin } from "@/src/lib/auth/session";
import { mapGameRow } from "@/src/lib/catalog";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Game, GameGenre, GamePlatform } from "@/src/types/database";

export interface GameInput {
  title: string;
  slug: string;
  description: string;
  price: number;
  genre: GameGenre | null;
  platform: GamePlatform;
  coverImageUrl: string;
  trailerUrl: string;
  setupGuide: string;
  isActive: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  releaseDate: string | null;
  /** FK into setup_guides — see games_setup_guide_id_fkey
   * (20260831000001_setup_guides.sql). Null clears the link. */
  setupGuideId: string | null;
}

export type GameActionResult = { ok: true; game: Game } | { ok: false; message: string };

function toRow(input: GameInput) {
  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    price: input.price,
    genre: input.genre,
    platform: input.platform,
    cover_image_url: input.coverImageUrl,
    trailer_url: input.trailerUrl,
    setup_guide: input.setupGuide,
    is_active: input.isActive,
    is_new_arrival: input.isNewArrival,
    is_best_seller: input.isBestSeller,
    release_date: input.releaseDate,
    setup_guide_id: input.setupGuideId,
  };
}

export async function createGame(input: GameInput): Promise<GameActionResult> {
  await requireAdmin();
  if (!isValidGamePlatform(input.platform)) {
    return { ok: false, message: "Invalid platform." };
  }
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("games").insert(toRow(input)).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A game with this slug already exists." };
    }
    if (error.code === "23503") {
      return { ok: false, message: "The selected setup guide no longer exists." };
    }
    console.error("[createGame]", error);
    return { ok: false, message: "Something went wrong creating this game." };
  }

  // Every game needs at least one variant to be sellable: game_variants is
  // the single source of truth for price in BOTH variant_mode values
  // (20260829000003_game_variants.sql), and VariantPicker returns null
  // outright when a game has none — so a game created through this action
  // used to render a product page with no price and no Add to Cart button
  // at all. Not a crash, just quietly unbuyable, which is worse.
  //
  // 20260829000003 backfilled exactly this shape ('Standard' at the row's
  // price, price_source 'estimate' since a bare price carries no recorded
  // provenance) for every game that predated variants. New games get the
  // same rather than being born in a state the schema's own backfill
  // treated as broken.
  //
  // Non-fatal on failure: the game row itself is already committed, and
  // reporting "creating this game failed" for a row that plainly exists
  // would send the admin looking for a problem that isn't there. The
  // variants panel can add one by hand.
  const { error: variantErr } = await supabase.from("game_variants").insert({
    game_id: data.id,
    label: "Standard",
    price_pkr: Math.round(input.price),
    price_source: "estimate",
  });
  if (variantErr) {
    console.error("[createGame] default variant", variantErr);
  }

  // Re-read so the returned Game carries the variant just created —
  // mapGameRow(data) above would report variants: [] and the admin list
  // would show a price of zero until the next refresh.
  const { data: withVariants } = await supabase
    .from("games")
    .select("*, game_variants(*)")
    .eq("id", data.id)
    .single();

  return { ok: true, game: mapGameRow(withVariants ?? data) };
}

export async function updateGame(gameId: string, input: GameInput): Promise<GameActionResult> {
  await requireAdmin();
  if (!isValidGamePlatform(input.platform)) {
    return { ok: false, message: "Invalid platform." };
  }
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("games").update(toRow(input)).eq("id", gameId).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A game with this slug already exists." };
    }
    if (error.code === "23503") {
      return { ok: false, message: "The selected setup guide no longer exists." };
    }
    console.error("[updateGame]", error);
    return { ok: false, message: "Something went wrong saving this game." };
  }
  return { ok: true, game: mapGameRow(data) };
}

export async function setGameActive(gameId: string, isActive: boolean): Promise<GameActionResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("games")
    .update({ is_active: isActive })
    .eq("id", gameId)
    .select("*")
    .single();
  if (error) {
    console.error("[setGameActive]", error);
    return { ok: false, message: "Something went wrong updating this game." };
  }
  return { ok: true, game: mapGameRow(data) };
}

export type DeleteGameResult =
  | { ok: true; hardDeleted: true }
  /** The delete was refused because history references this game. Not an
   * error the admin caused — `blockedByHistory` lets the UI offer the
   * alternative (deactivate) rather than just reporting a failure. */
  | { ok: false; message: string; blockedByHistory: true }
  | { ok: false; message: string; blockedByHistory?: false };

/**
 * Deletes a game only when genuinely nothing references it. A game with
 * order_items or game_credentials history is REFUSED, with a message
 * naming the alternative.
 *
 * This used to silently soft-delete instead: same end state, but the admin
 * pressed "Delete" and got a deactivation they never asked for, with the
 * dialog's own copy as the only hint. Refusing matches
 * deleteHardwareProduct's contract (23503 -> "…can't be deleted. Set it
 * inactive instead…") so the two destructive flows in the panel behave
 * identically, and it keeps the decision with the admin rather than
 * quietly making it for them.
 *
 * game_credentials counts as history alongside order_items: hard-deleting
 * a game with provisioned-but-unsold inventory would orphan credentials
 * that cost real money to acquire.
 *
 * On a real delete, stored images are purged FIRST. game_variants cascade
 * at the database level (game_variants_game_id_fkey, ON DELETE CASCADE)
 * but Storage objects have no FK to cascade through, so without this they
 * would sit in the bucket forever with nothing referencing them.
 */
export async function deleteGame(gameId: string): Promise<DeleteGameResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const [orderItemsCheck, credentialsCheck] = await Promise.all([
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("game_id", gameId),
    supabase.from("game_credentials").select("id", { count: "exact", head: true }).eq("game_id", gameId),
  ]);
  if (orderItemsCheck.error) {
    console.error("[deleteGame] order_items check", orderItemsCheck.error);
    return { ok: false, message: "Something went wrong checking this game's order history." };
  }
  if (credentialsCheck.error) {
    console.error("[deleteGame] game_credentials check", credentialsCheck.error);
    return { ok: false, message: "Something went wrong checking this game's credential inventory." };
  }

  const orderCount = orderItemsCheck.count ?? 0;
  const credentialCount = credentialsCheck.count ?? 0;

  if (orderCount > 0 || credentialCount > 0) {
    const reason =
      orderCount > 0 && credentialCount > 0
        ? "appears on existing orders and has credential inventory"
        : orderCount > 0
          ? "appears on existing orders"
          : "has credential inventory";
    return {
      ok: false,
      blockedByHistory: true,
      message: `This game ${reason}, so it can't be deleted. Set it inactive instead to hide it from the store.`,
    };
  }

  // Before the row goes, not after: once it's deleted there is no slug or
  // cover_path/wallpaper_path left to locate the objects from.
  await purgeGameImages(gameId);

  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) {
    console.error("[deleteGame] hard delete", error);
    return { ok: false, message: "Something went wrong deleting this game." };
  }
  return { ok: true, hardDeleted: true };
}
