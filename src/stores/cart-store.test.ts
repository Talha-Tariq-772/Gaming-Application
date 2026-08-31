import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CART_SIZE, useCartStore } from "@/src/stores/cart-store";
import type { Game } from "@/src/types/database";

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

beforeEach(() => {
  useCartStore.setState({ items: [] });
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
    const ids = useCartStore.getState().items.map((i) => i.gameId);
    expect(ids).toEqual(["g2"]);
  });

  it("pruneItems drops only the listed ids", () => {
    useCartStore.getState().addItem(makeGame("g1"));
    useCartStore.getState().addItem(makeGame("g2"));
    useCartStore.getState().addItem(makeGame("g3"));
    useCartStore.getState().pruneItems(["g1", "g3"]);
    const ids = useCartStore.getState().items.map((i) => i.gameId);
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
