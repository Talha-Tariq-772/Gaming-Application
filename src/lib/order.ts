import { formatPriceExact } from "@/src/lib/format";
import type { GiftCardCartItem } from "@/src/stores/cart-store";
import { GIFT_CARD_PLATFORM_LABELS, type Order } from "@/src/types/database";

const RESERVATION_MINUTES = 45;

// *** TEMPORARY TEST VALUE — THIS IS HUZAIFA'S PERSONAL WHATSAPP NUMBER. ***
// Placeholder only, so the checkout -> WhatsApp handoff can be tested end
// to end while game_credentials is otherwise empty. Replace with Hashir's
// real WhatsApp Business number before this goes anywhere near production.
// wa.me format: digits only, country code, no "+", no leading 0 —
// 03256525755 (local) -> 923256525755.
export const SUPPORT_WHATSAPP_NUMBER = "923256525755";

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
    guestPhone: null,
    status: "awaiting_payment",
    paymentReference: generateOrderReference(),
    amountExact: params.totalAmount + generateReconciliationOffset(),
    paymentMethodId: params.paymentMethodId,
    claimedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    reservedUntil: reservedUntil.toISOString(),
    refundPolicyConsentedAt: null,
    regionAckConfirmedAt: null,
    createdAt: now.toISOString(),
  };
}

export interface WhatsAppOrderItem {
  title: string;
  /** Formatted "platform, region, denomination" for a gift card item —
   * omitted entirely for a game, which has no variant of its own. */
  variant?: string;
}

/**
 * "PlayStation Network, US, 10 USD" — the fulfilling agent needs platform
 * and region to know which code to send, and denomination when the
 * product has one; a bare product title isn't enough to disambiguate
 * between two regions/denominations of the same card.
 */
export function formatGiftCardVariant(item: GiftCardCartItem): string {
  const parts = [GIFT_CARD_PLATFORM_LABELS[item.platform], item.region];
  if (item.denominationValue !== null && item.denominationCurrency) {
    parts.push(`${item.denominationValue} ${item.denominationCurrency}`);
  }
  return parts.join(", ");
}

/**
 * Builds the buyer-facing WhatsApp handoff message. Plain text, no
 * markdown — WhatsApp's own bold/italic syntax would render literally
 * for a customer whose client doesn't support it, and the reference
 * must paste back out exactly as it went in. The reference leads on its
 * own line (first thing the agent sees, and what they paste into admin
 * search), then items, then the exact amount (paisa included — that's
 * what makes the transfer match automatically, see
 * generateReconciliationOffset), then the payment method.
 */
export function buildWhatsAppLink(
  order: Order,
  items: WhatsAppOrderItem[],
  paymentMethodLabel: string,
): string {
  const lines = [
    order.paymentReference,
    "",
    ...items.map((item) => (item.variant ? `${item.title} (${item.variant})` : item.title)),
    "",
    formatPriceExact(order.amountExact),
    paymentMethodLabel,
  ];
  const text = lines.join("\n");
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Generic support contact link (footer, /contact) — not tied to a
 * specific order, unlike buildWhatsAppLink above. */
export function buildGeneralWhatsAppLink(): string {
  const text = "Hi! I have a question about PSCBUNDLE.";
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
