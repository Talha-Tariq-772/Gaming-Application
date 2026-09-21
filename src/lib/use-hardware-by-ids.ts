"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import type { HardwareProduct } from "@/src/types/database";

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
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface HardwareByIdsResult {
  /** Currently-active real hardware products among the requested ids — a
   * requested id missing from this list has since been deactivated or
   * deleted. Stock is carried on each row rather than filtered here: the
   * cart needs to tell "gone" from "temporarily sold out", and those get
   * different copy. */
  hardware: HardwareProduct[];
  /** False until the fetch for the current id set has resolved. Stays
   * false forever on a fetch error — callers should fail open (trust
   * their own cached data) rather than treat "couldn't check" as
   * "invalid". */
  loaded: boolean;
}

const EMPTY_LOADED: HardwareByIdsResult = { hardware: [], loaded: true };

/**
 * Client-side lookup of real, currently-active hardware products by id —
 * the hardware third of cart validation (CartIntegrityGuard,
 * useCartSummary). Mirrors use-gift-cards-by-ids.ts exactly, same
 * reasoning throughout (browser client, explicit is_active filter rather
 * than relying on RLS alone, key-based `loaded` tracking).
 */
export function useHardwareByIds(ids: string[]): HardwareByIdsResult {
  const key = [...new Set(ids)].sort().join(",");
  const [state, setState] = useState<{ key: string; hardware: HardwareProduct[] }>({
    key: "",
    hardware: [],
  });

  useEffect(() => {
    if (!key) {
      setState({ key: "", hardware: [] });
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("hardware_products")
      // Explicit columns, never "*": this runs in the BROWSER as anon, and
      // hardware_products.cost_price is column-revoked from that role
      // (20260921000002_hardware_products.sql) — "*" would error here.
      .select(
        "id, slug, name, description, category, sale_price, stock_quantity, image_urls, is_active, sort_order, created_at, updated_at",
      )
      .eq("is_active", true)
      .in("id", key.split(","))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useHardwareByIds]", error);
          return;
        }
        setState({ key, hardware: (data ?? []).map(mapHardwareRow) });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return EMPTY_LOADED;
  return { hardware: state.key === key ? state.hardware : [], loaded: state.key === key };
}
