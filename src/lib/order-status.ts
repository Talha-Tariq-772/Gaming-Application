import type { OrderStatus } from "@/src/types/database";

/**
 * The one legal shape an order's status can move through:
 *
 *   awaiting_payment -> payment_claimed -> under_review -> approved | rejected
 *   awaiting_payment -> expired   (the 45-minute reservation lapses unclaimed)
 *
 * approved, rejected, and expired are terminal — nothing transitions out of
 * them. Every write to `Order.status` in this app must go through
 * assertTransition/transitionStatus (see orders-store.ts) instead of
 * setting the field directly, so a transition that isn't in this graph is
 * a thrown bug, not a silently-accepted one.
 */
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ["payment_claimed", "expired"],
  payment_claimed: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
  expired: [],
};

export class InvalidOrderTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Invalid order status transition: "${from}" -> "${to}". Legal next ` +
        `states from "${from}": ${ORDER_TRANSITIONS[from].join(", ") || "(none — terminal)"}.`,
    );
    this.name = "InvalidOrderTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Throws InvalidOrderTransitionError if `from -> to` isn't in the graph
 * above. Call this at every single site that changes an order's status. */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
