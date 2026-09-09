"use client";

import { useEffect, useRef } from "react";
import { useGamesByIds } from "@/src/lib/use-games-by-ids";
import { useGiftCardsByIds } from "@/src/lib/use-gift-cards-by-ids";
import { useHydrated } from "@/src/lib/use-hydrated";
import { cartItemSchema } from "@/src/lib/validation";
import { cartItemId, useCartStore } from "@/src/stores/cart-store";
import { useToastStore } from "@/src/stores/toast-store";

const MAX_NAMES_IN_TOAST = 3;

/**
 * Runs once, right after the persisted cart rehydrates, and validates it
 * against current game data: a game removed or deactivated since this
 * cart was last saved (or a malformed record — hand-edited localStorage,
 * a future shape change) gets dropped, and the buyer is told what and
 * why. No UI of its own — mounted once, sitewide, alongside CartDrawer.
 *
 * This is separate from the *continuous* re-validation useCartSummary
 * does on every render (which excludes invalid items from the total but
 * leaves them visible/removable) — a game going inactive mid-session
 * while the buyer is already looking at it in their cart shouldn't make
 * it vanish without warning. This guard only ever removes items that
 * were already invalid before the buyer opened the cart this session.
 */
export default function CartIntegrityGuard() {
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const pruneItems = useCartStore((s) => s.pruneItems);
  const showToast = useToastStore((s) => s.showToast);
  const { games, loaded: gamesLoaded } = useGamesByIds(
    items.filter((i) => i.kind === "credential").map((i) => i.gameId),
  );
  const { products, loaded: productsLoaded } = useGiftCardsByIds(
    items.filter((i) => i.kind === "gift_card").map((i) => i.productId),
  );
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (!hydrated || !gamesLoaded || !productsLoaded || checkedOnce.current) return;
    checkedOnce.current = true;

    const invalidIds: string[] = [];
    const invalidTitles: string[] = [];

    for (const item of items) {
      const parsed = cartItemSchema.safeParse(item);
      if (!parsed.success) {
        invalidIds.push(cartItemId(item));
        invalidTitles.push(item.title || "an item");
        continue;
      }
      const isValid =
        item.kind === "gift_card"
          ? products.some((p) => p.id === item.productId && p.isActive)
          : games.some((g) => g.id === item.gameId && g.isActive);
      if (!isValid) {
        invalidIds.push(cartItemId(item));
        invalidTitles.push(item.title);
      }
    }

    if (invalidIds.length > 0) {
      pruneItems(invalidIds);
      const shown = invalidTitles.slice(0, MAX_NAMES_IN_TOAST).join(", ");
      const remaining = invalidTitles.length - MAX_NAMES_IN_TOAST;
      const extra = remaining > 0 ? ` and ${remaining} more` : "";
      showToast(`Removed from your cart (no longer available): ${shown}${extra}`);
    }
    // Deliberately once, right after hydration + real product data both
    // land — see checkedOnce above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, gamesLoaded, productsLoaded]);

  return null;
}
