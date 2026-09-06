import { notFound } from "next/navigation";
import Button from "@/components/Button";
import CardImage from "@/components/ui/CardImage";
import HeaderImage from "@/components/ui/HeaderImage";
import { getGiftCardImage } from "@/lib/product-image";
import { chamferClipPath } from "@/src/components/ui/nova/Chamfer";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import Tag from "@/src/components/games/Tag";
import { formatPrice } from "@/src/lib/format";
import { getGiftCardProductBySlug } from "@/src/lib/gift-card-catalog";
import { SITE_URL } from "@/src/lib/site-config";
import { GIFT_CARD_PLATFORM_LABELS } from "@/src/types/database";

/**
 * The one and only top-level await for this route, isolated here — same
 * pattern as app/(storefront)/games/[slug]/GameDetailBody.tsx.
 *
 * No VariantPicker/TrailerEmbed/setup-guide/RelatedGamesRow: those are
 * games-specific (variants, trailers, per-game setup guides). Add-to-cart
 * is a disabled placeholder this session — cart/checkout wiring for gift
 * cards is deliberately out of scope until the order-model changes land.
 */
export default async function GiftCardDetailBody({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getGiftCardProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const productUrl = `${SITE_URL}/gift-cards/${product.slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.id,
    category: GIFT_CARD_PLATFORM_LABELS[product.platform],
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: String(product.pricePkr),
      priceCurrency: "PKR",
      availability: product.isActive ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const eyebrowText = `${GIFT_CARD_PLATFORM_LABELS[product.platform]} · ${product.region}`;
  const hasDescription = product.description.trim().length > 0;

  // Adapted to CardImage/HeaderImage's existing prop shapes rather than
  // forking those components — see lib/product-image.ts and GiftCardCard's
  // own comment for why this is real reuse, not a lookalike duplicate.
  const cardImageProduct = {
    slug: product.slug,
    title: product.title,
    coverPath: null,
    coverImageUrl: getGiftCardImage(product),
  };
  const headerImageProduct: { slug: string; wallpaperPath: null; headerImageUrl?: string } = product.headerImageUrl
    ? { slug: product.slug, wallpaperPath: null, headerImageUrl: product.headerImageUrl }
    : { slug: product.slug, wallpaperPath: null };

  return (
    <div>
      {/* Our own catalog data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <HeaderImage game={headerImageProduct} className="bg-nova-crypt" />

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div
          data-testid="gift-card-hero-row"
          className="relative -mt-16 flex items-end gap-5 sm:-mt-20 md:-mt-24 md:gap-8"
        >
          <CardImage
            game={cardImageProduct}
            priority
            style={chamferClipPath(12)}
            className="w-28 shrink-0 border border-nova-hairline bg-nova-crypt sm:w-36 md:w-44"
          />
          <div className="flex flex-col gap-2 pb-1 md:pb-2">
            <Eyebrow className="[text-shadow:0_1px_3px_rgba(0,0,0,0.8),0_2px_10px_rgba(0,0,0,0.6)]">
              {eyebrowText}
            </Eyebrow>
            <h1 className="wrap-break-word font-display text-display-sm font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.6)]">
              {product.title}
            </h1>
          </div>
        </div>

        <div
          data-testid="gift-card-content"
          className="mt-8 grid grid-cols-1 gap-10 pb-16 md:mt-10 lg:grid-cols-[minmax(0,62%)_minmax(0,38%)] lg:items-start lg:gap-12"
        >
          <div
            data-testid="gift-card-purchase"
            className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-24 lg:self-start"
          >
            <span className="text-3xl font-bold text-nova-bone">{formatPrice(product.pricePkr)}</span>
            {/* Disabled placeholder — checkout/cart wiring for gift cards
                lands in a later session (order_items/create_order changes),
                not this one. */}
            <Button as="button" type="button" disabled className="w-full">
              Add to Cart — Coming Soon
            </Button>
            <ul className="flex flex-col gap-1.5 border-t border-nova-hairline pt-4 text-xs text-nova-smoke">
              <li>Verified delivery — every order checked before it ships</li>
              <li>WhatsApp support, 9am–9pm PKT</li>
              <li>Usually delivered within 1–2 hours</li>
            </ul>
          </div>

          <div className="order-2 flex max-w-3xl flex-col gap-10 lg:order-1">
            {hasDescription && (
              <p className="wrap-break-word text-base text-nova-ash">{product.description}</p>
            )}

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <Eyebrow tone="muted">Platform</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">
                  <Tag>{GIFT_CARD_PLATFORM_LABELS[product.platform]}</Tag>
                </p>
              </div>
              <div>
                <Eyebrow tone="muted">Region</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">
                  <Tag>{product.region}</Tag>
                </p>
              </div>
              {product.denominationValue !== null && product.denominationCurrency && (
                <div>
                  <Eyebrow tone="muted">Value</Eyebrow>
                  <p className="mt-2 text-sm text-nova-bone">
                    <Tag>
                      {product.denominationValue} {product.denominationCurrency}
                    </Tag>
                  </p>
                </div>
              )}
            </div>

            {product.redemptionInstructions.trim().length > 0 && (
              <div>
                <Eyebrow tone="muted">Redemption Instructions</Eyebrow>
                {/* Rendered verbatim — exactly what's stored, never through
                    src/lib/markdown.ts/sanitize-html. "Verbatim" means not
                    interpreted, not just not-mangled. */}
                <div
                  style={chamferClipPath(10)}
                  className="mt-2 whitespace-pre-wrap border border-nova-hairline bg-nova-crypt px-4 py-5 text-sm text-nova-ash"
                >
                  {product.redemptionInstructions}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
