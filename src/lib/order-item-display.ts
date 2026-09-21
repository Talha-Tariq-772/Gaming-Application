import type { WhatsAppOrderItem } from "@/src/lib/order";
import { GIFT_CARD_PLATFORM_LABELS, HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import type {
  Game,
  GiftCardProduct,
  HardwareProduct,
  OrderItem,
} from "@/src/types/database";

/** "PlayStation Network, US, 10 USD" for a gift-card product — the
 * DB-order-history counterpart of src/lib/order.ts's formatGiftCardVariant,
 * which works off a live cart snapshot that doesn't exist for a past
 * order. */
export function formatGiftCardProductVariant(product: GiftCardProduct): string {
  const parts = [GIFT_CARD_PLATFORM_LABELS[product.platform], product.region];
  if (product.denominationValue !== null && product.denominationCurrency) {
    parts.push(`${product.denominationValue} ${product.denominationCurrency}`);
  }
  return parts.join(", ");
}

/**
 * Turns a real order's order_items rows into buildWhatsAppLink's item
 * shape — shared by every past-order view (account order card/detail,
 * admin order panel) so a gift-card line item always carries its
 * platform/region/denomination, not just a bare title. An item whose
 * product/game can't be resolved (deleted, or the map wasn't populated)
 * is dropped rather than shown blank — same tolerance the previous
 * games-only version already had.
 */
export function toWhatsAppOrderItems(
  items: OrderItem[],
  games: Game[],
  giftCardProductsByCodeId: Record<string, GiftCardProduct>,
  hardwareById: Record<string, HardwareProduct>,
): WhatsAppOrderItem[] {
  return items.flatMap((item) => {
    if (item.productType === "hardware") {
      const product = item.hardwareProductId ? hardwareById[item.hardwareProductId] : undefined;
      // The agent packing a box needs to know it IS a box, and which
      // shelf — a bare product name reads identically to a digital
      // line in the handoff message.
      return product
        ? [{ title: product.name, variant: HARDWARE_CATEGORY_LABELS[product.category] }]
        : [];
    }
    if (item.productType === "gift_card") {
      const product = item.giftCardCodeId ? giftCardProductsByCodeId[item.giftCardCodeId] : undefined;
      return product ? [{ title: product.title, variant: formatGiftCardProductVariant(product) }] : [];
    }
    const title = games.find((g) => g.id === item.gameId)?.title;
    return title ? [{ title }] : [];
  });
}
