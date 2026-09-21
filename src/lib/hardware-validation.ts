import { HARDWARE_CATEGORIES, type HardwareCategory } from "@/src/types/database";

/**
 * Hardware form rules, in one place.
 *
 * Deliberately NOT inside src/lib/actions/admin-hardware.ts: that file is
 * "use server", where every export must be an async server action, so a
 * pure validator cannot live there. Keeping the rules here means the
 * dialog and the server action validate against the SAME function rather
 * than two hand-synced copies — the form can never accept something the
 * action will reject, or vice versa.
 *
 * What is required, and what deliberately is not:
 *
 *   REQUIRED   slug, name, category, salePrice
 *   OPTIONAL   description, costPrice, imageUrls, sortOrder
 *
 * The optional set is optional on purpose. Requiring a field that does
 * not apply to every product is the exact failure that made every seeded
 * game unsaveable through /admin/games (36cbb31): the form demanded a
 * cover URL, trailer, setup guide and description that 18 of 19 rows did
 * not have, and the Save button simply did nothing. A half-written
 * hardware product with no photos yet is a real, legitimate state — it
 * just can't be published, which is what `isActive` is for, not what
 * validation is for.
 */

export interface HardwareInput {
  slug: string;
  name: string;
  description: string;
  category: HardwareCategory;
  salePrice: number;
  /** Null means "no cost recorded" — a real state the profit report
   * handles as items_missing_cost, never silently treated as zero. */
  costPrice: number | null;
  stockQuantity: number;
  imageUrls: string[];
  isActive: boolean;
  sortOrder: number | null;
}

/** numeric(10,2): anything larger fails at the DB with an opaque 22003
 * rather than a sentence an admin can act on. */
const MAX_MONEY = 99_999_999;
const MAX_STOCK = 1_000_000;

export function normaliseHardwareSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Root-relative asset path or absolute http(s) URL — the same two shapes
 * gameFormSchema's coverImageUrl accepts, and for the same reason: seeded
 * art is stored root-relative, and next/image rejects any host not listed
 * in next.config.ts. Rejects protocol-relative "//evil.com/x" and
 * backslashes, both of which a browser can read as a host.
 */
export function isUsableImageRef(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns a message the form renders verbatim, or null when the input is
 * usable. Every rejection is a full sentence naming the field — there is
 * no path through this function that returns a bare `false`, because a
 * caller with nothing to display is how a Save button goes silently dead.
 */
export function validateHardwareInput(input: HardwareInput): string | null {
  if (!normaliseHardwareSlug(input.slug)) return "Slug is required.";
  if (!input.name.trim()) return "Name is required.";
  if (!HARDWARE_CATEGORIES.includes(input.category)) return "Pick a category.";

  if (!Number.isFinite(input.salePrice) || input.salePrice <= 0) {
    return "Sale price must be greater than 0.";
  }
  if (input.salePrice > MAX_MONEY) return "Sale price is too large.";

  // Cost price is OPTIONAL (null) but, unlike sale price, may be 0 — a
  // bundled or giveaway unit genuinely costs nothing.
  if (input.costPrice !== null) {
    if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
      return "Enter a valid cost price, or leave it blank.";
    }
    if (input.costPrice > MAX_MONEY) return "Cost price is too large.";
  }

  if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
    return "Stock must be a whole number, 0 or more.";
  }
  if (input.stockQuantity > MAX_STOCK) return "Stock is too large.";

  if (input.sortOrder !== null && !Number.isInteger(input.sortOrder)) {
    return "Order must be a whole number.";
  }

  const badImage = input.imageUrls.find((url) => url.trim() !== "" && !isUsableImageRef(url.trim()));
  if (badImage !== undefined) {
    return `Image "${badImage}" must be a path like /controller.png or a full http(s) URL.`;
  }

  return null;
}
