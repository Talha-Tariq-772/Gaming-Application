/**
 * Data-layer contract.
 *
 * These types mirror the eventual Postgres schema field-for-field. Mock
 * data and every component that consumes it must conform to these shapes
 * so swapping the mock functions in `lib/mock-data.ts` for real queries
 * later requires no changes downstream.
 *
 * Timestamps are ISO 8601 strings (as they'd arrive over JSON), not `Date`.
 */

// Union of the pre-existing admin-form list (Action..Horror) and the seed's
// genre set (supabase/migrations/20260829000004_seed_catalog.sql: Action,
// RPG, Shooter, Sports, Racing, Horror, Fighting) — Sports and Fighting are
// the two the seed uses that this list didn't have before. Matches the
// games_genre_check constraint in
// supabase/migrations/20260829000002_games_catalog_columns.sql exactly —
// change one, change the other.
export const GAME_GENRES = [
  "Action",
  "Adventure",
  "RPG",
  "Racing",
  "Shooter",
  "Strategy",
  "Puzzle",
  "Simulation",
  "Horror",
  "Sports",
  "Fighting",
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

// Matches the games_platform_check constraint in
// supabase/migrations/20260829000002_games_catalog_columns.sql exactly —
// change one, change the other.
export const GAME_PLATFORMS = ["ps4", "ps5", "ps4_ps5", "xbox"] as const;

export type GamePlatform = (typeof GAME_PLATFORMS)[number];

/** Human-readable labels for GAME_PLATFORMS, e.g. for a <select>'s option text. */
export const GAME_PLATFORM_LABELS: Record<GamePlatform, string> = {
  ps4: "PS4",
  ps5: "PS5",
  ps4_ps5: "PS4 & PS5",
  xbox: "Xbox",
};

export type ProductType = "game" | "membership";
export type VariantMode = "single" | "multi";
export type PriceSource = "catalog" | "estimate";

/**
 * Price source of truth in BOTH variantMode values — variantMode='single'
 * means "exactly one active variant, render a price not a picker", it does
 * NOT mean price lives on the Game row (see Game.price below). Populated by
 * catalog.ts's mapGameRow via a nested game_variants select; always
 * is_active only.
 */
export interface GameVariant {
  id: string;
  gameId: string;
  label: string;
  pricePkr: number;
  wasPricePkr: number | null;
  priceSource: PriceSource;
  sortOrder: number;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  description: string;
  /** Legacy pre-variants price column — still populated (seeded equal to
   * the base/lowest variant's price) but no longer authoritative. Used only
   * as the server-side sort/filter key for price today, since deriving
   * "effective price" from variants isn't expressible as a plain column
   * filter without a schema change (out of scope this session). Display
   * code must read `variants`, never this field directly. */
  price: number;
  coverImageUrl: string;
  trailerUrl: string;
  genre: GameGenre;
  /** Null on every game seeded so far — Session 1 populated the column and
   * its CHECK constraint but never the values themselves. */
  platform: GamePlatform | null;
  setupGuide: string;
  isActive: boolean;
  createdAt: string;
  productType: ProductType;
  releaseDate: string | null;
  isNewArrival: boolean;
  isBestSeller: boolean;
  variantMode: VariantMode;
  /** Object path prefix in the game-images bucket, e.g. "covers/gta-vi" —
   * see src/lib/storage-image.ts for how this becomes a real URL. Null
   * means no cover art uploaded (falls back to coverImageUrl). */
  coverPath: string | null;
  /** Same shape as coverPath, "wallpapers/gta-vi" (games, game-images
   * bucket) or "{slug}/header" (memberships, membership-images bucket). */
  wallpaperPath: string | null;
  /** 1-based homepage/store slider order. Null means not in the slider. */
  sliderPosition: number | null;
  /** Active variants only, ascending by sortOrder. Single source of truth
   * for price — see the price field's comment above. */
  variants: GameVariant[];
  /** FK into setup_guides. Null means no guide linked yet — the detail
   * page falls back to a generic pointer at the general redemption guide. */
  setupGuideId: string | null;
}

export interface PaymentMethod {
  id: string;
  label: string;
  accountTitle: string;
  accountNumber: string;
  /** Not every wallet issues one. */
  iban: string | null;
  /** RAAST ID for instant bank transfers; null where not applicable. */
  raastId: string | null;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
}

export type OrderStatus =
  | "awaiting_payment"
  | "payment_claimed"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export interface Order {
  id: string;
  /** Null for a guest order — see guestPhone. */
  userId: string | null;
  /** E.164 phone number for a guest order (no account, no session). Null
   * for a signed-in order, where the phone lives on the profile instead. */
  guestPhone: string | null;
  status: OrderStatus;
  paymentReference: string;
  amountExact: number;
  paymentMethodId: string;
  /** Set once the buyer marks the order as paid. */
  claimedAt: string | null;
  /** Set once an admin approves or rejects the claim. */
  reviewedAt: string | null;
  /** Only populated when status is 'rejected'. */
  rejectionReason: string | null;
  /** Deadline for the buyer to complete payment before the order expires. */
  reservedUntil: string;
  /** Set the moment the buyer confirms the required "credentials are
   * non-refundable once revealed" checkbox on the payment-instructions
   * step, just before markPaid — dispute evidence for the refund policy. */
  refundPolicyConsentedAt: string | null;
  /** Set in the same final update that stamps amount_exact, only when the
   * cart held at least one gift card — dispute evidence that the buyer
   * saw and accepted each gift card's platform/region before ordering.
   * Null for a games-only order. */
  regionAckConfirmedAt: string | null;
  createdAt: string;
}

export type OrderItemProductType = "game" | "gift_card";

export interface OrderItem {
  id: string;
  orderId: string;
  /** Null for a gift-card item — see productType. */
  gameId: string | null;
  /** Null for a game item — see productType. */
  giftCardCodeId: string | null;
  productType: OrderItemProductType;
  /** Price snapshot at purchase time, independent of the game's current price. */
  price: number;
}

export type ProfileRole = "customer" | "agent" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  /** Null until the user completes /complete-profile after first sign-in. */
  phoneNumber: string | null;
  phoneVerified: boolean;
  role: ProfileRole;
  createdAt: string;
  /** Set by deleteUser (admin-users.ts) for a soft-deleted account — one
   * with order/review/audit/news history, where a real DELETE would break
   * that history's attribution. Null for every normal, live account. */
  deletedAt: string | null;
}

