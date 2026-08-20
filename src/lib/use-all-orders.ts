import { MOCK_ORDER_ITEMS, MOCK_ORDERS } from "@/src/lib/mock-data";
import { useOrdersStore } from "@/src/stores/orders-store";
import type { Order, OrderItem } from "@/src/types/database";

/**
 * Merges the static seeded demo orders with whatever's been placed through
 * the live checkout flow in this browser, then applies any status overrides
 * (buyer markPaid, admin approve/reject) on top — so /account and /admin
 * always see the same, current picture of every order regardless of where
 * it originated.
 */
export function useAllOrders(): { orders: Order[]; orderItems: OrderItem[] } {
  const liveOrders = useOrdersStore((s) => s.orders);
  const liveItems = useOrdersStore((s) => s.orderItems);
  const overrides = useOrdersStore((s) => s.overrides);

  const orders = [...MOCK_ORDERS, ...liveOrders].map((order) =>
    overrides[order.id] ? { ...order, ...overrides[order.id] } : order,
  );

  return {
    orders,
    orderItems: [...MOCK_ORDER_ITEMS, ...liveItems],
  };
}
