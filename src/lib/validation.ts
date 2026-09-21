/**
 * UX VALIDATION ONLY. Every rule in this file exists to give the user a
 * fast, friendly error before they submit anything — it runs entirely in
 * the browser and a motivated user can bypass all of it via devtools or a
 * raw request. It is NOT a security boundary. When a real backend exists,
 * every single rule here must be duplicated (and actually enforced)
 * server-side; nothing here should ever be trusted as the source of
 * truth for whether an order, phone number, or admin edit is valid.
 */

import { z } from "zod";
import { isCommonPassword } from "@/src/lib/common-passwords";
import {
  GAME_GENRES,
  GAME_PLATFORMS,
  GIFT_CARD_PLATFORMS,
  GIFT_CARD_REGIONS,
  HARDWARE_CATEGORIES,
} from "@/src/types/database";
import type { OrderStatus } from "@/src/types/database";

/* ---------------------------------------------------------------------- */
/* Phone                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Pakistani mobile numbers only. Every cellular operator's numbering
 * space (Jazz, Telenor, Zong, Ufone, SCOM) starts with a 3 after the
 * trunk/country prefix — landline area codes never do (021 Karachi, 042
 * Lahore, 051 Islamabad, etc.), so requiring the local part to match
 * 3XXXXXXXXX rejects landlines as a side effect of the mobile-only rule,
 * not as a separate check.
 *
 * Accepts and normalizes every common way someone might type it:
 * 03001234567, 3001234567, 923001234567, +923001234567, 00923001234567,
 * with or without spaces/dashes — all collapse to the same canonical
 * "+92 3XX XXXXXXX" form.
 */
const PK_MOBILE_LOCAL = /^(?:\+92|0092|92|0)?(3\d{9})$/;

function toCanonicalPkPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s-]/g, "");
  const match = stripped.match(PK_MOBILE_LOCAL);
  if (!match) return null;
  const local = match[1];
  return `+92 ${local.slice(0, 3)} ${local.slice(3)}`;
}

const PHONE_ERROR = "Enter a valid Pakistani mobile number, e.g. +92 300 1234567.";

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((raw, ctx) => {
    const canonical = toCanonicalPkPhone(raw);
    if (!canonical) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_ERROR });
      return z.NEVER;
    }
    return canonical;
  });

/** Non-throwing check for places that just want a boolean (e.g. gating a
 * submit button) without needing the normalized value or error details. */
export function isValidPkPhone(raw: string): boolean {
  return phoneSchema.safeParse(raw).success;
}

/* ---------------------------------------------------------------------- */
/* Cart item                                                                */
/* ---------------------------------------------------------------------- */

const credentialCartItemSchema = z.object({
  kind: z.literal("credential"),
  gameId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  price: z.number().positive(),
  coverImageUrl: z.string().min(1),
});

const giftCardCartItemSchema = z.object({
  kind: z.literal("gift_card"),
  productId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  price: z.number().positive(),
  coverImageUrl: z.string().min(1),
  platform: z.enum(GIFT_CARD_PLATFORMS),
  region: z.enum(GIFT_CARD_REGIONS),
  denominationValue: z.number().nullable(),
  denominationCurrency: z.string().nullable(),
});

const hardwareCartItemSchema = z.object({
  kind: z.literal("hardware"),
  productId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  price: z.number().positive(),
  coverImageUrl: z.string().min(1),
  category: z.enum(HARDWARE_CATEGORIES),
});

export const cartItemSchema = z.discriminatedUnion("kind", [
  credentialCartItemSchema,
  giftCardCartItemSchema,
  hardwareCartItemSchema,
]);

export type CartItemInput = z.infer<typeof cartItemSchema>;

/* ---------------------------------------------------------------------- */
/* Phone+password auth (signup/login)                                      */
/* ---------------------------------------------------------------------- */

/**
 * Length only, no composition rules (no forced upper/lower/digit/symbol
 * mix) — per spec. The denylist check catches the passwords an attacker
 * tries first against every account, which composition rules don't.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((v) => !isCommonPassword(v), {
    message: "That password is too common. Choose something less guessable.",
  });

/** "" is valid (recovery email is optional) — parses to null so callers
 * never have to special-case an empty string themselves. */
