"use client";

import Button from "@/components/Button";
import { track } from "@/src/lib/analytics";
import { useCartStore } from "@/src/stores/cart-store";
import type { Game } from "@/src/types/database";

export default function AddToCartButton({ game }: { game: Game }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <Button
      type="button"
      variant="primary"
      className="w-fit"
      onClick={() => {
        addItem(game);
        track("add_to_cart", { gameId: game.id, price: game.price });
      }}
    >
      Add to Cart
    </Button>
  );
}
