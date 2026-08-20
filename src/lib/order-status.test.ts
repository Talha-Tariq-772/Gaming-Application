import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  canTransitionOrderStatus,
  InvalidOrderTransitionError,
} from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types/database";

const ALL_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "payment_claimed",
  "under_review",
  "approved",
  "rejected",
  "expired",
];

const LEGAL_TRANSITIONS: [OrderStatus, OrderStatus][] = [
  ["awaiting_payment", "payment_claimed"],
  ["awaiting_payment", "expired"],
  ["payment_claimed", "under_review"],
  ["under_review", "approved"],
  ["under_review", "rejected"],
];

function isLegal(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// Every (from, to) pair across all 6 statuses (36 total) that ISN'T in
// LEGAL_TRANSITIONS above — includes same-state "transitions" and every
// attempt to move out of a terminal state.
const ILLEGAL_TRANSITIONS: [OrderStatus, OrderStatus][] = ALL_STATUSES.flatMap(
  (from) =>
    ALL_STATUSES.filter((to) => !isLegal(from, to)).map(
      (to): [OrderStatus, OrderStatus] => [from, to],
    ),
);

describe("order status state machine", () => {
  describe("legal transitions", () => {
    it.each(LEGAL_TRANSITIONS)("allows %s -> %s", (from, to) => {
      expect(canTransitionOrderStatus(from, to)).toBe(true);
      expect(() => assertOrderTransition(from, to)).not.toThrow();
    });
  });

  describe("illegal transitions", () => {
    it.each(ILLEGAL_TRANSITIONS)("rejects %s -> %s", (from, to) => {
      expect(canTransitionOrderStatus(from, to)).toBe(false);
      expect(() => assertOrderTransition(from, to)).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  it("covers the full 6x6 status matrix with no gaps or overlaps", () => {
    expect(LEGAL_TRANSITIONS.length + ILLEGAL_TRANSITIONS.length).toBe(
      ALL_STATUSES.length * ALL_STATUSES.length,
    );
  });

  it("terminal states (approved, rejected, expired) have no legal outgoing transition", () => {
    for (const terminal of ["approved", "rejected", "expired"] as const) {
      for (const to of ALL_STATUSES) {
        expect(canTransitionOrderStatus(terminal, to)).toBe(false);
      }
    }
  });

  it("thrown error carries the from/to states for debugging", () => {
    try {
      assertOrderTransition("approved", "rejected");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidOrderTransitionError);
      const error = err as InvalidOrderTransitionError;
      expect(error.from).toBe("approved");
      expect(error.to).toBe("rejected");
    }
  });
});
