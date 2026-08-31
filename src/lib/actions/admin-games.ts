"use server";

import { isValidGamePlatform } from "@/src/lib/admin-guardrails";
import { requireAdmin } from "@/src/lib/auth/session";
import { mapGameRow } from "@/src/lib/catalog";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Game, GameGenre, GamePlatform } from "@/src/types/database";

export interface GameInput {
  title: string;
  slug: string;
  description: string;
  price: number;
  genre: GameGenre;
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
  return { ok: true, game: mapGameRow(data) };
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

export type DeleteGameResult = { ok: true; hardDeleted: boolean } | { ok: false; message: string };

/**
 * Soft-deletes (is_active=false) if any order_items or game_credentials
 * ever referenced this game — a hard delete would break order_items
 * history, and would also silently orphan any provisioned-but-unsold
 * credential inventory (broader than the literal "orders" check, but the
 * same underlying reasoning). Real delete only when genuinely nothing
 * references it.
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

  const isReferenced = (orderItemsCheck.count ?? 0) > 0 || (credentialsCheck.count ?? 0) > 0;

  if (isReferenced) {
    const { error } = await supabase.from("games").update({ is_active: false }).eq("id", gameId);
    if (error) {
      console.error("[deleteGame] soft delete", error);
      return { ok: false, message: "Something went wrong deactivating this game." };
    }
    return { ok: true, hardDeleted: false };
  }

  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) {
    console.error("[deleteGame] hard delete", error);
    return { ok: false, message: "Something went wrong deleting this game." };
  }
  return { ok: true, hardDeleted: true };
}
