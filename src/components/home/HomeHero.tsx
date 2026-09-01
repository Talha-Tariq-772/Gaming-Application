import Button from "@/components/Button";
import MagneticButton from "@/src/components/motion/MagneticButton";
import NovaFigureVisual from "@/src/components/home/NovaFigureVisual";

/**
 * Pure CSS reveal (.hero-reveal, defined in globals.css) — no gsap, no JS
 * at all for the text side. The headline is deliberately NOT animated:
 * it's this page's LCP element, and even a fast gsap-driven opacity
 * reveal measurably delayed LCP in testing (both from the
 * opacity-animated-elements-aren't-LCP-eligible-until-opaque rule, and
 * from gsap-core's parse/exec cost sitting in the critical path since
 * this was the only static importer of it on this route). Reduced motion
 * is handled by the CSS itself — see globals.css.
 *
 * The figure column now renders NovaFigureVisual — the real fire/ember
 * WebGL effect (Part D) over the real artwork (figure-color.webp), not
 * either of the two comparison variants that used to live here.
 * HeroVisual.tsx (R3F) and HeroVisualV2.tsx (the Pinterest-placeholder
 * CSS variant, gitignored, never shippable) are both left in the tree
 * unimported in case they're wanted again, rather than deleted.
 */

/**
 * Session 8: the section used to be a plain grid with no min-height at
 * all, sized purely by its own py-32/md:py-48 padding plus the figure's
 * old `aspect-square w-full` — that made the figure's HEIGHT follow its
 * COLUMN'S WIDTH (~627-644px at 1366-1440px), which is far taller than
 * any reasonable viewport. The grid row sized to that, the section sized
 * to the row plus its huge padding, and the whole thing measured
 * 1011-1028px tall against a 768-900px viewport — confirmed via
 * getBoundingClientRect(), not assumed. items-center was already present
 * and centering correctly; it just had a hugely oversized row to center
 * *within*.
 *
 * Fix is structural, not a padding tweak: <section> is now `flex
 * min-h-svh` (same shape as NovaHero.tsx's section — the hero is still
 * guaranteed at least one full viewport tall, per the CLS requirement,
 * but no longer taller than that from its own content), deliberately with
 * NO items-center of its own — default `align-items: stretch` instead, so
 * its single child (the two-column wrapper) stretches to the section's
 * full resolved height, a real known value, rather than shrinking to its
 * own content height. That wrapper is a flex row (flex-col below md) with
 * `flex-1` on each column for equal WIDTH; the same default stretch gives
 * both columns that same real height. The text column's own
 * `justify-center` (unchanged) centers its content within it, and the
 * figure wrapper mirrors that with `items-center justify-center`. The
 * figure itself (HeroVisual/HeroVisualV2) now takes its height FROM that
 * bounded row (`md:h-full md:w-auto`) and derives width from its own
 * aspect-ratio, capped by `max-w-full` — sized to fit the available
 * height, not the other way around. Below md (stacked, single column)
 * it's unchanged: `w-full`, height following from aspect-ratio, same as
 * before this fix.
 */
export default function HomeHero() {
  return (
    <section className="flex min-h-svh w-full overflow-hidden bg-nova-void">
      <div className="mx-auto flex w-full max-w-page flex-col gap-12 px-4 py-12 md:flex-row md:px-8 md:py-16">
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-8">
          <span
            className="hero-reveal text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text"
            style={{ animationDelay: "0s" }}
          >
            Now live
          </span>
          <h1 className="w-full text-display-lg font-display font-extrabold text-nova-bone">
            Play what&rsquo;s
            <br />
            next.
          </h1>
          <p
            className="hero-reveal w-full max-w-lg text-lg text-nova-ash"
            style={{ animationDelay: "0.1s" }}
          >
            A curated, cinematic storefront for the games worth your time. No
            noise, no clutter — just what&rsquo;s worth playing.
          </p>
          <div
            className="hero-reveal mt-4 flex items-center gap-6"
            style={{ animationDelay: "0.18s" }}
          >
            <MagneticButton as="a" href="/styleguide" variant="primary">
              View Styleguide
            </MagneticButton>
            <Button as="a" href="#" variant="ghost">
              Browse Store
            </Button>
          </div>
        </div>
        {/* min-w-0 overrides the flex item default of min-width:auto —
            without it, the aspect-square figure's transferred min-content
            size (from height:100%) floors this column wider than an even
            flex-1 split, stealing ~13px from the text column at
            1366x768 (measured: 640px vs 614px before this fix). Classic
            flexbox + aspect-ratio interaction, not specific to this
            component. */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <NovaFigureVisual />
        </div>
      </div>
    </section>
  );
}
