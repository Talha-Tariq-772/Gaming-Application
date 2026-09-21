import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Structurally mirrors HomeHero (src/components/home/HomeHero.tsx) exactly:
 * same aspect-[12/5] reserved box, same translucent left scrim (rgba(8,6,10)
 * stops, never opaque) and hardcoded-#08060A bottom-fade gradients
 * (matching HomeHero's own choice not to use the nova-void token there),
 * same fixed-white/text-shadow copy treatment so contrast holds regardless
 * of theme, and now the same full-bleed
 * placement — rendered by GiftCardsPageBody as a bare sibling before its
 * padded max-w-page wrapper, not inside it, same technique HomeHero's own
 * page.tsx and GameDetailBody's HeaderImage use. No border/chamfer framing
 * (an earlier version had one) since a full-bleed section has no side
 * margins for a "frame" to sit inside, and HomeHero itself has none.
 *
 * `copy` lets a caller override or drop the overlay text while keeping the
 * exact same image/scrim/fade/sizing treatment — GiftCardDetailBody
 * (app/(storefront)/gift-cards/[slug]/GiftCardDetailBody.tsx) passes
 * `copy={null}` since its own overlapping title row below the banner
 * already carries the heading; stacking "Gift Cards" above the real
 * product title would be redundant. Omitting the prop entirely
 * (GiftCardsPageBody's call site) keeps the original default copy.
 */
function HeroCopy(): ReactNode {
  return (
    <>
      <h1 className="hero-reveal w-full text-display-lg font-display font-extrabold text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]">
        Gift Cards
      </h1>
      <p
        className="hero-reveal w-full text-lg text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]"
        style={{ animationDelay: "0.1s" }}
      >
        PSN, Xbox, Steam, Google Play, and Apple gift cards — instant digital
        delivery.
      </p>
    </>
  );
}

export default function GiftCardsHero({
  copy,
  imageUrl,
}: {
  copy?: ReactNode;
  /**
   * Per-product banner, when one has been uploaded through the admin
   * panel (gift_card_products.header_image_url). Omitted or null falls
   * back to the shared Gift Cards artwork below — which is what every
   * product rendered before image management existed, and what
   * removing an image restores.
   */
  imageUrl?: string | null;
}) {
  const content = copy === undefined ? <HeroCopy /> : copy;
  const src = imageUrl ?? "/products/gift-cards/optimised/header.webp";

  return (
    <section className="w-full overflow-hidden bg-nova-void">
      <div className="relative aspect-[12/5] w-full">
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Left scrim: identical to HomeHero's — a genuine graduated
            darken (translucent stops, max alpha 0.65), not a solid fill,
            so the product art stays visible through it. Transparent by
            65% width; the right 35% (65-100%, where this page's product
            display art sits) stays completely untinted. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-full md:block"
          style={{
            background:
              "linear-gradient(to right, rgba(8,6,10,0.65) 0%, rgba(8,6,10,0.45) 25%, rgba(8,6,10,0.15) 50%, transparent 65%)",
          }}
        />
        {/* Bottom blend: same fixed-#08060A pattern as HomeHero (see that
            file's comment) — a plain from/to gradient never has a solid
            run at its base, so this holds solid before easing out. Height
            is 27% of the hero box (not a vh-based clamp) — same fix as
            HomeHero, same reasoning: a vh value tracks viewport height,
            which has nothing to do with this box's own rendered height
            (driven by aspect-[12/5] against its width), so the old clamp
            covered up to ~96% of the box at narrow/tall viewports instead
            of the ~27% it read as on desktop. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[27%]"
          style={{
            background:
              "linear-gradient(to top, #08060A 0%, #08060A 35%, rgba(8,6,10,0.7) 60%, transparent 100%)",
          }}
        />

        {/* Overlay copy — md+ only, aligned to the site's normal content
            column (max-w-page) even though the image itself bleeds full
            width, same as HomeHero. Omitted entirely when a caller passes
            copy={null} (see the `copy` prop comment above). */}
        {content && (
          <div className="absolute inset-0 z-10 mx-auto hidden w-full max-w-page items-center px-4 md:flex md:px-8">
            <div className="flex w-full max-w-xl flex-col items-start gap-7 md:gap-9">{content}</div>
          </div>
        )}
      </div>

      {/* Mobile-only stacked copy below the image, same reasoning as
          HomeHero: an aspect-[12/5] box at phone widths isn't tall enough
          to overlay this much text without overflowing the artwork. */}
      {content && (
        <div className="flex w-full flex-col items-start gap-7 bg-[#08060a] px-4 py-10 md:hidden">{content}</div>
      )}
    </section>
  );
}
