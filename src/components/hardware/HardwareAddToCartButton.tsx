"use client";

import NovaButton from "@/src/components/ui/nova/NovaButton";
import { track } from "@/src/lib/analytics";
import { useCartStore } from "@/src/stores/cart-store";
import type { HardwareProduct } from "@/src/types/database";

/**
 * Mirrors GiftCardAddToCartButton, plus a stock-aware label.
 *
 * The label carries the disabled reason on purpose: an "Add to Cart"
 * button greyed out with no explanation reads as a broken page, and
 * hardware is the one product family that can legitimately be listed,
 * active and unbuyable at the same time (its stock is a counter that
 * reaches zero while the listing stays up).
 */
export default function HardwareAddToCartButton({
  product,
  className = "w-fit",
}: {
  product: HardwareProduct;
  className?: string;
}) {
  const addHardwareItem = useCartStore((s) => s.addHardwareItem);
  const items = useCartStore((s) => s.items);

  const outOfStock = product.stockQuantity <= 0;
  const alreadyInCart = items.some(
    (item) => item.kind === "hardware" && item.productId === product.id,
  );
  const disabled = outOfStock || !product.isActive || alreadyInCart;

  return (
    <NovaButton
      type="button"
      variant="primary"
      disabled={disabled}
      className={className}
      onClick={() => {
        addHardwareItem(product);
        track("add_to_cart", { gameId: product.id, price: product.salePrice });
      }}
    >
      {outOfStock ? "Out of Stock" : alreadyInCart ? "In Cart" : "Add to Cart"}
    </NovaButton>
  );
}
