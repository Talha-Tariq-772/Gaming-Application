import { useGamesByIds } from "@/src/lib/use-games-by-ids";
import { useGiftCardsByIds } from "@/src/lib/use-gift-cards-by-ids";
import { useHardwareByIds } from "@/src/lib/use-hardware-by-ids";
import { useCartStore, type CartItem } from "@/src/stores/cart-store";

export interface CartSummary {
  /** Items whose product currently exists and is active — this list, not
   * the raw persisted cart, is what checkout actually charges. */
  validItems: CartItem[];
  /** Items still physically in the cart but currently unpurchasable.
   * Shown (grayed out) rather than silently dropped mid-session — a game
   * going inactive while it's already sitting in an open cart shouldn't
   * make it vanish without the buyer seeing why. Actual removal of
   * already-invalid items happens once, at load time — see
   * CartIntegrityGuard. */
  unavailableItems: CartItem[];
  hasUnavailableItem: boolean;
  /** Sum of validItems' prices. Recomputed fresh on every call from the
   * current cart + current game data — cart-store has no persisted total
   * field for this to drift out of sync with. */
  total: number;
}

/**
 * The single source of truth for "what's actually in the cart and what
 * will it cost" — every place that previously read cart-store's
 * totalAmount field (now removed) should read this instead.
 */
export function useCartSummary(): CartSummary {
  const items = useCartStore((s) => s.items);
  const gameIds = items.filter((i) => i.kind === "credential").map((i) => i.gameId);
  const productIds = items.filter((i) => i.kind === "gift_card").map((i) => i.productId);
  const hardwareIds = items.filter((i) => i.kind === "hardware").map((i) => i.productId);
  const { games, loaded: gamesLoaded } = useGamesByIds(gameIds);
  const { products, loaded: productsLoaded } = useGiftCardsByIds(productIds);
  const { hardware, loaded: hardwareLoaded } = useHardwareByIds(hardwareIds);
  // Both fetches only ever run for the ids actually present in the
  // cart — an empty id list resolves `loaded` true immediately (see
  // useGamesByIds/useGiftCardsByIds's EMPTY_LOADED), so a cart with only
  // one kind of item never waits on the other kind's request.
  const loaded = gamesLoaded && productsLoaded && hardwareLoaded;

  const validItems: CartItem[] = [];
  const unavailableItems: CartItem[] = [];

  for (const item of items) {
    // Until real product data has loaded, trust the cart's own snapshot
    // rather than flashing every item as unavailable while the fetch is
    // in flight.
    // A hardware product additionally has to still be IN STOCK to be
    // purchasable, which neither digital kind needs here: their stock is
    // checked per-unit at reservation time, while hardware's counter can
    // reach zero between adding to the cart and checking out.
    const isValid =
      !loaded ||
      (item.kind === "hardware"
        ? hardware.some((h) => h.id === item.productId && h.isActive && h.stockQuantity > 0)
        : item.kind === "gift_card"
          ? products.some((p) => p.id === item.productId && p.isActive)
          : games.some((g) => g.id === item.gameId && g.isActive));
    if (isValid) {
      validItems.push(item);
    } else {
      unavailableItems.push(item);
    }
  }

  const total = validItems.reduce((sum, item) => sum + item.price, 0);

  return { validItems, unavailableItems, hasUnavailableItem: unavailableItems.length > 0, total };
}
