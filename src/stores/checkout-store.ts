import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { claimPayment, createOrder } from "@/src/lib/actions/checkout";
import { formatGiftCardVariant } from "@/src/lib/order";
import { safeStorage } from "@/src/lib/safe-storage";
import type { CartItem } from "@/src/stores/cart-store";
import type { Order } from "@/src/types/database";

export type CheckoutStep = 1 | 2 | 3;

export type CheckoutActionResult = { ok: true } | { ok: false; message: string };

export interface CheckoutOrderItem {
  title: string;
  /** "PlayStation Network, US, 10 USD" — set only for a gift-card item, see
   * formatGiftCardVariant. */
  variant?: string;
}

interface CheckoutState {
  step: CheckoutStep;
  paymentMethodId: string | null;
  phoneNumber: string;
  /** Required (and only rendered) when the cart holds at least one
   * gift-card item — mirrors the payment-instructions step's refund-policy
   * checkbox: a plain local boolean gating Continue, reset by
   * resetCheckout. */
  regionAck: boolean;
  order: Order | null;
  /** Snapshot of the cart's item titles, captured at order-creation time
   * — the cart itself is cleared right after, and the WhatsApp handoff
   * message (built on step 3) still needs titles to show. */
  orderItems: CheckoutOrderItem[];
  setPaymentMethodId: (id: string) => void;
  setPhoneNumber: (phone: string) => void;
  setRegionAck: (ack: boolean) => void;
  /** Creates the real order (createOrder server action) and advances to
   * step 2 on success. Every item is submitted with the same
   * paymentMethodId — checkout only ever offers one payment method for
   * the whole cart. userId is omitted entirely for a guest checkout — no
   * session is required. */
  confirmMethodAndPhone: (cartItems: CartItem[], userId?: string) => Promise<CheckoutActionResult>;
  /** Marks the order as claimed (claimPayment server action) and advances to step 3. */
  markPaid: () => Promise<CheckoutActionResult>;
  /** The 45-minute reservation window closed before payment was claimed —
   * updates the local order snapshot to 'expired' immediately so
   * StepPaymentInstructions can show its "reservation expired" screen
   * without a round-trip (the DB side expires independently via the
   * release-expired-reservations cron). Deliberately does NOT touch
   * step/order-nullness here: StepPaymentInstructions renders its own
   * expired screen off local state, and CheckoutFlow only renders that
   * step while `order` is still set — nulling it out here would unmount
   * that screen before the buyer ever saw it. resetCheckout (called from
   * the screen's "Start Over" button) is what actually leaves step 2. */
  markOrderExpired: () => void;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      step: 1,
      paymentMethodId: null,
      phoneNumber: "",
      regionAck: false,
      order: null,
      orderItems: [],

      setPaymentMethodId: (id) => set({ paymentMethodId: id }),
      setPhoneNumber: (phone) => set({ phoneNumber: phone }),
      setRegionAck: (ack) => set({ regionAck: ack }),

      confirmMethodAndPhone: async (cartItems, userId) => {
        const { paymentMethodId, phoneNumber, regionAck } = get();
        if (!paymentMethodId || cartItems.length === 0) {
          return { ok: false, message: "Select a payment method and add items to your cart." };
        }

        const items = cartItems.map((item) =>
          item.kind === "gift_card"
            ? { kind: "gift_card" as const, productId: item.productId, paymentMethodId }
            : { kind: "credential" as const, gameId: item.gameId, paymentMethodId },
        );
        const result = await createOrder(userId, items, phoneNumber, regionAck);
        if (!result.ok) {
          return { ok: false, message: result.message };
        }

        set({
          order: result.order,
          orderItems: cartItems.map((item) =>
            item.kind === "gift_card"
              ? { title: item.title, variant: formatGiftCardVariant(item) }
              : { title: item.title },
          ),
          step: 2,
        });
        return { ok: true };
      },

      markPaid: async () => {
        const { order } = get();
        if (!order) {
          return { ok: false, message: "No order to confirm." };
        }
        const result = await claimPayment(order.id);
        if (!result.ok) {
          return { ok: false, message: result.message };
        }
        set({ order: result.order, step: 3 });
        return { ok: true };
      },

      markOrderExpired: () => {
        const { order } = get();
        if (order) {
          set({ order: { ...order, status: "expired" } });
        }
      },

      resetCheckout: () =>
        set({ step: 1, paymentMethodId: null, phoneNumber: "", regionAck: false, order: null, orderItems: [] }),
    }),
    { name: "gk-checkout", storage: createJSONStorage(() => safeStorage) },
  ),
);
