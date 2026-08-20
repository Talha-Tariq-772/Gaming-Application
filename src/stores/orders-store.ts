import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { assertOrderTransition } from "@/src/lib/order-status";
import { safeStorage } from "@/src/lib/safe-storage";
import type { Order, OrderItem, OrderStatus } from "@/src/types/database";

/**
 * Orders placed through the live checkout flow in this browser, plus a
 * generic override map for status changes made by either the buyer
 * (markPaid) or an admin (approve/reject) — applied on top of *any* order
 * by id, whether it's a live one created here or a static seeded one from
 * mock-data.ts (which, being a plain array, can't be mutated directly).
 *
 * `useAllOrders` is what actually merges seed + live + overrides into one
 * list; both /account and /admin read through that, so an admin decision
 * shows up consistently everywhere.
 */
interface OrdersState {
  orders: Order[];
  orderItems: OrderItem[];
  overrides: Record<string, Partial<Order>>;
  addOrder: (order: Order, items: OrderItem[]) => void;
  /** Escape hatch for anything that isn't a status change (or, in
   * app/dev/states, deliberately seeding an arbitrary status to review a
   * state without walking the real flow) — every real status change in
   * the app goes through transitionStatus below instead. */
  applyOverride: (id: string, patch: Partial<Order>) => void;
  /** The only sanctioned way to change an order's status. Throws
   * InvalidOrderTransitionError if `from -> to` isn't a legal edge in the
   * state machine (see src/lib/order-status.ts) — callers pass `from`
   * explicitly (the status they observed the order in) rather than this
   * store re-deriving it, since resolving the current *effective* status
   * (seed + overrides merged) is useAllOrders's job, not this store's. */
  transitionStatus: (
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    patch?: Partial<Order>,
  ) => void;
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      orderItems: [],
      overrides: {},

      addOrder: (order, items) =>
        set((state) => ({
          orders: [...state.orders, order],
          orderItems: [...state.orderItems, ...items],
        })),

      applyOverride: (id, patch) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [id]: { ...state.overrides[id], ...patch },
          },
        })),

      transitionStatus: (id, from, to, patch = {}) => {
        assertOrderTransition(from, to);
        set((state) => ({
          overrides: {
            ...state.overrides,
            [id]: { ...state.overrides[id], ...patch, status: to },
          },
        }));
      },
    }),
    { name: "gk-orders", storage: createJSONStorage(() => safeStorage) },
  ),
);
