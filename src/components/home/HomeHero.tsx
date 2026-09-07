import Image from "next/image";
import type { ReactNode } from "react";
import Button from "@/components/Button";
import MagneticButton from "@/src/components/motion/MagneticButton";

/**
 * Full-bleed header-image hero, replacing the old two-column
 * text/NovaFigureVisual split layout. The figure art
 * (NovaFigureVisual/NovaFigureStage, figure-color.webp) is no longer
 * rendered here — left unimported rather than deleted, same as this file's
 * previous convention already did for HeroVisual.tsx/HeroVisualV2.tsx, in
 * case it's wanted again elsewhere.
 *
 * This also means the old .nova-theme-lock-dark wrapper is gone: that
 * class existed specifically because the dark ink-on-transparent figure
 * art only read correctly against a near-black background (see its own
 * comment in globals.css) — a constraint about that specific asset, which
 * this hero no longer renders. Locking the whole section dark would also
 * actively break requirement 5 below (the bottom blend deliberately reads
 * the REAL page background token so it merges correctly in both themes,
 * which a section-wide dark lock would override back to always-dark).
 * Every color that must stay fixed regardless of theme (the scrim, the
 * overlay text) is hardcoded explicitly instead, the same way the store
 * hero's identical scrim/text bug was fixed.
 */

function HeroCopy(): ReactNode {
  return (
    <>
      {/* Fixed colors, not nova-* tokens: this text always sits on the
          artwork (or, on mobile, on this same hardcoded-dark band below
          it — never the page background), so it can't flip with theme.
          nova-ember-text/nova-bone would turn dark ink in light mode
          (app/globals.css) and disappear — the exact bug already fixed on
          the store hero and detail-page hero this session. #db5d1f is
          nova-ember-text's own dark-mode value, hardcoded so it stays the
          same "existing accent orange" in both themes. */}
      <span
        className="hero-reveal text-xs font-semibold uppercase tracking-[0.2em] text-[#db5d1f]"
        style={{ animationDelay: "0s" }}
      >
        Now live
      </span>
      <h1 className="w-full text-display-lg font-display font-extrabold text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]">
        Play what&rsquo;s
        <br />
        next.
      </h1>
      <p
        className="hero-reveal w-full text-lg text-white [text-shadow:0_2px_12px_rgba(8,6,10,0.8)]"
        style={{ animationDelay: "0.1s" }}
      >
        A curated, cinematic storefront for the games worth your time. No
        noise, no clutter — just what&rsquo;s worth playing.
      </p>
      <div className="hero-reveal flex items-center gap-6" style={{ animationDelay: "0.18s" }}>
        <MagneticButton as="a" href="/styleguide" variant="primary">
          View Styleguide
        </MagneticButton>
        {/* !text-white: Button's own "ghost" variant hardcodes
            text-nova-ash (theme-conditional, and too dim over artwork
            regardless) — the `!` is needed to reliably win over that
            class from a shared component rather than restyling the
            variant itself for every other ghost button on the site. */}
        <Button as="a" href="/games" variant="ghost" className="!text-white">
          Browse Store
        </Button>
      </div>
    </>
  );
}

export default function HomeHero() {
  return (
    <section className="w-full overflow-hidden bg-nova-void">
      <div className="relative aspect-[12/5] w-full">
        <Image
          src="/main-header.jpeg"
          alt=""
          fill
          unoptimized
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Text scrim: a genuine graduated darken, not a solid fill — every
            stop is translucent (max alpha 0.65) so the artwork stays
            visible underneath at every point, just progressively dimmed.
            An earlier version used opaque #08060A stops (alpha 1.0) out to
            45% width, which read as a flat black panel instead of a tint;
            this fixes that. Legibility now leans on the text-shadow above
            as much as the scrim (see HeroCopy) rather than the scrim alone.
            Explicit percentage stops via inline style, same technique as
            the bottom blend below, since Tailwind's from/via/to only gives
            one implicit midpoint. Right 35% (65-100%) stays completely
            untinted. Hardcoded dark in both themes, not a nova-void-tokened
            wash: nova-void flips to a light cream in light mode, which
            would turn this into exactly the "white/fog gradient" the store
            hero's identical scrim was explicitly fixed to avoid.
            Desktop/tablet only: below md the copy moves to its own
            solid-dark band beneath the image instead of overlaying it (see
            the mobile block further down). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-full md:block"
          style={{
            background:
              "linear-gradient(to right, rgba(8,6,10,0.65) 0%, rgba(8,6,10,0.45) 25%, rgba(8,6,10,0.15) 50%, transparent 65%)",
          }}
        />
        {/* Bottom blend: dissolves the artwork into the page background
            instead of terminating on a visible line. Hardcoded #08060A,
            not the nova-void token — a plain from/to gradient never has a
            solid run at its base, so the seam was visible even at the
            darkest stop. This holds solid to 35%, then eases through a
            mid step before fading out, which is what actually kills the
            line. Height is 27% of the hero box itself (not a vh-based
            clamp) — a vh value is sized off the viewport's height, which
            has nothing to do with this box's actual rendered height (that
            comes from aspect-[12/5] against the box's *width*); the two
            diverge hard at narrow/tall viewports, where 18vh measured out
            to ~96% of the hero's own height instead of the ~27% it reads
            as on desktop. 27% matches that desktop look (measured at
            1440x900) and, being a plain percentage of this box, holds the
            same fraction at every width — the internal gradient stops
            above are already percentages of this element's own box, so
            they keep the same solid-then-fade proportions automatically
            as this height changes with the viewport. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[27%]"
          style={{
            background:
              "linear-gradient(to top, #08060A 0%, #08060A 35%, rgba(8,6,10,0.7) 60%, transparent 100%)",
          }}
        />

        {/* Overlay copy — md+ only. Centered vertically, left-aligned to
            the site's normal content column, constrained to max-w-xl so
            it never runs into the right side of the artwork. */}
        <div className="absolute inset-0 z-10 mx-auto hidden w-full max-w-page items-center px-4 md:flex md:px-8">
          <div className="flex w-full max-w-xl flex-col items-start gap-7 md:gap-9">
            <HeroCopy />
          </div>
        </div>
      </div>

      {/* Mobile-only stacked copy, below the image in normal flow — an
          aspect-[12/5] box is even shorter at phone widths than the old
          16:9 one, nowhere near enough to overlay this much text without
          it overflowing the artwork. Same hardcoded
          dark band color as the scrim above, so the white text keeps the
          exact same guaranteed contrast here as it has on the overlay. */}
      <div className="flex w-full flex-col items-start gap-7 bg-[#08060a] px-4 py-10 md:hidden">
        <HeroCopy />
      </div>
    </section>
  );
}
