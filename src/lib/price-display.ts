import { formatPrice } from "@/src/lib/format";
import type { Game } from "@/src/types/database";

export interface PriceDisplay {
  label: string;
  wasPricePkr: number | null;
}

/**
 * variantMode='single' -> its one variant's price. variantMode='multi' ->
 * "From {lowest}". Either way, strikethrough follows whichever variant the
 * displayed price actually came from — not just "the first variant with a
 * was_price_pkr", which could belong to a variant that isn't the one shown.
 * Shared by GameCard and StoreSlider so both read price the same way.
 */
export function priceDisplay(game: Pick<Game, "variants" | "variantMode">): PriceDisplay | null {
  if (game.variants.length === 0) return null;

  if (game.variantMode === "multi") {
    const lowest = game.variants.reduce((min, v) => (v.pricePkr < min.pricePkr ? v : min));
    return { label: `From ${formatPrice(lowest.pricePkr)}`, wasPricePkr: lowest.wasPricePkr };
  }

  const [variant] = game.variants;
  return { label: formatPrice(variant.pricePkr), wasPricePkr: variant.wasPricePkr };
}