/**
 * Game account credentials shown to the buyer once, after approval.
 * Display only — not a persisted view, just the shape rendered in the UI.
 */
export interface RevealedCredential {
  login: string;
  password: string;
  revealedAt: string;
}

/**
 * Aggregate credential-pool counts per game. Deliberately just counts —
 * the admin UI must never render actual credential values (see
 * /admin/credentials), so there's no reason for this shape to carry them.
 */
export interface GameCredentialStock {
  gameId: string;
  available: number;
  reserved: number;
  sold: number;
}

export type GameSort = "newest" | "price_asc" | "price_desc" | "name";

/** Query shape accepted by `getGames`. */
export interface GameFilters {
  genre?: GameGenre[];
  platform?: GamePlatform[];
  /** Case-insensitive match against title and description. */
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: GameSort;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  /** Defaults to true (only active games) when omitted. */
  isActive?: boolean;
  /** Defaults to 'game' when omitted — the catalog grid never shows
   * memberships, which have no genre and a different price shape. */
  productType?: ProductType;
}

// Matches the gift_card_products.platform check constraint in
// supabase/migrations/20260901000002_gift_cards.sql exactly — change one,
// change the other.
export const GIFT_CARD_PLATFORMS = ["psn", "xbox", "steam", "google_play", "apple"] as const;

export type GiftCardPlatform = (typeof GIFT_CARD_PLATFORMS)[number];

export const GIFT_CARD_PLATFORM_LABELS: Record<GiftCardPlatform, string> = {
  psn: "PlayStation Network",
  xbox: "Xbox",
  steam: "Steam",
  google_play: "Google Play",
  apple: "Apple",
};

// Matches the gift_card_products.region check constraint in
// supabase/migrations/20260901000002_gift_cards.sql exactly — change one,
// change the other.
export const GIFT_CARD_REGIONS = ["US", "UK", "EU", "TR", "PK", "GLOBAL"] as const;

