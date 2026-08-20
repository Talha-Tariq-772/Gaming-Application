import { useGamesByIds } from "@/src/lib/use-games-by-ids";
import { useCartStore, type CartItem } from "@/src/stores/cart-store";

export interface CartSummary {
  /** Items whose game currently exists and is active — this list, not
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
  const { games, loaded } = useGamesByIds(items.map((item) => item.gameId));

  const validItems: CartItem[] = [];
  const unavailableItems: CartItem[] = [];

  for (const item of items) {
    // Until real game data has loaded, trust the cart's own snapshot
    // rather than flashing every item as unavailable while the fetch is
    // in flight.
    const isValid = !loaded || games.some((g) => g.id === item.gameId && g.isActive);
    if (isValid) {
      validItems.push(item);
    } else {
      unavailableItems.push(item);
    }
  }

  const total = validItems.reduce((sum, item) => sum + item.price, 0);

  return { validItems, unavailableItems, hasUnavailableItem: unavailableItems.length > 0, total };
}
