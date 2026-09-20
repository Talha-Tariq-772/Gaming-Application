import "server-only";

import { requireAdmin } from "@/src/lib/auth/session";
import { mapGameRow } from "@/src/lib/catalog";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { AdminGame, FaqItem } from "@/src/types/database";

/**
 * All games, active or not — unlike catalog.ts's getGames() (which uses
 * the stateless anon client so it can run at build time, and therefore
 * can never see inactive rows regardless of who's really asking), this
 * needs the real admin session so RLS actually grants full visibility.
 */
export async function getGamesForAdmin(): Promise<AdminGame[]> {
  await requireAdmin();

  // SERVICE client, not the session client this used before: cost_price is
  // revoked from `authenticated` at the column level
  // (20260920000002_cost_price.sql), so an admin's own session cannot read
  // it. requireAdmin() above is the authorization boundary — the same
  // arrangement getCredentialStock() already uses for game_credentials.
  // Service role also sees inactive rows, which is what the session client
  // was relied on for here.
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("games").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...mapGameRow(row),
    costPrice: row.cost_price === null || row.cost_price === undefined ? null : Number(row.cost_price),
  }));
}

export interface CredentialStockEntry {
  gameId: string;
  available: number;
  reserved: number;
  sold: number;
  revoked: number;
}

/**
 * Per-game credential counts only — game_credentials has zero RLS policies
 * for any client role, so this is reachable only via the service role,
 * gated by requireAdmin() as the actual authorization check. Never returns
 * (or even selects) login_enc/password_enc.
 */
export async function getCredentialStock(): Promise<CredentialStockEntry[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_credential_stock");
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    gameId: row.game_id,
    available: Number(row.available),
    reserved: Number(row.reserved),
    sold: Number(row.sold),
    revoked: Number(row.revoked),
  }));
}

export interface EstimatedVariantEntry {
  variantId: string;
  gameId: string;
  gameTitle: string;
  gameSlug: string;
  label: string;
  pricePkr: number;
}

/**
 * Every active variant still priced from a guess rather than the WhatsApp
 * catalog (price_source='estimate' — 20260829000004_seed_catalog.sql seeded
 * exactly 5 of these). One screen listing all of them, across every game,
 * so Hashir can confirm real prices instead of hunting game-by-game
 * through each VariantsPanel. Two queries rather than one PostgREST embed:
 * a many-to-one embed's return shape (object vs array) isn't exercised
 * anywhere else in this codebase yet, and this list is tiny — not worth
 * the ambiguity for a handful of rows.
 */
export async function getEstimatedVariants(): Promise<EstimatedVariantEntry[]> {
  await requireAdmin();

  const supabase = await createSessionClient();
  const { data: variants, error: variantsErr } = await supabase
    .from("game_variants")
    .select("id, game_id, label, price_pkr")
    .eq("price_source", "estimate")
    .eq("is_active", true)
    .order("label", { ascending: true });
  if (variantsErr) throw variantsErr;
  if (!variants || variants.length === 0) return [];

  const gameIds = [...new Set(variants.map((v) => v.game_id))];
  const { data: games, error: gamesErr } = await supabase.from("games").select("id, title, slug").in("id", gameIds);
  if (gamesErr) throw gamesErr;

  const gameById = new Map((games ?? []).map((g) => [g.id, g]));

  return variants.flatMap((v) => {
    const game = gameById.get(v.game_id);
    if (!game) return []; // shouldn't happen (FK-backed), skip rather than crash the page
    return [
      {
        variantId: v.id,
        gameId: game.id,
        gameTitle: game.title,
        gameSlug: game.slug,
        label: v.label,
        pricePkr: Number(v.price_pkr),
      },
    ];
  });
}

/**
 * Every FAQ row, published or not — the public getFaqItems() (src/lib/faqs.ts)
 * uses the stateless anon client and so can only ever see published rows
 * regardless of who is asking, exactly like getGames() vs getGamesForAdmin().
 * This needs the real admin session for faqs_select to grant draft visibility.
 */
export async function getFaqsForAdmin(): Promise<FaqItem[]> {
  await requireAdmin();

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    question: row.question,
    answer: row.answer,
    category: row.category,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }));
}
