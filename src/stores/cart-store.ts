import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/src/lib/safe-storage";
import { useToastStore } from "@/src/stores/toast-store";
import type { Game } from "@/src/types/database";

/** One credential per purchase — no quantity, just a snapshot of the game. */
export interface CartItem {
  gameId: string;
  slug: string;
  title: string;
  price: number;
  coverImageUrl: string;
}

/** Arbitrary but real — nothing about the checkout flow (45-minute single
 * reservation, one exact-amount transfer) is designed for a cart this
 * large, so this is a sanity ceiling, not a business decision. */
export const MAX_CART_SIZE = 20;

interface CartState {
  items: CartItem[];
  addItem: (game: Game) => void;
  removeItem: (gameId: string) => void;
  clearCart: () => void;
  /** Drops items by gameId — used by the on-load integrity check (games
   * that no longer exist or went inactive since this cart was last
   * saved). Not for normal removal; see removeItem for that. */
  pruneItems: (gameIds: string[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (game) => {
        const items = get().items;

        // Reject duplicates — one credential per game per cart.
        if (items.some((item) => item.gameId === game.id)) {
          useToastStore
            .getState()
            .showToast(`${game.title} is already in your cart`);
          return;
        }

        if (items.length >= MAX_CART_SIZE) {
          useToastStore
            .getState()
            .showToast(`Your cart is full (max ${MAX_CART_SIZE} items)`);
          return;
        }

        set({
          items: [
            ...items,
            {
              gameId: game.id,
              slug: game.slug,
              title: game.title,
              price: game.price,
              coverImageUrl: game.coverImageUrl,
            },
          ],
        });
        useToastStore.getState().showToast(`${game.title} added to cart`);
      },

      removeItem: (gameId) => {
        set({ items: get().items.filter((item) => item.gameId !== gameId) });
      },

      pruneItems: (gameIds) => {
        if (gameIds.length === 0) return;
        const drop = new Set(gameIds);
        set({ items: get().items.filter((item) => !drop.has(item.gameId)) });
      },

      clearCart: () => set({ items: [] }),
    }),
    { name: "gk-cart", storage: createJSONStorage(() => safeStorage) },
  ),
);
