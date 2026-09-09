import { beforeEach, describe, expect, it } from "vitest";
import { cartItemId, MAX_CART_SIZE, migrateCartStorage, useCartStore } from "@/src/stores/cart-store";
import type { Game, GiftCardProduct } from "@/src/types/database";

function makeGame(id: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    title: `Game ${id}`,
    slug: `game-${id}`,
    description: "",
    price: 1000,
    coverImageUrl: "https://placehold.co/1x1.png",
    trailerUrl: "",
    genre: "Action",
    platform: "ps5",
    setupGuide: "",
    isActive: true,
    createdAt: new Date().toISOString(),
    productType: "game",
    releaseDate: null,
    isNewArrival: false,
    isBestSeller: false,
    variantMode: "single",
    coverPath: null,
    wallpaperPath: null,
    sliderPosition: null,
    setupGuideId: null,
    variants: [],
    ...overrides,
  };
}

function makeGiftCardProduct(id: string, overrides: Partial<GiftCardProduct> = {}): GiftCardProduct {
  return {
    id,
    slug: `gift-card-${id}`,
    title: `Gift Card ${id}`,
    platform: "psn",
    region: "US",
    denominationValue: 10,
    denominationCurrency: "USD",
    pricePkr: 3500,
    cardImageUrl: null,
    headerImageUrl: null,
    description: "",
    redemptionInstructions: "",
    isActive: true,
    sortOrder: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [], ownerId: null });
});

describe("cart-store integrity", () => {
  it("rejects duplicate game ids", () => {
    const game = makeGame("g1");
    useCartStore.getState().addItem(game);
    useCartStore.getState().addItem(game);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("caps cart size at MAX_CART_SIZE", () => {
    for (let i = 0; i < MAX_CART_SIZE + 5; i++) {
      useCartStore.getState().addItem(makeGame(`g${i}`));
    }
    expect(useCartStore.getState().items).toHaveLength(MAX_CART_SIZE);
  });

  it("removeItem drops exactly the targeted item", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().addItem(makeGame("g2"));
    useCartStore.getState().removeItem("g1");
    const ids = useCartStore.getState().items.map((i) => cartItemId(i));
    expect(ids).toEqual(["g2"]);
  });

  it("pruneItems drops only the listed ids", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().addItem(makeGame("g2"));
    useCartStore.getState().addItem(makeGame("g3"));
    useCartStore.getState().pruneItems(["g1", "g3"]);
    const ids = useCartStore.getState().items.map((i) => cartItemId(i));
    expect(ids).toEqual(["g2"]);
  });

  it("clearCart empties the cart", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("has no persisted totalAmount field to trust — callers must recompute", () => {
    useCartStore.getState().addItem(makeGame("g1", { price: 999 }));
    expect(useCartStore.getState()).not.toHaveProperty("totalAmount");
  });
});

describe("cart-store gift card items", () => {
  it("adds a gift card item, snapshotting platform/region/denomination", () => {
    const product = makeGiftCardProduct("p1");
    useCartStore.getState().addGiftCardItem(product);
    const [item] = useCartStore.getState().items;
    expect(item).toMatchObject({
      kind: "gift_card",
      productId: "p1",
      platform: "psn",
      region: "US",
      denominationValue: 10,
      denominationCurrency: "USD",
      price: 3500,
    });
  });

  it("rejects duplicate gift card products", () => {
    const product = makeGiftCardProduct("p1");
    useCartStore.getState().addGiftCardItem(product);
    useCartStore.getState().addGiftCardItem(product);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("caps cart size at MAX_CART_SIZE across mixed game and gift-card items", () => {
    for (let i = 0; i < MAX_CART_SIZE; i++) {
      useCartStore.getState().addGiftCardItem(makeGiftCardProduct(`p${i}`));
    }
    useCartStore.getState().addItem(makeGame("overflow"));
    expect(useCartStore.getState().items).toHaveLength(MAX_CART_SIZE);
  });

  it("removeItem/pruneItems key off productId for a gift-card item, not gameId", () => {
    useCartStore.getState().addGiftCardItem(makeGiftCardProduct("p1"));
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().removeItem("p1");
    const ids = useCartStore.getState().items.map((i) => cartItemId(i));
    expect(ids).toEqual(["g1"]);
  });
});

describe("cart-store persisted-state migration", () => {
  it("backfills kind:\"credential\" onto a stale v0 cart with no kind field", () => {
    const staleV0State = {
      items: [
        { gameId: "g1", slug: "game-g1", title: "Game g1", price: 1000, coverImageUrl: "https://x/1.png" },
        { gameId: "g2", slug: "game-g2", title: "Game g2", price: 2000, coverImageUrl: "https://x/2.png" },
      ],
    };

    const migrated = migrateCartStorage(staleV0State);

    expect(migrated.items).toHaveLength(2);
    for (const item of migrated.items) {
      expect(item.kind).toBe("credential");
    }
    expect(migrated.items[0]).toMatchObject({ kind: "credential", gameId: "g1" });
    // v0 predates ownerId entirely — backfilled as a guest cart, not dropped.
    expect(migrated.ownerId).toBeNull();
  });

  it("is a no-op for state that already carries kind", () => {
    const v1State = {
      items: [
        { kind: "gift_card", productId: "p1", slug: "s", title: "t", price: 1, coverImageUrl: "https://x/1.png", platform: "psn", region: "US", denominationValue: null, denominationCurrency: null },
      ],
    };
    const migrated = migrateCartStorage(v1State);
    expect(migrated.items[0]).toMatchObject({ kind: "gift_card", productId: "p1" });
    // v1 predates ownerId too — same guest-cart backfill as v0.
    expect(migrated.ownerId).toBeNull();
  });

  it("degrades to an empty guest cart rather than throwing on unrecognisable persisted state", () => {
    expect(migrateCartStorage(null)).toEqual({ items: [], ownerId: null });
    expect(migrateCartStorage({})).toEqual({ items: [], ownerId: null });
    expect(migrateCartStorage({ items: "not-an-array" })).toEqual({ items: [], ownerId: null });
  });

  it("carries an already-tagged ownerId through untouched", () => {
    const v2State = { items: [], ownerId: "user-1" };
    expect(migrateCartStorage(v2State).ownerId).toBe("user-1");
  });
});

describe("cart-store owner tagging (cross-account leak prevention)", () => {
  it("claimForUser tags an untagged (guest) cart without touching its items", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().claimForUser("user-a");
    expect(useCartStore.getState().ownerId).toBe("user-a");
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("claimForUser is a no-op when the cart already belongs to this same user", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().claimForUser("user-a");
    useCartStore.getState().claimForUser("user-a");
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("claimForUser clears the cart when it belongs to a DIFFERENT user", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().claimForUser("user-a");
    useCartStore.getState().claimForUser("user-b");
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().ownerId).toBe("user-b");
  });

  it("clearOnSignOut wipes items and ownership unconditionally", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().claimForUser("user-a");
    useCartStore.getState().clearOnSignOut();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().ownerId).toBeNull();
  });

  it("clearOnSignOut also wipes a cart that was never claimed (guest cart present at sign-out)", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().clearOnSignOut();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("a guest cart survives being claimed then signed out and back in as the same user", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().claimForUser("user-a"); // guest -> claimed
    useCartStore.getState().claimForUser("user-a"); // same user again, e.g. token refresh
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