export type GiftCardRegion = (typeof GIFT_CARD_REGIONS)[number];

export const GIFT_CARD_REGION_LABELS: Record<GiftCardRegion, string> = {
  US: "United States",
  UK: "United Kingdom",
  EU: "European Union",
  TR: "Turkey",
  PK: "Pakistan",
  GLOBAL: "Global",
};

/**
 * A gift card is a single redemption code, not a login pair — a separate
 * shape from Game/game_credentials, not a third ProductType value on
 * `games`. See supabase/migrations/20260901000002_gift_cards.sql.
 */
export interface GiftCardProduct {
  id: string;
  slug: string;
  title: string;
  platform: GiftCardPlatform;
  region: GiftCardRegion;
  denominationValue: number | null;
  denominationCurrency: string | null;
  pricePkr: number;
  /** Plain absolute URL, unlike Game.coverPath — gift cards have no
   * Supabase Storage-managed art pipeline (yet), just an optional direct
   * link. Null falls back to the placeholder, same as Game.coverImageUrl. */
  cardImageUrl: string | null;
  headerImageUrl: string | null;
  description: string;
  /** Rendered verbatim on the detail page — never through markdown/HTML
   * sanitization, unlike Guide/SetupGuide bodies. */
  redemptionInstructions: string;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export type GiftCardSort = "newest" | "price_asc" | "price_desc" | "name";

/** Query shape accepted by `getGiftCardProducts`. */
export interface GiftCardFilters {
  platform?: GiftCardPlatform[];
  region?: GiftCardRegion[];
  search?: string;
  sort?: GiftCardSort;
  /** Defaults to true (only active products) when omitted — mirrors
   * GameFilters.isActive. */
  isActive?: boolean;
}

export const GUIDE_CATEGORIES = [
  "getting-started",
  "payment",
  "account-setup",
  "troubleshooting",
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export interface Guide {
  id: string;
  slug: string;
  title: string;
  category: GuideCategory;
  excerpt: string;
  /** Markdown source — rendered through src/lib/markdown.ts, never
   * dangerouslySetInnerHTML'd directly. */
  body: string;
  isPublished: boolean;
  /** Ascending, per category — lower sorts first. */
  sortOrder: number;
  updatedAt: string;
}

export interface FaqItem {
  id: string;
  /** Stable, human-readable anchor — this, not `id`, is the DOM id the
   * public /faq page renders, so existing /faq#... deep links keep
   * working (supabase/migrations/20260920000001_faqs.sql). */
  slug: string;
  question: string;
  answer: string;
  /** Null for an uncategorised entry — /faq groups those into a trailing
   * "Other" section rather than dropping them. */
  category: GuideCategory | null;
  /** Ascending, per category — lower sorts first. */
  sortOrder: number;
  isPublished: boolean;
}

/**
 * Real, Supabase-backed platform/product-type activation instructions
 * (supabase/migrations/20260831000001_setup_guides.sql) — separate from
 * the mock `Guide`/`FaqItem` general-help content above. games.setup_guide_id
 * points here. No `excerpt`/`category` fields: cards derive a subtitle from
 * platform + productType instead (see GAME_PLATFORM_LABELS).
 */
export interface SetupGuide {
  id: string;
  slug: string;
  title: string;
  /** Markdown source — rendered through src/lib/markdown.ts, never
   * dangerouslySetInnerHTML'd directly. */
  body: string;
  /** Null for a guide that isn't specific to one platform (the membership
   * guide covers PlayStation and Xbox activation in one document). */
  platform: GamePlatform | null;
  productType: ProductType;
  /** Ascending, per productType — lower sorts first. */
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  /** Markdown source — rendered through src/lib/markdown.ts, never
   * dangerouslySetInnerHTML'd directly. */
  body: string;
  coverImageUrl: string | null;
  isPublished: boolean;
  /** Null until published — list/article pages only ever see published
   * posts (per RLS), so this is effectively always set where it matters. */
  publishedAt: string | null;
  authorId: string | null;
  createdAt: string;
}
