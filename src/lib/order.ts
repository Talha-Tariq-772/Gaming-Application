import { formatPrice } from "@/src/lib/format";
import type { Order } from "@/src/types/database";

const RESERVATION_MINUTES = 45;

export const SUPPORT_WHATSAPP_NUMBER = "923162960537";

export function generateOrderReference(): string {
  const hex = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `GK-${hex.toUpperCase()}`;
}

/**
 * A small random amount (Rs 1-99) layered on top of the cart total so every
 * order's exact amount is unique. That uniqueness is what lets an exact bank
 * transfer be matched back to an order automatically, with no reference
 * number required on the transfer itself.
 */
export function generateReconciliationOffset(): number {
  return Math.floor(Math.random() * 99) + 1;
}

export function buildPendingOrder(params: {
  totalAmount: number;
  paymentMethodId: string;
  userId: string;
}): Order {
  const now = new Date();
  const reservedUntil = new Date(
    now.getTime() + RESERVATION_MINUTES * 60 * 1000,
  );

  return {
    id: crypto.randomUUID(),
    userId: params.userId,
    status: "awaiting_payment",
    paymentReference: generateOrderReference(),
    amountExact: params.totalAmount + generateReconciliationOffset(),
    paymentMethodId: params.paymentMethodId,
    claimedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: reservedUntil.toISOString(),
    refundPolicyConsentedAt: null,
    createdAt: now.toISOString(),
  };
}

export function buildWhatsAppLink(
  order: Order,
  paymentMethodLabel: string,
): string {
  const text = `Order ${order.paymentReference} — ${formatPrice(order.amountExact)} via ${paymentMethodLabel}. Screenshot attached.`;
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Generic support contact link (footer, /contact) — not tied to a
 * specific order, unlike buildWhatsAppLink above. */
export function buildGeneralWhatsAppLink(): string {
  const text = "Hi! I have a question about Nova.";
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