export const recoveryEmailSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Enter a valid email, or leave it blank.",
  });

export const signUpFormSchema = z.object({
  phoneNumber: phoneSchema,
  password: passwordSchema,
  recoveryEmail: recoveryEmailSchema,
});

export const loginFormSchema = z.object({
  phoneNumber: phoneSchema,
  password: z.string().min(1, "Enter your password"),
});

/* ---------------------------------------------------------------------- */
/* Order                                                                    */
/* ---------------------------------------------------------------------- */

const ORDER_STATUSES: [OrderStatus, ...OrderStatus[]] = [
  "awaiting_payment",
  "payment_claimed",
  "under_review",
  "approved",
  "rejected",
  "expired",
];

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const orderSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  status: orderStatusSchema,
  paymentReference: z.string().min(1),
  amountExact: z.number().positive(),
  paymentMethodId: z.string().min(1),
  claimedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  reservedUntil: z.string().min(1),
  refundPolicyConsentedAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

/* ---------------------------------------------------------------------- */
/* Checkout form (StepPaymentMethod)                                       */
/* ---------------------------------------------------------------------- */

export const checkoutFormSchema = z.object({
  paymentMethodId: z.string().min(1, "Select a payment method"),
  phoneNumber: phoneSchema,
});

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;

/* ---------------------------------------------------------------------- */
/* Admin: game form (GameFormDialog)                                       */
/* ---------------------------------------------------------------------- */

/**
 * Root-relative asset path ("/game-cover-placeholder.png") — what the
 * seeded catalog actually stores, and what next/image accepts without any
 * remotePatterns config. Rejects protocol-relative "//evil.com/x" and
 * anything with a backslash, both of which browsers can read as a host.
 */
function isRootRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

/** Absolute http(s) URL. Uses the URL parser rather than a regex so the
 * accepted set matches what the browser will actually fetch. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const gameFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  // Optional for the same reason as the three fields below: the three
  // seeded membership products (PlayStation Plus, PS Plus Extra &
  // Premium, Xbox Game Pass Ultimate) ship with no description, so
  // requiring it left them unsaveable even after cover/trailer/setup
  // guide were relaxed. GameDetailBody already renders the description
  // behind a `hasDescription &&` guard, so "" is a state the storefront
  // handles.
  description: z.string().trim(),
  price: z.coerce
    .number({ error: "Enter a valid price" })
    .positive("Price must be greater than 0"),
  // Cost price is optional: "" means "no cost recorded", which is a real
  // state the profit report handles explicitly (items_missing_cost) rather
  // than treating as zero. Unlike `price` it may be 0 — a free/bundled
  // item genuinely costs nothing.
  costPrice: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: "Enter a valid cost price",
    })
    .transform((v) => (v === "" ? null : Number(v))),
  // "" means "no genre", which is the correct state for a membership —
  // subscriptions have no genre and the DB enforces exactly that split
  // (games_genre_required_for_game_check). The superRefine below is what
  // still requires one for an actual game, so relaxing the enum here does
  // not let a genre-less game through.
  genre: z
    .union([z.enum(GAME_GENRES), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  // Carried through the form but never edited in it — the field exists so
  // the genre rule below knows which kind of product it is looking at.
  productType: z.enum(["game", "membership"]),
  platform: z.enum(GAME_PLATFORMS),
  // All three are optional in practice and the schema now says so.
  //
  // They were required-and-absolute, which made EVERY seeded game
  // unsaveable: seed rows carry a ROOT-RELATIVE cover_image_url
  // ("/game-cover-placeholder.png") and empty trailer/setup-guide, so
  // opening any of them in this form and pressing save failed on three
  // fields the admin never touched. Worse, satisfying .url() by typing an
  // absolute "http://localhost:3000/..." then broke the public product
  // page outright — next/image rejects any host not listed in
  // next.config.ts ("hostname localhost is not configured").
  //
  // What the app actually renders:
  //   cover: mapGameRow falls back to GAME_COVER_PLACEHOLDER when empty,
  //          and the real art comes from coverPath (storage pipeline)
  //   trailer: TrailerEmbed returns null when the URL is empty/unparseable
  //   setupGuide: free text, rendered only if present
  // so "" is a valid, already-handled state for each.
  coverImageUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isRootRelativePath(v) || isHttpUrl(v), {
      message: "Use a path like /cover.png or a full http(s) URL",
    }),
  trailerUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isHttpUrl(v), { message: "Enter a valid URL" }),
  setupGuide: z.string().trim(),
  isActive: z.boolean(),
  isNewArrival: z.boolean(),
  isBestSeller: z.boolean(),
  // Plain <input type="date"> value — "" means no date, not an error.
  releaseDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Enter a valid date" })
    .transform((v) => (v === "" ? null : v)),
  // "" means no linked guide. Whether the id is real is a DB-level FK
  // check (games_setup_guide_id_fkey), not something worth duplicating
  // here — see createGame/updateGame's 23503 handling.
  setupGuideId: z.string().trim().transform((v) => (v === "" ? null : v)),
  })
  .superRefine((values, ctx) => {
    // Genre is required for a game and meaningless for a membership.
    // Mirrors games_genre_required_for_game_check so the form refuses what
    // the database would refuse, with a readable message instead of a
    // constraint violation.
    if (values.productType === "game" && values.genre === null) {
      ctx.addIssue({
        code: "custom",
        path: ["genre"],
        message: "Pick a genre",
      });
    }
  });

export type GameFormInput = z.input<typeof gameFormSchema>;
/** releaseDate/setupGuideId transform "" -> null on parse, so the shape
 * actually handed to onSave (post safeParse) differs from GameFormInput —
 * this is that post-transform shape. */
