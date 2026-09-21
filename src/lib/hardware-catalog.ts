import "server-only";

/**
 * Explicit column list, never "*": hardware_products.cost_price is revoked
 * from anon/authenticated at the column level
 * (20260921000002_hardware_products.sql), so "*" errors rather than
 * leaking what a console costs us. Adding a public column means adding it
 * here AND granting it in a migration.
 */
const PUBLIC_HARDWARE_COLUMNS =
  "id, slug, name, description, category, sale_price, stock_quantity, image_urls, is_active, sort_order, created_at, updated_at";

import { cache } from "react";
import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import type { HardwareFilters, HardwareProduct } from "@/src/types/database";

/**
 * Real Supabase-backed hardware catalog reads (anon key, is_active only by
 * default — matches hardware_products' RLS policy for anon/customer).
 * Mirrors src/lib/gift-card-catalog.ts's shape exactly; hardware is a
 * separate table, not a third games.product_type value, but the
 * query/mapping conventions are the same.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHardwareRow(row: any): HardwareProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    salePrice: Number(row.sale_price),
    stockQuantity: Number(row.stock_quantity),
    // text[] comes back as a real array from PostgREST, but a null column
    // (possible on a row written before the NOT NULL default, or by a
    // hand-run SQL insert) would otherwise crash every .map() downstream.
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Strips characters that would break PostgREST's `.or()` filter-string syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export async function getHardwareProducts(
  filters: HardwareFilters = {},
): Promise<HardwareProduct[]> {
  return safeAsync("hardware products", async () => {
    const { category, search, sort = "newest", isActive = true, inStockOnly = false } = filters;

    const supabase = createClient();
    let query = supabase
      .from("hardware_products")
      .select(PUBLIC_HARDWARE_COLUMNS)
      .eq("is_active", isActive);

    if (category && category.length > 0) query = query.in("category", category);
    if (inStockOnly) query = query.gt("stock_quantity", 0);

    const term = search ? sanitizeSearchTerm(search) : "";
    if (term) {
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    switch (sort) {
      case "price_asc":
        query = query.order("sale_price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("sale_price", { ascending: false });
        break;
      case "name":
        query = query.order("name", { ascending: true });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapHardwareRow);
  });
}

/**
 * Wrapped in React's `cache` so the detail route's generateMetadata and
 * its body share one query per request — same treatment
 * getGiftCardProductBySlug gets.
 */
export const getHardwareProductBySlug = cache(
  async (slug: string): Promise<HardwareProduct | null> => {
    return safeAsync("hardware product", async () => {
      const supabase = createClient();
      // No is_active filter, matching getGiftCardProductBySlug: the anon
      // RLS policy already hides inactive rows, so adding one here would
      // only stop an admin previewing a draft product at its real URL.
      const { data, error } = await supabase
        .from("hardware_products")
        .select(PUBLIC_HARDWARE_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? mapHardwareRow(data) : null;
    });
  },
);

/**
 * Used by the cart's on-load integrity check, which must be able to tell
 * "this product went inactive/out of stock" from "the lookup failed" —
 * hence no is_active filter here. The caller decides.
 */
export async function getHardwareProductsByIds(ids: string[]): Promise<HardwareProduct[]> {
  if (ids.length === 0) return [];
  return safeAsync("hardware products by id", async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hardware_products")
      .select(PUBLIC_HARDWARE_COLUMNS)
      .in("id", ids);
    if (error) throw error;
    return (data ?? []).map(mapHardwareRow);
  });
}
