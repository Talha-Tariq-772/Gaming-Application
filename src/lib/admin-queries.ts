import "server-only";

import { requireAdmin } from "@/src/lib/auth/session";
import { mapGameRow } from "@/src/lib/catalog";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { Game } from "@/src/types/database";

/**
 * All games, active or not — unlike catalog.ts's getGames() (which uses
 * the stateless anon client so it can run at build time, and therefore
 * can never see inactive rows regardless of who's really asking), this
 * needs the real admin session so RLS actually grants full visibility.
 */
export async function getGamesForAdmin(): Promise<Game[]> {
  await requireAdmin();

  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("games").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapGameRow);
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
