import type { ReactNode } from "react";

/**
 * Structurally mirrors GiftCardsHero (same aspect-[12/5] reserved box,
 * same fixed-white/text-shadow copy treatment so contrast holds
 * regardless of theme, same md+ overlay / below-image mobile split, same
 * `copy` override prop), with one deliberate difference: there is no
 * <Image>.
 *
 * Hardware ships with no header artwork — no build-time manifest entry,
 * no Storage pipeline, nothing in public/products. Pointing at a file
 * that does not exist would 404 on every page load, and reusing the
 * gift-card banner would tell the buyer they are looking at gift cards. A
 * token-driven gradient needs no asset, cannot 404, and holds up in both
 * themes on its own.
 *
 * `copy={null}` drops the overlay text while keeping the identical banner
 * treatment — HardwareDetailBody passes it, since its own overlapping
 * title row below already carries the product name.
 */
function HeroCopy(): ReactNode {
  return (
    <>
      <h1 className="hero-reveal w-full font-display text-display-lg font-extrabold text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]">
        Hardware
      </h1>
      <p
        className="hero-reveal w-full text-lg text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]"
        style={{ animationDelay: "0.1s" }}
      >
        Consoles, controllers, headsets and accessories &mdash; real stock, shipped across
        Pakistan.
      </p>
    </>
  );
}

export default function HardwareHero({ copy }: { copy?: ReactNode }) {
  const content = copy === undefined ? <HeroCopy /> : copy;

  return (
    <section className="w-full overflow-hidden bg-nova-void">
      <div className="relative aspect-[12/5] w-full">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 18% 20%, rgba(193,68,14,0.38) 0%, rgba(193,68,14,0.10) 42%, transparent 70%), linear-gradient(135deg, #17110f 0%, #0d0a0c 55%, #08060a 100%)",
          }}
        />
        {/* Same fixed-#08060A bottom blend as HomeHero/GiftCardsHero, and
            the same 27%-of-the-box height rather than a vh clamp (a vh
            value tracks viewport height, which has nothing to do with
            this box's rendered height, driven by aspect-[12/5] against
            its width). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[27%]"
          style={{
            background:
              "linear-gradient(to top, #08060A 0%, #08060A 35%, rgba(8,6,10,0.7) 60%, transparent 100%)",
          }}
        />

        {content && (
          <div className="absolute inset-0 z-10 mx-auto hidden w-full max-w-page items-center px-4 md:flex md:px-8">
            <div className="flex w-full max-w-xl flex-col items-start gap-7 md:gap-9">{content}</div>
          </div>
        )}
      </div>

      {/* Mobile-only stacked copy below the banner, same reasoning as
          HomeHero: an aspect-[12/5] box at phone widths is not tall enough
          to overlay this much text without overflowing. */}
      {content && (
        <div className="flex w-full flex-col items-start gap-7 bg-[#08060a] px-4 py-10 md:hidden">
          {content}
        </div>
      )}
    </section>
  );
}
