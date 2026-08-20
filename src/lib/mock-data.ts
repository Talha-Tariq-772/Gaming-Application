import { safeAsync } from "@/src/lib/safe-async";
import type {
  Game,
  GameCredentialStock,
  GamePlatform,
  Order,
  OrderItem,
  PaymentMethod,
  Profile,
} from "@/src/types/database";

/**
 * Mock data layer.
 *
 * Every export below simulates the eventual Postgres-backed API: async
 * functions with a small artificial delay, so loading states get built
 * against real async boundaries from day one instead of being retrofitted
 * once a real backend shows up.
 */

const NETWORK_DELAY_MS = 400;

function delay<T>(value: T, ms: number = NETWORK_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function placeholderCover(title: string): string {
  // .png forces a raster response — Next's image optimizer blocks SVG by
  // default, which is what placehold.co returns without an explicit format.
  return `https://placehold.co/600x800/1c1c21/f5f5f7.png?text=${encodeURIComponent(title)}`;
}

function setupGuideFor(platform: GamePlatform): string {
  switch (platform) {
    case "PC":
      return "Redeem your key on Steam via Library → Activate a Product on Steam, then download and install.";
    case "PlayStation 5":
      return "On your PS5, go to PlayStation Store → Redeem Codes, enter your code, then install from Your Library.";
    case "Xbox Series X":
    case "Xbox One":
      return "Go to the Microsoft Store → Redeem, enter your code, then install from My Library.";
    case "Nintendo Switch":
      return "Open the Nintendo eShop → Enter Code, redeem your code, then download from My Downloads.";
  }
}

/* ---------------------------------------------------------------------- */
/* Games                                                                   */
/* ---------------------------------------------------------------------- */

export const MOCK_GAMES: Game[] = [
  {
    id: "game-1",
    title: "Crimson Horizon: The Complete Definitive Ultimate Edition — Remastered for Next-Generation Hardware",
    slug: "crimson-horizon",
    description:
      "A gritty open-world action game set in a sprawling, rain-soaked megacity torn apart by seven rival factions, each with their own agenda, territory, and reasons to distrust you. Fight through crumbling industrial districts and neon-drenched market streets, scavenge for parts to keep your gear running, and choose your allies carefully — every conversation, every favor owed, and every enemy spared or eliminated ripples forward into how the city's power structure looks by the time the credits roll.",
    price: 2499,
    coverImageUrl: placeholderCover("Crimson Horizon"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-crimson-horizon",
    genre: "Action",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-01-08T09:15:00.000Z",
  },
  {
    id: "game-2",
    title: "Silent Orbit",
    slug: "silent-orbit",
    description:
      "A slow-burn sci-fi adventure aboard a derelict station. Explore, solve environmental puzzles, and piece together what happened to the crew.",
    price: 3499,
    coverImageUrl: placeholderCover("Silent Orbit"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-silent-orbit",
    genre: "Adventure",
    platform: "PlayStation 5",
    setupGuide: setupGuideFor("PlayStation 5"),
    isActive: true,
    createdAt: "2026-01-15T11:30:00.000Z",
  },
  {
    id: "game-3",
    title: "Ashfall Legends",
    slug: "ashfall-legends",
    description:
      "A sprawling fantasy RPG with a deep class system, branching quests, and a world that reacts to every major choice you make.",
    price: 4499,
    coverImageUrl: placeholderCover("Ashfall Legends"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-ashfall-legends",
    genre: "RPG",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-01-22T14:00:00.000Z",
  },
  {
    id: "game-4",
    title: "Turbo Rivals",
    slug: "turbo-rivals",
    description:
      "Arcade racing with an emphasis on drift chains, rubber-banding rivals, and a career mode built around trash-talking your friends.",
    price: 1999,
    coverImageUrl: placeholderCover("Turbo Rivals"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-turbo-rivals",
    genre: "Racing",
    platform: "Xbox Series X",
    setupGuide: setupGuideFor("Xbox Series X"),
    isActive: true,
    createdAt: "2026-02-02T08:45:00.000Z",
  },
  {
    id: "game-5",
    title: "Nightfall Protocol",
    slug: "nightfall-protocol",
    description:
      "A tactical first-person shooter built around asymmetric squads, destructible cover, and a ranked ladder that actually means something.",
    price: 2999,
    coverImageUrl: placeholderCover("Nightfall Protocol"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-nightfall-protocol",
    genre: "Shooter",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-02-10T16:20:00.000Z",
  },
  {
    id: "game-6",
    title: "Kingdoms of Veyra",
    slug: "kingdoms-of-veyra",
    description:
      "A grand strategy game spanning centuries. Build a dynasty, manage court intrigue, and wage war across a continent of rival kingdoms.",
    price: 3999,
    coverImageUrl: placeholderCover("Kingdoms of Veyra"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-kingdoms-of-veyra",
    genre: "Strategy",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-02-18T10:00:00.000Z",
  },
  {
    id: "game-7",
    title: "Pixel Kart Championship",
    slug: "pixel-kart-championship",
    description:
      "Colorful kart racing with couch multiplayer, chaotic power-ups, and tracks that fold back on themselves in increasingly unfair ways.",
    price: 999,
    coverImageUrl: placeholderCover("Pixel Kart Championship"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-pixel-kart-championship",
    genre: "Racing",
    platform: "Nintendo Switch",
    setupGuide: setupGuideFor("Nintendo Switch"),
    isActive: true,
    createdAt: "2026-03-01T09:00:00.000Z",
  },
  {
    id: "game-8",
    title: "Shadow Circuit",
    slug: "shadow-circuit",
    description:
      "A minimalist puzzle game about rerouting light through an ever-darkening grid. Easy to learn, brutal by the final chapters.",
    price: 599,
    coverImageUrl: placeholderCover("Shadow Circuit"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-shadow-circuit",
    genre: "Puzzle",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-03-05T13:40:00.000Z",
  },
  {
    id: "game-9",
    title: "Iron Frontier",
    slug: "iron-frontier",
    description:
      "A factory-building simulation about taming a hostile planet, one conveyor belt at a time. Deep systems, no hand-holding.",
    price: 2199,
    coverImageUrl: placeholderCover("Iron Frontier"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-iron-frontier",
    genre: "Simulation",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-03-12T17:10:00.000Z",
  },
  {
    id: "game-10",
    title: "Whispering Hollow",
    slug: "whispering-hollow",
    description:
      "A slow-burn horror game set in a fog-locked town where the streetlights turn off one at a time. Best played alone, at night.",
    price: 2799,
    coverImageUrl: placeholderCover("Whispering Hollow"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-whispering-hollow",
    genre: "Horror",
    platform: "PlayStation 5",
    setupGuide: setupGuideFor("PlayStation 5"),
    isActive: true,
    createdAt: "2026-03-20T20:00:00.000Z",
  },
  {
    id: "game-11",
    title: "Skybound Tactics",
    slug: "skybound-tactics",
    description:
      "Turn-based tactics on floating islands, where terrain destruction changes the map mid-battle. Delisted while a balance pass is finished.",
    price: 1499,
    coverImageUrl: placeholderCover("Skybound Tactics"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-skybound-tactics",
    genre: "Strategy",
    platform: "Xbox One",
    setupGuide: setupGuideFor("Xbox One"),
    isActive: false,
    createdAt: "2026-03-28T12:00:00.000Z",
  },
  {
    id: "game-12",
    title: "Velocity Drift",
    slug: "velocity-drift",
    description:
      "A physics-driven street racer built entirely around drift scoring. No weapons, no gimmicks — just tires, angles, and nerve.",
    price: 1799,
    coverImageUrl: placeholderCover("Velocity Drift"),
    trailerUrl: "https://www.youtube.com/watch?v=demo-velocity-drift",
    genre: "Racing",
    platform: "PC",
    setupGuide: setupGuideFor("PC"),
    isActive: true,
    createdAt: "2026-04-02T15:30:00.000Z",
  },
];

/** Slider bounds for the price filter, rounded out to the nearest Rs 100. */
export const PRICE_BOUNDS = {
  min: Math.floor(Math.min(...MOCK_GAMES.map((g) => g.price)) / 100) * 100,
  max: Math.ceil(Math.max(...MOCK_GAMES.map((g) => g.price)) / 100) * 100,
};

/* ---------------------------------------------------------------------- */
/* Payment methods                                                         */
/* ---------------------------------------------------------------------- */

export const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm-bank-transfer",
    label: "Bank Transfer",
    accountTitle: "Nova Games (Pvt) Ltd",
    accountNumber: "01234567890123",
    iban: "PK36SCBL0000001123456702",
    raastId: null,
    instructions:
      "Transfer the exact amount to the account below via online banking or ATM. Use your payment reference as the transaction narration.",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "pm-jazzcash",
    label: "JazzCash",
    accountTitle: "Nova Games",
    accountNumber: "03001234567",
    iban: null,
    raastId: "03001234567",
    instructions:
      "Send the exact amount via JazzCash Mobile Account to the number below. Include your payment reference in the transaction note if the app allows it.",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "pm-easypaisa",
    label: "Easypaisa",
    accountTitle: "Nova Games",
    accountNumber: "03111234567",
    iban: null,
    raastId: "03111234567",
    instructions:
      "Send the exact amount via Easypaisa to the account below, then claim your payment.",
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "pm-sadapay",
    label: "SadaPay",
    accountTitle: "Nova Games",
    accountNumber: "03211234567",
    iban: "PK65SADA0000001123456789",
    raastId: "03211234567",
    instructions:
      "Transfer the exact amount via the SadaPay app using the IBAN or account number below.",
    isActive: true,
    sortOrder: 4,
  },
  {
    id: "pm-nayapay",
    label: "NayaPay",
    accountTitle: "Nova Games",
    accountNumber: "03451234567",
    iban: "PK12NAYA0000001123456780",
    raastId: "03451234567",
    instructions:
      "Send the exact amount via NayaPay using the IBAN below, or transfer directly within the app.",
    isActive: true,
    sortOrder: 5,
  },
];

/* ---------------------------------------------------------------------- */
/* Profiles                                                                 */
/* ---------------------------------------------------------------------- */

/** Selectable identities for the dev-only mock auth toggle on /account. */
export const MOCK_PROFILES: Profile[] = [
  {
    id: "usr_ayesha01",
    email: "ayesha.raza@example.com",
    fullName: "Ayesha Raza",
    phoneNumber: "+92 300 1112222",
    phoneVerified: true,
    role: "customer",
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "usr_bilal02",
    email: "bilal.ahmed@example.com",
    fullName: "Bilal Ahmed",
    phoneNumber: "+92 301 2223333",
    phoneVerified: true,
    role: "customer",
    createdAt: "2026-01-12T14:30:00.000Z",
  },
  {
    id: "usr_hassan03",
    email: "hassan.iqbal@example.com",
    fullName: "Hassan Iqbal",
    phoneNumber: "+92 302 3334444",
    phoneVerified: false,
    role: "customer",
    createdAt: "2026-02-01T11:15:00.000Z",
  },
];

/* ---------------------------------------------------------------------- */
/* Orders                                                                   */
/* ---------------------------------------------------------------------- */

export const MOCK_ORDER_ITEMS: OrderItem[] = [
  { id: "item-1", orderId: "order-1", gameId: "game-1", price: 2499 },
  { id: "item-2", orderId: "order-2", gameId: "game-3", price: 4499 },
  { id: "item-3", orderId: "order-2", gameId: "game-8", price: 599 },
  { id: "item-4", orderId: "order-3", gameId: "game-4", price: 1999 },
  { id: "item-5", orderId: "order-4", gameId: "game-2", price: 3499 },
  { id: "item-6", orderId: "order-5", gameId: "game-6", price: 3999 },
  { id: "item-7", orderId: "order-6", gameId: "game-7", price: 999 },
];

// One seeded order per status, so every StatusBadge variant has a real
// example to render against on /account.
export const MOCK_ORDERS: Order[] = [
  {
    id: "order-1",
    userId: "usr_ayesha01",
    status: "awaiting_payment",
    paymentReference: "GK-8F4C",
    // Sum of its items (2499) plus a small unique offset for reconciliation.
    amountExact: 2501,
    paymentMethodId: "pm-jazzcash",
    claimedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: "2026-04-10T09:45:00.000Z",
    refundPolicyConsentedAt: null,
    createdAt: "2026-04-10T09:15:00.000Z",
  },
  {
    id: "order-2",
    userId: "usr_bilal02",
    status: "under_review",
    paymentReference: "GK-3B9E",
    // Sum of its items (4499 + 599 = 5098) plus a small unique offset.
    amountExact: 5105,
    paymentMethodId: "pm-bank-transfer",
    claimedAt: "2026-04-09T12:40:00.000Z",
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: "2026-04-09T12:15:00.000Z",
    refundPolicyConsentedAt: "2026-04-09T12:40:00.000Z",
    createdAt: "2026-04-09T11:45:00.000Z",
  },
  {
    id: "order-3",
    userId: "usr_hassan03",
    status: "approved",
    paymentReference: "GK-A2D5",
    // Sum of its items (1999) plus a small unique offset.
    amountExact: 2002,
    paymentMethodId: "pm-easypaisa",
    claimedAt: "2026-04-07T18:05:00.000Z",
    reviewedAt: "2026-04-07T19:30:00.000Z",
    rejectionReason: null,
    reservedUntil: "2026-04-07T17:50:00.000Z",
    refundPolicyConsentedAt: "2026-04-07T18:05:00.000Z",
    createdAt: "2026-04-07T17:20:00.000Z",
  },
  {
    id: "order-4",
    userId: "usr_ayesha01",
    status: "payment_claimed",
    paymentReference: "GK-71FA",
    // Sum of its items (3499) plus a small unique offset.
    amountExact: 3524,
    paymentMethodId: "pm-sadapay",
    claimedAt: "2026-04-11T10:05:00.000Z",
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: "2026-04-11T09:50:00.000Z",
    refundPolicyConsentedAt: "2026-04-11T10:05:00.000Z",
    createdAt: "2026-04-11T09:20:00.000Z",
  },
  {
    id: "order-5",
    userId: "usr_bilal02",
    status: "rejected",
    paymentReference: "GK-C3B8",
    // Sum of its items (3999) plus a small unique offset.
    amountExact: 4033,
    paymentMethodId: "pm-nayapay",
    claimedAt: "2026-04-05T15:10:00.000Z",
    reviewedAt: "2026-04-05T17:45:00.000Z",
    rejectionReason:
      "The transferred amount didn't match the exact reconciliation amount — please retry with the amount shown at checkout.",
    reservedUntil: "2026-04-05T14:55:00.000Z",
    refundPolicyConsentedAt: "2026-04-05T15:10:00.000Z",
    createdAt: "2026-04-05T14:25:00.000Z",
  },
  {
    id: "order-6",
    userId: "usr_hassan03",
    status: "expired",
    paymentReference: "GK-56E1",
    // Sum of its items (999) plus a small unique offset.
    amountExact: 1012,
    paymentMethodId: "pm-jazzcash",
    claimedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: "2026-04-03T09:30:00.000Z",
    refundPolicyConsentedAt: null,
    createdAt: "2026-04-03T08:45:00.000Z",
  },
];

/* ---------------------------------------------------------------------- */
/* Recent synthetic orders — admin dashboard/charts need real spread       */
/* ---------------------------------------------------------------------- */

/**
 * order-1..order-6 above are fixed to specific April 2026 dates (useful as
 * stable, hand-checkable fixtures for the customer-facing account screens).
 * The admin dashboard needs something else: a pending queue with orders of
 * varying age *as of today*, and 30 days of revenue history for the charts.
 * Both are generated relative to real time so the demo never goes stale.
 */

function daysAgoIso(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hoursAgoIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

/** Deterministic 4-hex-char code from an integer — varied, reproducible. */
function referenceFromSeed(seed: number): string {
  const hashed = (Math.imul(seed + 1, 2654435761) >>> 0).toString(16);
  return `GK-${hashed.toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

const DEMO_USER_IDS = MOCK_PROFILES.map((p) => p.id);
const DEMO_METHOD_IDS = MOCK_PAYMENT_METHODS.map((m) => m.id);

// Repeats each gameId proportional to how often it should "sell" in the
// generated history, so the top-selling chart has real variation.
const WEIGHTED_GAME_IDS = [
  "game-1", "game-1", "game-1", "game-1", "game-1",
  "game-3", "game-3", "game-3", "game-3",
  "game-4", "game-4", "game-4", "game-4",
  "game-6", "game-6", "game-6",
  "game-8", "game-8", "game-8",
  "game-2", "game-2",
  "game-12", "game-12",
  "game-9",
];

function buildRecentOrders(): { orders: Order[]; items: OrderItem[] } {
  const orders: Order[] = [];
  const items: OrderItem[] = [];
  let seed = 0;

  function pushOrder(config: {
    idSuffix: string;
    gameId: string;
    status: Order["status"];
    createdAt: string;
    claimedAt: string | null;
    reviewedAt: string | null;
    rejectionReason?: string | null;
  }) {
    seed += 1;
    const game = MOCK_GAMES.find((g) => g.id === config.gameId);
    if (!game) return;

    const orderId = `recent-order-${config.idSuffix}`;
    const userId = DEMO_USER_IDS[seed % DEMO_USER_IDS.length];
    const paymentMethodId = DEMO_METHOD_IDS[seed % DEMO_METHOD_IDS.length];
    const offset = (seed * 13) % 99 || 1;
    const createdAtMs = new Date(config.createdAt).getTime();

    orders.push({
      id: orderId,
      userId,
      status: config.status,
      paymentReference: referenceFromSeed(seed),
      amountExact: game.price + offset,
      paymentMethodId,
      claimedAt: config.claimedAt,
      reviewedAt: config.reviewedAt,
      rejectionReason: config.rejectionReason ?? null,
      reservedUntil: new Date(createdAtMs + 45 * 60 * 1000).toISOString(),
      // Real flow records this the moment claimedAt is set (the consent
      // checkbox gates the same button that triggers markPaid).
      refundPolicyConsentedAt: config.claimedAt,
      createdAt: config.createdAt,
    });

    items.push({
      id: `recent-item-${config.idSuffix}`,
      orderId,
      gameId: game.id,
      price: game.price,
    });
  }

  // Pending verification queue: a handful of orders at different ages, so
  // "oldest first" sorting on /admin/orders has something real to show.
  [
    { daysAgo: 4, hour: 9 },
    { daysAgo: 3, hour: 14 },
    { daysAgo: 2, hour: 11 },
    { daysAgo: 1, hour: 16 },
  ].forEach((config, i) => {
    const createdAt = daysAgoIso(config.daysAgo, config.hour, 0);
    pushOrder({
      idSuffix: `review-${i}`,
      gameId: WEIGHTED_GAME_IDS[i % WEIGHTED_GAME_IDS.length],
      status: "under_review",
      createdAt,
      claimedAt: daysAgoIso(config.daysAgo, config.hour + 1, 15),
      reviewedAt: null,
    });
  });

  [{ daysAgo: 1, hour: 8 }, { daysAgo: 0, hour: 7 }].forEach((config, i) => {
    const createdAt = daysAgoIso(config.daysAgo, config.hour, 0);
    pushOrder({
      idSuffix: `claimed-${i}`,
      gameId: WEIGHTED_GAME_IDS[(i + 4) % WEIGHTED_GAME_IDS.length],
      status: "payment_claimed",
      createdAt,
      claimedAt: daysAgoIso(config.daysAgo, config.hour + 1, 0),
      reviewedAt: null,
    });
  });

  [3, 8].forEach((hoursAgo, i) => {
    pushOrder({
      idSuffix: `awaiting-${i}`,
      gameId: WEIGHTED_GAME_IDS[(i + 6) % WEIGHTED_GAME_IDS.length],
      status: "awaiting_payment",
      createdAt: hoursAgoIso(hoursAgo),
      claimedAt: null,
      reviewedAt: null,
    });
  });

  // Revenue history: one approved order roughly every 1-2 days over the
  // last 30 days, cycling through the weighted game list.
  const revenueDays = [
    29, 27, 26, 24, 22, 21, 19, 18, 16, 15, 14, 12, 11, 9, 8, 6, 5,
  ];
  revenueDays.forEach((daysAgo, i) => {
    const createdAt = daysAgoIso(daysAgo, 10, 0);
    pushOrder({
      idSuffix: `approved-${i}`,
      gameId: WEIGHTED_GAME_IDS[i % WEIGHTED_GAME_IDS.length],
      status: "approved",
      createdAt,
      claimedAt: daysAgoIso(daysAgo, 11, 30),
      reviewedAt: daysAgoIso(daysAgo, 13, 0),
    });
  });

  return { orders, items };
}

const RECENT_ORDERS = buildRecentOrders();
MOCK_ORDERS.push(...RECENT_ORDERS.orders);
MOCK_ORDER_ITEMS.push(...RECENT_ORDERS.items);

/* ---------------------------------------------------------------------- */
/* Credential stock                                                        */
/* ---------------------------------------------------------------------- */

/**
 * Aggregate pool counts only — never actual login/password values (those
 * are generated on demand in the buyer-facing reveal flow, see
 * src/lib/credentials.ts, and never appear in the admin UI at all).
 */
export const MOCK_CREDENTIAL_STOCK: GameCredentialStock[] = [
  { gameId: "game-1", available: 8, reserved: 2, sold: 21 },
  { gameId: "game-2", available: 20, reserved: 1, sold: 6 },
  { gameId: "game-3", available: 3, reserved: 1, sold: 13 },
  { gameId: "game-4", available: 12, reserved: 3, sold: 15 },
  { gameId: "game-5", available: 25, reserved: 0, sold: 4 },
  { gameId: "game-6", available: 2, reserved: 0, sold: 11 },
  { gameId: "game-7", available: 30, reserved: 2, sold: 3 },
  { gameId: "game-8", available: 15, reserved: 1, sold: 12 },
  { gameId: "game-9", available: 18, reserved: 0, sold: 3 },
  { gameId: "game-10", available: 0, reserved: 0, sold: 5 },
  { gameId: "game-11", available: 5, reserved: 0, sold: 1 },
  { gameId: "game-12", available: 22, reserved: 2, sold: 7 },
];

export const LOW_STOCK_THRESHOLD = 5;

/* ---------------------------------------------------------------------- */
/* Data-layer functions                                                     */
/*                                                                          */
/* getGames/getGameBySlug/getPaymentMethods moved to src/lib/catalog.ts —   */
/* they now hit the live database and need the session client, which       */
/* needs next/headers. That can't live in this file: mock-data.ts's        */
/* MOCK_* constants are imported directly by client components (e.g.       */
/* app/admin/page.tsx), and bundling next/headers into a client component   */
/* breaks the build. This file stays plain data/mock-only so it's safe to   */
/* import from anywhere.                                                    */
/* ---------------------------------------------------------------------- */

/** @deprecated Dead code — zero call sites in the app (use-all-orders.ts reads MOCK_ORDERS directly). Left as-is; out of scope for this pass. */
export async function getOrders(): Promise<Order[]> {
  return safeAsync("orders", async () => delay(MOCK_ORDERS));
}
