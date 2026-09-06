import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import { getGiftCardImage } from "@/lib/product-image";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import Tag from "@/src/components/games/Tag";
import { formatPrice } from "@/src/lib/format";
import { GIFT_CARD_PLATFORM_LABELS } from "@/src/types/database";
import type { GiftCardProduct } from "@/src/types/database";

/**
 * Mirrors GameCard.tsx's structure (NovaCard + CardImage + title + tags +
 * price), not the component itself — GameCard is typed to the full Game
 * interface (genre, platform enum, variants), which a gift-card product
 * doesn't have. CardImage itself IS reused unmodified: a GiftCardProduct is
 * adapted to the { slug, title, coverPath, coverImageUrl } shape it already
 * expects, falling through its existing coverImageUrl/placeholder chain —
 * getGiftCardImage (lib/product-image.ts) is what resolves the admin
 * override / per-platform art / placeholder priority before that shape is
 * ever built.
 */
export default function GiftCardCard({
  product,
  priority = false,
}: {
  product: GiftCardProduct;
  /** First row of the grid should skip lazy-loading — same reasoning as
   * GameCard's own `priority` prop. */
  priority?: boolean;
}) {
  return (
    <Link href={`/gift-cards/${product.slug}`} className="group flex flex-col gap-3">
      <NovaCard data-cursor-follow-target>
        <CardImage
          game={{ slug: product.slug, title: product.title, coverPath: null, coverImageUrl: getGiftCardImage(product) }}
          priority={priority}
        />
      </NovaCard>
      <div className="flex flex-col gap-1.5 transition-transform duration-(--duration-fast) ease-standard motion-reduce:transition-none group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
        <h3 className="line-clamp-2 font-sans text-[15px] font-semibold uppercase tracking-[0.06em] text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
          {product.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Tag>{GIFT_CARD_PLATFORM_LABELS[product.platform]}</Tag>
          {/* Region on the card face, not just the detail page — a buyer
              needs to rule out a mismatched-region listing before they even
              open it. */}
          <Tag>{product.region}</Tag>
        </div>
        <span className="mt-1 text-sm font-semibold text-nova-bone">{formatPrice(product.pricePkr)}</span>
      </div>
    </Link>
  );
}
