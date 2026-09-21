import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import { getHardwareImage } from "@/lib/product-image";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import Tag from "@/src/components/games/Tag";
import { formatPrice } from "@/src/lib/format";
import { HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import type { HardwareProduct } from "@/src/types/database";

/**
 * Mirrors GiftCardCard's structure (NovaCard + CardImage + name + tags +
 * price), not the component itself. CardImage IS reused unmodified: a
 * HardwareProduct is adapted to the { slug, title, coverPath,
 * coverImageUrl } shape it already expects, falling through its existing
 * coverImageUrl/placeholder chain — getHardwareImage
 * (lib/product-image.ts) resolves first-photo / placeholder before that
 * shape is ever built, so CardImage needs no hardware-specific code.
 *
 * The stock treatment has no counterpart on the other two card types and
 * needs one here: hardware is the only family whose inventory is a
 * counter, so it can hit zero while the product stays listed and active.
 */
export default function HardwareCard({
  product,
  priority = false,
}: {
  product: HardwareProduct;
  /** First row of the grid should skip lazy-loading — same reasoning as
   * GameCard's own `priority` prop. */
  priority?: boolean;
}) {
  const outOfStock = product.stockQuantity <= 0;

  return (
    <Link href={`/hardware/${product.slug}`} className="group flex flex-col gap-3">
      <NovaCard data-cursor-follow-target>
        <div className="relative">
          <CardImage
            game={{
              slug: product.slug,
              title: product.name,
              coverPath: null,
              coverImageUrl: getHardwareImage(product),
            }}
            priority={priority}
          />
          {outOfStock && (
            <span className="absolute left-2 top-2 rounded-full border border-nova-hairline bg-nova-void/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-nova-ash">
              Out of stock
            </span>
          )}
        </div>
      </NovaCard>
      <div className="flex flex-col gap-1.5 transition-transform duration-(--duration-fast) ease-standard motion-reduce:transition-none group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
        <h3 className="line-clamp-2 font-sans text-[15px] font-semibold uppercase tracking-[0.06em] text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
          {product.name}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Tag>{HARDWARE_CATEGORY_LABELS[product.category]}</Tag>
          {/* Low-stock urgency on the card face. Unlike a digital product,
              "3 left" is literally true here and is the thing most likely
              to move a buyer — capped at 5 so it stays meaningful. */}
          {!outOfStock && product.stockQuantity <= 5 && <Tag>{product.stockQuantity} left</Tag>}
        </div>
        <span className="mt-1 text-sm font-semibold text-nova-bone">
          {formatPrice(product.salePrice)}
        </span>
      </div>
    </Link>
  );
}
