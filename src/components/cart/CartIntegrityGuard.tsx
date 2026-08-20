"use client";

import { useEffect, useRef } from "react";
import { useGamesByIds } from "@/src/lib/use-games-by-ids";
import { useHydrated } from "@/src/lib/use-hydrated";
import { cartItemSchema } from "@/src/lib/validation";
import { useCartStore } from "@/src/stores/cart-store";
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
  const { games, loaded: gamesLoaded } = useGamesByIds(items.map((item) => item.gameId));
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (!hydrated || !gamesLoaded || checkedOnce.current) return;
    checkedOnce.current = true;

    const invalidIds: string[] = [];
    const invalidTitles: string[] = [];

    for (const item of items) {
      const parsed = cartItemSchema.safeParse(item);
      if (!parsed.success) {
        invalidIds.push(item.gameId);
        invalidTitles.push(item.title || "an item");
        continue;
      }
      const game = games.find((g) => g.id === item.gameId);
      if (!game || !game.isActive) {
        invalidIds.push(item.gameId);
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
    // Deliberately once, right after hydration + real game data both land — see checkedOnce above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, gamesLoaded]);

  return null;
}
