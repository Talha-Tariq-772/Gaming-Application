import "server-only";

import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import type { SetupGuide } from "@/src/types/database";

/**
 * Real Supabase-backed reads for setup_guides
 * (supabase/migrations/20260831000001_setup_guides.sql) — same pattern as
 * catalog.ts: stateless anon client, always is_published only (matches the
 * table's RLS policy for anon/customer). Separate module from catalog.ts
 * since this isn't game-catalog data, and from mock-guides.ts since this is
 * real, not mock.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSetupGuideRow(row: any): SetupGuide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    platform: row.platform,
    productType: row.product_type,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Strips characters that would break PostgREST's `.or()` filter-string syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export interface SetupGuideFilters {
  /** Case-insensitive match against title and body. */
  search?: string;
}

/** Ordered by productType then sortOrder — game guides before membership
 * guides, ascending within each. */
export async function getSetupGuides(filters: SetupGuideFilters = {}): Promise<SetupGuide[]> {
  return safeAsync("setup guides", async () => {
    const supabase = await createClient();
    let query = supabase
      .from("setup_guides")
      .select("*")
      .eq("is_published", true)
      .order("product_type", { ascending: true })
      .order("sort_order", { ascending: true });

    const term = filters.search ? sanitizeSearchTerm(filters.search) : "";
    if (term) {
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapSetupGuideRow);
  });
}

export async function getSetupGuideBySlug(slug: string): Promise<SetupGuide | null> {
  return safeAsync("setup guide", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("setup_guides")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSetupGuideRow(data) : null;
  });
}

/** Looks up by id rather than slug — for the game detail page, which only
 * has games.setup_guide_id. Returns null for a null/missing id without
 * querying, same fail-quiet shape as a not-found slug lookup. */
export async function getSetupGuideById(id: string | null): Promise<SetupGuide | null> {
  if (!id) return null;
  return safeAsync("setup guide", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("setup_guides")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSetupGuideRow(data) : null;
  });
}
