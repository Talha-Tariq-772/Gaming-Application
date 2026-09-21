"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import {
  normaliseHardwareSlug,
  validateHardwareInput,
  type HardwareInput,
} from "@/src/lib/hardware-validation";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import type { AdminHardwareProduct } from "@/src/types/database";

/**
 * Hardware CRUD, service-role only.
 *
 * Every read and write here goes through the SERVICE client rather than
 * the admin's own session, for the same reason getGamesForAdmin() does:
 * hardware_products.cost_price is revoked from `authenticated` at the
 * column level (20260921000002_hardware_products.sql), so even a real
 * admin session cannot read it. requireAdmin() is the authorization
 * boundary.
 *
 * Field rules live in src/lib/hardware-validation.ts, shared verbatim
 * with the form dialog — see that file for what is required and, more
 * importantly, what deliberately is not.
 *
 * Every function here returns a discriminated result carrying a
 * displayable message on failure. None of them throw for an expected
 * condition and none return a bare boolean: a caller with nothing to show
 * is how a Save button goes silently dead.
 */

export type HardwareActionResult =
  | { ok: true; product: AdminHardwareProduct }
  | { ok: false; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminHardwareRow(row: any): AdminHardwareProduct {
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
    costPrice:
      row.cost_price === null || row.cost_price === undefined ? null : Number(row.cost_price),
  };
}

function toRow(input: HardwareInput) {
  return {
    slug: normaliseHardwareSlug(input.slug),
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category,
    sale_price: input.salePrice,
    cost_price: input.costPrice,
    stock_quantity: input.stockQuantity,
    // Blank entries are dropped rather than stored: an empty string passes
    // the NOT NULL array constraint and then renders as a broken <img>.
    image_urls: input.imageUrls.map((u) => u.trim()).filter((u) => u.length > 0),
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
}

/** Every hardware product, active or not, newest first. */
export async function getHardwareForAdmin(): Promise<AdminHardwareProduct[]> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hardware_products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAdminHardwareRow);
}

export async function createHardwareProduct(input: HardwareInput): Promise<HardwareActionResult> {
  await requireAdmin();
  const invalid = validateHardwareInput(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hardware_products")
    .insert(toRow(input))
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A hardware product with this slug already exists." };
    }
    console.error("[createHardwareProduct]", error);
    return { ok: false, message: "Something went wrong creating this product." };
  }
  return { ok: true, product: mapAdminHardwareRow(data) };
}

export async function updateHardwareProduct(
  productId: string,
  input: HardwareInput,
): Promise<HardwareActionResult> {
  await requireAdmin();
  const invalid = validateHardwareInput(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hardware_products")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", productId)
    .select("*")
    // maybeSingle, not single: .single() on zero rows returns PGRST116,
    // which would surface as the generic "something went wrong" below and
    // hide the real cause — the product was deleted in another tab.
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A hardware product with this slug already exists." };
    }
    console.error("[updateHardwareProduct]", error);
    return { ok: false, message: "Something went wrong saving this product." };
  }
  if (!data) {
    return { ok: false, message: "This product no longer exists — it may have been deleted." };
  }
  return { ok: true, product: mapAdminHardwareRow(data) };
}

export type DeleteHardwareResult = { ok: true } | { ok: false; message: string };

/**
 * Hard delete, with one guard: order_items.hardware_product_id is a
 * blocking FK (no ON DELETE action), so a product that has ever been
 * ordered cannot be removed without destroying that order's history.
 * Postgres refuses with a bare 23503; this turns that into a sentence and
 * points at the alternative, which is what deactivating is for.
 */
export async function deleteHardwareProduct(productId: string): Promise<DeleteHardwareResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.from("hardware_products").delete().eq("id", productId);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        message:
          "This product appears on existing orders, so it can't be deleted. Set it inactive instead to hide it from the store.",
      };
    }
    console.error("[deleteHardwareProduct]", error);
    return { ok: false, message: "Something went wrong deleting this product." };
  }
  return { ok: true };
}

/**
 * Stock correction, separate from the full form: an admin restocking
 * after a delivery shouldn't have to reopen and re-save every other field
 * to do it.
 */
export async function setHardwareStock(
  productId: string,
  stockQuantity: number,
): Promise<HardwareActionResult> {
  await requireAdmin();
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return { ok: false, message: "Stock must be a whole number, 0 or more." };
  }
  if (stockQuantity > 1_000_000) return { ok: false, message: "Stock is too large." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hardware_products")
    .update({ stock_quantity: stockQuantity, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[setHardwareStock]", error);
    return { ok: false, message: "Something went wrong updating stock." };
  }
  if (!data) {
    return { ok: false, message: "This product no longer exists — it may have been deleted." };
  }
  return { ok: true, product: mapAdminHardwareRow(data) };
}

/**
 * Active/inactive toggle — the non-destructive alternative to deleting a
 * product that already carries order history.
 */
export async function setHardwareActive(
  productId: string,
  isActive: boolean,
): Promise<HardwareActionResult> {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hardware_products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[setHardwareActive]", error);
    return { ok: false, message: "Something went wrong updating this product." };
  }
  if (!data) {
    return { ok: false, message: "This product no longer exists — it may have been deleted." };
  }
  return { ok: true, product: mapAdminHardwareRow(data) };
}
