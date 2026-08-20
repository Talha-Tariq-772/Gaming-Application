import "server-only";

import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { Game, GameFilters, PaymentMethod } from "@/src/types/database";

/**
 * Real Supabase-backed catalog reads (anon key, always is_active only —
 * matches the games/payment_methods RLS policies for anon/customer).
 * Uses the stateless anon client (no cookies/session) rather than
 * server-session.ts: these run in generateStaticParams/build-time contexts
 * with no request at all, where next/headers' cookies() throws. Admins get
 * no special preview of inactive rows here; that would need a separate,
 * explicitly-admin-checked path if ever wanted.
 *
 * Split out from mock-data.ts because mock-data.ts's MOCK_* constants are
 * still imported directly by client components (e.g. app/admin/page.tsx),
 * and this file must never end up in a client bundle.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapGameRow(row: any): Game {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    price: Number(row.price),
    coverImageUrl: row.cover_image_url ?? "",
    trailerUrl: row.trailer_url ?? "",
    genre: row.genre,
    platform: row.platform,
    setupGuide: row.setup_guide ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaymentMethodRow(row: any): PaymentMethod {
  return {
    id: row.id,
    label: row.label,
    accountTitle: row.account_title,
    accountNumber: row.account_number,
    iban: row.iban,
    raastId: row.raast_id,
    instructions: row.instructions ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

/** Strips characters that would break PostgREST's `.or()` filter-string syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export async function getGames(filters: GameFilters = {}): Promise<Game[]> {
  return safeAsync("games", async () => {
    const { genre, platform, search, minPrice, maxPrice, sort = "newest", isActive = true } = filters;

    const supabase = await createClient();
    let query = supabase.from("games").select("*").eq("is_active", isActive);

    if (genre && genre.length > 0) query = query.in("genre", genre);
    if (platform && platform.length > 0) query = query.in("platform", platform);
    if (minPrice !== undefined) query = query.gte("price", minPrice);
    if (maxPrice !== undefined) query = query.lte("price", maxPrice);

    const term = search ? sanitizeSearchTerm(search) : "";
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    switch (sort) {
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapGameRow);
  });
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  return safeAsync("game", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? mapGameRow(data) : null;
  });
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return safeAsync("payment methods", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapPaymentMethodRow);
  });
}

/**
 * Batch lookups for order-history display. Service role, not the public
 * anon client: RLS only lets anon/customer sessions see is_active rows,
 * but a customer's own past order can legitimately reference a game or
 * payment method that's since been deactivated — this isn't sensitive
 * data, just filtered by the "active" business rule for catalog browsing,
 * not for privacy, so bypassing that filter here is safe.
 */
export async function getGamesByIds(ids: string[]): Promise<Game[]> {
  if (ids.length === 0) return [];
  return safeAsync("games", async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("games").select("*").in("id", ids);
    if (error) throw error;
    return (data ?? []).map(mapGameRow);
  });
}

export async function getPaymentMethodsByIds(ids: string[]): Promise<PaymentMethod[]> {
  if (ids.length === 0) return [];
  return safeAsync("payment methods", async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("payment_methods").select("*").in("id", ids);
    if (error) throw error;
    return (data ?? []).map(mapPaymentMethodRow);
  });
}
