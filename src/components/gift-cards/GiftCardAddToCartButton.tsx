"use client";

import NovaButton from "@/src/components/ui/nova/NovaButton";
import { track } from "@/src/lib/analytics";
import { useCartStore } from "@/src/stores/cart-store";
import type { GiftCardProduct } from "@/src/types/database";

export default function GiftCardAddToCartButton({
  product,
  disabled = false,
  className = "w-fit",
}: {
  product: GiftCardProduct;
  disabled?: boolean;
  className?: string;
}) {
  const addGiftCardItem = useCartStore((s) => s.addGiftCardItem);

  return (
    <NovaButton
      type="button"
      variant="primary"
      disabled={disabled}
      className={className}
      onClick={() => {
        addGiftCardItem(product);
        track("add_to_cart", { gameId: product.id, price: product.pricePkr });
      }}
    >
      Add to Cart
    </NovaButton>
  );
}