export type GameFormOutput = z.output<typeof gameFormSchema>;
export type GameFormErrors = Partial<Record<keyof GameFormInput, string>>;

/* ---------------------------------------------------------------------- */
/* Admin: variant form (VariantsPanel)                                     */
/* ---------------------------------------------------------------------- */

export const variantFormSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(60, "Label is too long"),
    pricePkr: z.coerce
      .number({ error: "Enter a valid price" })
      .int("Whole rupees only")
      .positive("Price must be greater than 0"),
    // Raw string field — "" means no "was" price, not an error.
    wasPricePkr: z.string().trim(),
    priceSource: z.enum(["catalog", "estimate"]),
  })
  .transform((v) => ({ ...v, wasPricePkr: v.wasPricePkr === "" ? null : Number(v.wasPricePkr) }))
  .refine((v) => v.wasPricePkr === null || Number.isFinite(v.wasPricePkr), {
    message: "Enter a valid was-price",
    path: ["wasPricePkr"],
  })
  .refine((v) => v.wasPricePkr === null || v.wasPricePkr > v.pricePkr, {
    message: "Was-price must be higher than the current price",
    path: ["wasPricePkr"],
  });

export type VariantFormInput = z.input<typeof variantFormSchema>;
export type VariantFormOutput = z.output<typeof variantFormSchema>;
export type VariantFormErrors = Partial<Record<keyof VariantFormInput, string>>;

/* ---------------------------------------------------------------------- */
/* Admin: reject-order form (RejectDialog)                                 */
/* ---------------------------------------------------------------------- */

export const rejectFormSchema = z.object({
  reason: z.string().min(1, "Select a reason"),
  notes: z.string().trim().max(500, "Keep notes under 500 characters"),
});

/* ---------------------------------------------------------------------- */
/* Shared helper                                                            */
/* ---------------------------------------------------------------------- */

/** Flattens a zod field-error map from a safeParse failure into a plain
 * `{ field: message }` object — every form below renders one message per
 * field inline, so this is all any of them actually need from the result. */
export function firstFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>,
): Partial<Record<keyof T, string>> {
  const out: Partial<Record<keyof T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key !== undefined && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}
