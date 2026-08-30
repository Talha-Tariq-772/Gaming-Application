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
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export const GAME_PLATFORMS = [
  "PC",
  "PlayStation 5",
  "Xbox Series X",
  "Xbox One",
  "Nintendo Switch",
] as const;

export type GamePlatform = (typeof GAME_PLATFORMS)[number];

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
  userId: string;
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
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  gameId: string;
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
  question: string;
  answer: string;
  category: GuideCategory;
  /** Ascending, per category — lower sorts first. */
  sortOrder: number;
  isPublished: boolean;
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
