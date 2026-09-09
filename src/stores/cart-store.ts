import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getGiftCardImage } from "@/lib/product-image";
import { safeStorage } from "@/src/lib/safe-storage";
import { useToastStore } from "@/src/stores/toast-store";
import type { Game, GiftCardPlatform, GiftCardProduct, GiftCardRegion } from "@/src/types/database";

/** One credential per purchase — no quantity, just a snapshot of the game. */
export interface CredentialCartItem {
  kind: "credential";
  gameId: string;
  slug: string;
  title: string;
  price: number;
  coverImageUrl: string;
}

/** One redemption code per purchase — no quantity, just a snapshot of the
 * gift-card product. platform/region/denomination are carried on the item
 * itself (not re-fetched later) because the WhatsApp handoff message and
 * the checkout region-acknowledgement step both need to show them without
 * a product round-trip once the cart is already what's being checked out. */
export interface GiftCardCartItem {
  kind: "gift_card";
  productId: string;
  slug: string;
  title: string;
  price: number;
  coverImageUrl: string;
  platform: GiftCardPlatform;
  region: GiftCardRegion;
  denominationValue: number | null;
  denominationCurrency: string | null;
}

export type CartItem = CredentialCartItem | GiftCardCartItem;

/** Arbitrary but real — nothing about the checkout flow (45-minute single
 * reservation, one exact-amount transfer) is designed for a cart this
 * large, so this is a sanity ceiling, not a business decision. */
export const MAX_CART_SIZE = 20;

/** The cart's own stable identity for an item, independent of its kind —
 * every place that used to key off gameId directly (dedupe, removeItem,
 * pruneItems, React list keys) goes through this instead, since a
 * gift-card item has no gameId at all. */
export function cartItemId(item: CartItem): string {
  return item.kind === "gift_card" ? item.productId : item.gameId;
}

interface CartState {
  items: CartItem[];
  /** Who this persisted cart belongs to: a signed-in user's id, or null for
   * a guest cart (no session, or a guest cart not yet claimed by a sign-in).
   * Exists purely to stop a cart from leaking across accounts on a shared
   * device — see claimForUser/clearOnSignOut, both driven by
   * AuthContext's onAuthStateChange, not by anything in this file directly. */
  ownerId: string | null;
  addItem: (game: Game) => void;
  addGiftCardItem: (product: GiftCardProduct) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  /** Drops items by cartItemId — used by the on-load integrity check (games
   * or gift-card products that no longer exist or went inactive since this
   * cart was last saved). Not for normal removal; see removeItem for that. */
  pruneItems: (ids: string[]) => void;
  /** Called by AuthContext on every auth event that carries a signed-in
   * user (SIGNED_IN, an INITIAL_SESSION/TOKEN_REFRESHED/USER_UPDATED that
   * already has a session, ...). A guest cart (ownerId null) is claimed for
   * this user in place — same person, just authenticated now, so the items
   * survive. A cart already tagged to a DIFFERENT user is cleared instead
   * of silently being shown to this one; that's the actual leak this
   * exists to close (e.g. account A never explicitly signed out on a
   * shared device, and account B is now the persisted session). Already
   * this user's cart (repeat sign-ins, token refreshes) is a no-op. */
  claimForUser: (userId: string) => void;
  /** Called by AuthContext on the SIGNED_OUT event specifically — wipes the
   * cart unconditionally, guest-claimed or not. Signing out is an explicit
   * "I'm done" signal, so this is the one case that clears even a cart
   * that started as a legitimate guest cart before being claimed. */
  clearOnSignOut: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      ownerId: null,

      addItem: (game) => {
        const items = get().items;

        // Reject duplicates — one credential per game per cart.
        if (items.some((item) => cartItemId(item) === game.id)) {
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
              kind: "credential",
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

      addGiftCardItem: (product) => {
        const items = get().items;

        if (items.some((item) => cartItemId(item) === product.id)) {
          useToastStore
            .getState()
            .showToast(`${product.title} is already in your cart`);
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
              kind: "gift_card",
              productId: product.id,
              slug: product.slug,
              title: product.title,
              price: product.pricePkr,
              coverImageUrl: getGiftCardImage(product),
              platform: product.platform,
              region: product.region,
              denominationValue: product.denominationValue,
              denominationCurrency: product.denominationCurrency,
            },
          ],
        });
        useToastStore.getState().showToast(`${product.title} added to cart`);
      },

      removeItem: (id) => {
        set({ items: get().items.filter((item) => cartItemId(item) !== id) });
      },

      pruneItems: (ids) => {
        if (ids.length === 0) return;
        const drop = new Set(ids);
        set({ items: get().items.filter((item) => !drop.has(cartItemId(item))) });
      },

      clearCart: () => set({ items: [] }),

      claimForUser: (userId) => {
        const ownerId = get().ownerId;
        if (ownerId === userId) return; // already this user's cart
        if (ownerId === null) {
          // Guest cart being claimed by the account that just signed in —
          // same person, keep the items.
          set({ ownerId: userId });
          return;
        }
        // Tagged to a different account than the one now signing in.
        set({ items: [], ownerId: userId });
      },

      clearOnSignOut: () => set({ items: [], ownerId: null }),
    }),
    {
      name: "gk-cart",
      storage: createJSONStorage(() => safeStorage),
      // v0 (unversioned) carts predate `kind` entirely — every persisted
      // item was implicitly a credential item. v1 added `kind` as a
      // discriminated union but predates `ownerId` entirely. Bumped to 2
      // when per-owner tagging was added (cross-account cart leak on a
      // shared device); migrateCartStorage backfills both kind:"credential"
      // and ownerId:null onto anything still sitting in a browser's
      // localStorage from before either change, so a returning visitor's
      // cart neither crashes nor gets silently dropped.
      version: 2,
      migrate: migrateCartStorage,
    },
  ),
);

/** Exported for direct unit testing — see cart-store.test.ts's "stale v0/v1
 * cart" cases — as well as being zustand persist's own `migrate` option
 * above. */
export function migrateCartStorage(persisted: unknown): { items: CartItem[]; ownerId: string | null } {
  const state = persisted as { items?: unknown[]; ownerId?: unknown } | null | undefined;
  if (!state || !Array.isArray(state.items)) {
    return { items: [], ownerId: null };
  }
  const items = state.items.map((item) => {
    if (item && typeof item === "object" && !("kind" in item)) {
      return { ...item, kind: "credential" };
    }
    return item;
  }) as CartItem[];
  // A pre-ownerId cart (v0 or v1) is treated as a guest cart rather than
  // dropped — shipping this feature must not wipe a returning visitor's
  // in-progress cart. If they turn out to already be signed in, the very
  // next auth-state event (claimForUser) claims it for them exactly like a
  // real guest cart would be.
  const ownerId = typeof state.ownerId === "string" ? state.ownerId : null;
  return { items, ownerId };
}
