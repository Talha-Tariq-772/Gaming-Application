import Image from "next/image";
import { notFound } from "next/navigation";
import CardImage from "@/components/ui/CardImage";
import { getHardwareImage } from "@/lib/product-image";
import { chamferClipPath } from "@/src/components/ui/nova/Chamfer";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import Tag from "@/src/components/games/Tag";
import HardwareAddToCartButton from "@/src/components/hardware/HardwareAddToCartButton";
import HardwareHero from "@/src/components/hardware/HardwareHero";
import { formatPrice } from "@/src/lib/format";
import { getHardwareProductBySlug } from "@/src/lib/hardware-catalog";
import { SITE_URL } from "@/src/lib/site-config";
import { HARDWARE_CATEGORY_LABELS } from "@/src/types/database";

/**
 * The one and only top-level await for this route, isolated here — same
 * pattern as GiftCardDetailBody.
 *
 * No variant picker, trailer, setup guide or related row: those are
 * games-specific. What hardware has that neither digital family does is a
 * real stock number and several photos, so those are what this page adds.
 */
export default async function HardwareDetailBody({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getHardwareProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const productUrl = `${SITE_URL}/hardware/${product.slug}`;
  const inStock = product.stockQuantity > 0 && product.isActive;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    category: HARDWARE_CATEGORY_LABELS[product.category],
    image: product.imageUrls.length > 0 ? product.imageUrls : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: String(product.salePrice),
      priceCurrency: "PKR",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const hasDescription = product.description.trim().length > 0;
  // The first photo is the card face (see HardwareProduct.imageUrls); the
  // rest form the gallery strip below it.
  const galleryImages = product.imageUrls.slice(1);

  const cardImageProduct = {
    slug: product.slug,
    title: product.name,
    coverPath: null,
    coverImageUrl: getHardwareImage(product),
  };

  return (
    <div>
      {/* Our own catalog data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      {/* Same full-bleed banner as /hardware — one product family, one
          header treatment, not a per-product wallpaper. copy={null} drops
          the "Hardware" title since the hero row below already carries
          this product's real name. */}
      <HardwareHero copy={null} />

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div
          data-testid="hardware-hero-row"
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
              {HARDWARE_CATEGORY_LABELS[product.category]}
            </Eyebrow>
            <h1 className="wrap-break-word font-display text-display-sm font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.6)]">
              {product.name}
            </h1>
          </div>
        </div>

        <div
          data-testid="hardware-content"
          className="mt-8 grid grid-cols-1 gap-10 pb-16 md:mt-10 lg:grid-cols-[minmax(0,62%)_minmax(0,38%)] lg:items-start lg:gap-12"
        >
          <div
            data-testid="hardware-purchase"
            className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-24 lg:self-start"
          >
            <span className="text-3xl font-bold text-nova-bone">
              {formatPrice(product.salePrice)}
            </span>

            {/* Stated in words, not just implied by a disabled button —
                this is the one product family where "we have it, but not
                right now" is a normal state a buyer needs spelled out. */}
            <p
              data-testid="hardware-stock"
              className={`text-sm font-semibold ${inStock ? "text-nova-ember-text" : "text-nova-ash"}`}
            >
              {!product.isActive
                ? "Not currently listed"
                : product.stockQuantity === 0
                  ? "Out of stock"
                  : product.stockQuantity <= 5
                    ? `Only ${product.stockQuantity} left in stock`
                    : "In stock"}
            </p>

            <HardwareAddToCartButton product={product} className="w-full" />

            <ul className="flex flex-col gap-1.5 border-t border-nova-hairline pt-4 text-xs text-nova-smoke">
              <li>Checked and tested before dispatch</li>
              <li>WhatsApp support, 9am&ndash;9pm PKT</li>
              <li>Delivery across Pakistan</li>
            </ul>
          </div>

          <div className="order-2 flex max-w-3xl flex-col gap-10 lg:order-1">
            {galleryImages.length > 0 && (
              <div>
                <Eyebrow tone="muted">Photos</Eyebrow>
                <div className="mt-3 flex flex-wrap gap-3">
                  {galleryImages.map((url) => (
                    <div
                      key={url}
                      style={chamferClipPath(8)}
                      className="relative size-24 overflow-hidden border border-nova-hairline bg-nova-crypt"
                    >
                      <Image
                        src={url}
                        alt={`${product.name} photo`}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasDescription && (
              <p className="wrap-break-word text-base text-nova-ash">{product.description}</p>
            )}

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <Eyebrow tone="muted">Category</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">
                  <Tag>{HARDWARE_CATEGORY_LABELS[product.category]}</Tag>
                </p>
              </div>
              <div>
                <Eyebrow tone="muted">Availability</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">
                  <Tag>{inStock ? `${product.stockQuantity} in stock` : "Sold out"}</Tag>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
