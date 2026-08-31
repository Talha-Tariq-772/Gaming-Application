"use client";

import NovaButton from "@/src/components/ui/nova/NovaButton";
import { track } from "@/src/lib/analytics";
import { useCartStore } from "@/src/stores/cart-store";
import type { Game, GameVariant } from "@/src/types/database";

/**
 * `variant` drives the price actually added to the cart — for a 'multi'
 * game, `game.price` (the legacy column, see Game.price's comment in
 * types/database.ts) is not necessarily the one the shopper picked.
 * cart-store's CartItem has no variant concept of its own; passing a
 * shallow-cloned Game with `price` overridden is enough for it to snapshot
 * the right number without any change to cart-store or checkout.
 */
export default function AddToCartButton({
  game,
  variant,
}: {
  game: Game;
  variant: GameVariant;
}) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <NovaButton
      type="button"
      variant="primary"
      className="w-fit"
      onClick={() => {
        addItem({ ...game, price: variant.pricePkr });
        track("add_to_cart", { gameId: game.id, price: variant.pricePkr });
      }}
    >
      Add to Cart
    </NovaButton>
  );
}
