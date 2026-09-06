"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getHeaderImageResponsive } from "@/lib/product-image";
import { canCreateWebGLContext } from "@/src/components/hero/Nova/webgl-support";
import NovaButton from "@/src/components/ui/nova/NovaButton";
import { formatPrice } from "@/src/lib/format";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { priceDisplay } from "@/src/lib/price-display";
import type { Game } from "@/src/types/database";

/**
 * NOVA_DESIGN_SPEC.md's raw-WebGL2 approach (NovaCanvas.tsx), not
 * three.js — this component is 1 draw call with a 2-texture crossfade
 * shader, the same order of complexity NovaCanvas judged three.js
 * unjustifiable for. Dynamic + ssr:false: this chunk is only ever
 * requested once useWebGL flips true below, so a reduced-motion or
 * no-WebGL2 visitor never downloads it at all — same gating shape as
 * NovaCanvasGate.tsx.
 */
const SliderCanvas = dynamic(() => import("./SliderCanvas"), {
  ssr: false,
  loading: () => null,
});

const AUTO_ADVANCE_MS = 6000;
/** How many derivative widths to eagerly consider "loaded" ahead of the
 * current slide — 1 means "prefetch exactly one slide ahead", matching the
 * brief's "prefetch slide 2 only, the rest load lazily on advance". */
const PREFETCH_AHEAD = 1;
/** Matches admin-slider.ts's MAX_SLOTS / AdminSliderClient.tsx's
 * SLOT_COUNT — not importable directly (admin-slider.ts is a "use server"
 * module, which can only export async actions), so kept in sync by hand. */
const MAX_SLIDES = 6;

interface Slide {
  key: string;
  href: string;
  title: string;
  priceLabel: string | null;
  wasPriceLabel: string | null;
  src: string;
  srcSet?: string;
}

function buildSlides(games: Game[]): Slide[] {
  return games
    .filter((game): game is Game & { wallpaperPath: string } => Boolean(game.wallpaperPath))
    .slice(0, MAX_SLIDES)
    .map((game) => {
      // Local products/header manifest art first, falling back to the
      // Supabase-managed wallpaperPath derivative — same priority order as
      // every other card/header call site (see lib/product-image.ts).
      const wallpaper = getHeaderImageResponsive(game);
      const price = priceDisplay(game);
      return {
        key: game.id,
        href: `/games/${game.slug}`,
        title: game.title,
        priceLabel: price?.label ?? null,
        wasPriceLabel: price?.wasPricePkr != null ? formatPrice(price.wasPricePkr) : null,
        src: wallpaper.src,
        srcSet: wallpaper.srcSet,
      };
    });
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="3.5" height="12" />
      <rect x="9.5" y="2" width="3.5" height="12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={direction === "left" ? "" : "rotate-180"}
    >
      <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CONTROL_BUTTON_CLASSES =
  "flex min-h-11 min-w-11 items-center justify-center rounded-full border border-nova-hairline bg-nova-void/60 text-nova-bone backdrop-blur-sm transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/60 hover:text-nova-ember-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember";

/**
 * 5 slides from games.slider_position, ordered by it. WebGL2 dissolve
 * crossfade when available and motion is allowed; a plain CSS opacity
 * crossfade otherwise (same markup, same slides, no canvas chunk
 * requested — see the `useWebGL` gate below).
 */
export default function StoreSlider({ games }: { games: Game[] }) {
  const slides = useMemo(() => buildSlides(games), [games]);
  // Stable reference across every index change — SliderCanvas's GL setup
  // effect depends on this array by identity, and its whole point is to
  // survive slide advances without tearing down (see that component's own
  // comment). A fresh `slides.map(...)` literal here would give it a new
  // array every render, forcing a full teardown/remount every time `index`
  // changes: on remount it only preloads slides 0 and 1, so from then on
  // the canvas would freeze on the last successfully drawn slide while the
  // title/price/dots — driven directly off `index` — kept advancing.
  const urls = useMemo(() => slides.map((s) => s.src), [slides]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hoverOrFocusPaused, setHoverOrFocusPaused] = useState(false);
  const [useWebGL, setUseWebGL] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!canCreateWebGLContext()) return;
    setUseWebGL(true);
  }, []);

  useEffect(() => {
    if (!playing || hoverOrFocusPaused || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [playing, hoverOrFocusPaused, slides.length]);

  function goTo(next: number) {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }

  if (slides.length === 0) return null;

  // Slides eligible to exist in the CSS-fallback DOM (and, symmetrically,
  // whose derivative URL list SliderCanvas is allowed to have loaded) —
  // slide 0 and the one PREFETCH_AHEAD past the current index. Anything
  // further is only rendered once `index` actually reaches it, which is
  // what makes "lazily on advance" true rather than just a `loading="lazy"`
  // hint the browser could ignore (these images all sit in the same
  // above-the-fold box, so lazy-loading alone wouldn't defer them at all).
  const maxRendered = Math.max(PREFETCH_AHEAD, index);

  return (
    <section
      ref={containerRef}
      aria-roledescription="carousel"
      aria-label="Featured games"
      onMouseEnter={() => setHoverOrFocusPaused(true)}
      onMouseLeave={() => setHoverOrFocusPaused(false)}
      onFocus={() => setHoverOrFocusPaused(true)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node | null)) {
          setHoverOrFocusPaused(false);
        }
      }}
      className="relative aspect-[12/5] w-full overflow-hidden bg-nova-crypt"
    >
      {useWebGL ? (
        <SliderCanvas urls={urls} activeIndex={index} onError={() => setUseWebGL(false)} />
      ) : (
        <div className="absolute inset-0">
          {slides.map((slide, i) =>
            i <= maxRendered ? (
              // Identical wrapper on every slide — same classes, only the
              // crossfade opacity differs — so nothing about the box's
              // size or content shifts when the active slide changes.
              // Just one image layer: the section is aspect-[12/5] (2.4:1),
              // matching the source artwork's own ratio, so object-cover
              // fills it exactly with no cropping and no letterbox gap —
              // no blurred fill layer needed to paper over a mismatch.
              <div
                key={slide.key}
                aria-hidden={i !== index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- wallpaperPath derivatives are already exact pre-sized .webp files; see storage-image.ts and GameCard.tsx's identical reasoning */}
                <img
                  src={slide.src}
                  srcSet={slide.srcSet}
                  sizes="100vw"
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Text scrim: left ~40% only — where the title/price/CTA actually
          sit — fading to fully transparent before mid-frame, so the
          center/right of the artwork (where the characters are) stays
          completely untouched. Hardcoded dark color, NOT the nova-void
          token: this must stay the same dark scrim in both themes — a
          token-driven wash here previously inverted to a washed-out
          light/fog gradient in light mode, which is exactly what this
          avoids. Capped at 70% opacity at its darkest point. Shared once
          (not duplicated per slide) so it's identical across every slide
          by construction. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#08060a]/70 via-[#08060a]/30 to-transparent"
      />
      {/* Bottom blend: thin band (~1/5 of the height) so the hero merges
          into whatever section follows on the page, fading upward to
          transparent — unlike the text scrim above, this one deliberately
          DOES use the nova-void token, since the whole point is to match
          each theme's actual page background at the seam, not to darken
          the art. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-nova-void to-transparent"
      />

      {/* Text zone: left-anchored, vertically centered, nothing else lives
          here — prev/next sit at the outer edges and pause/dots sit at the
          bottom-center, both outside this column. Legibility over bright
          art comes from both the scrim above and the text's own drop
          shadow (below). */}
      <div className="absolute inset-y-0 left-0 flex w-full max-w-[480px] flex-col justify-center gap-4 py-12 pr-6 pl-20 sm:pr-10 sm:pl-24 md:pr-16 md:pl-28">
        <Link href={slides[index].href} className="group w-fit">
          {/* Session 9: no font-extrabold — this h2's size comes from an
              inline clamp(), not one of the text-* sizes the
              .font-display compound rules (globals.css) cover, so this
              was requesting a weight Marcellus doesn't ship.
              Session 9 follow-up: line-height 1.05 was left over from the
              same rule this component doesn't use. Same real-glyph-overlap
              bug as globals.css's .text-display-* rule (Marcellus's glyph
              box runs ~1.25x font-size) — confirmed here too via
              getClientRects() on "Grand Theft Auto VI" at 1366/1440px,
              where it wraps to two lines. 1.3 matches the token rule. */}
          {/* Fixed white, not text-nova-bone: this text always sits on
              artwork (never the page background), so it can't use a
              theme-aware token — nova-bone flips to near-black ink in
              light mode (app/globals.css), which was invisible against
              the scrim. Same reasoning on the price/was-price below.
              Overridden locally here only; nova-bone itself (used
              everywhere else as the real body-text token) is untouched. */}
          <h2
            className="font-display uppercase text-white transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text [text-shadow:0_2px_4px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.6)]"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.3 }}
          >
            {slides[index].title}
          </h2>
        </Link>
        {slides[index].priceLabel && (
          <span className="flex items-baseline gap-2 font-sans [text-shadow:0_1px_3px_rgba(0,0,0,0.8),0_2px_10px_rgba(0,0,0,0.6)]">
            <span className="text-lg font-semibold text-white">{slides[index].priceLabel}</span>
            {slides[index].wasPriceLabel && (
              <span className="text-sm text-white/70 line-through">{slides[index].wasPriceLabel}</span>
            )}
          </span>
        )}
        <NovaButton as="a" href={slides[index].href} variant="primary" className="mt-2 w-fit">
          View Game
        </NovaButton>
      </div>

      {/* Prev/next: circular, semi-transparent, vertically centered on the
          outer edges — deliberately outside the text zone's max-width. */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => goTo(index - 1)}
        className={`absolute left-4 top-1/2 -translate-y-1/2 ${CONTROL_BUTTON_CLASSES}`}
      >
        <ChevronIcon direction="left" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => goTo(index + 1)}
        className={`absolute right-4 top-1/2 -translate-y-1/2 ${CONTROL_BUTTON_CLASSES}`}
      >
        <ChevronIcon direction="right" />
      </button>

      {/* Pause + dots: grouped, horizontally centered at the bottom. */}
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-4">
        {/* WCAG 2.2.2: auto-advancing content needs a visible way to stop
            it, not just the hover/focus pause above (which a mouse-less,
            non-focusing visitor — e.g. someone just reading — can't
            trigger). */}
        <button
          type="button"
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          aria-pressed={!playing}
          onClick={() => setPlaying((p) => !p)}
          className={CONTROL_BUTTON_CLASSES}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex items-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              aria-label={`Go to slide ${i + 1} of ${slides.length}: ${slide.title}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-[width,background-color] duration-(--duration-fast) ease-standard ${
                i === index ? "w-6 bg-nova-ember" : "w-2.5 bg-nova-ash/50 hover:bg-nova-ash"
              }`}
            />
          ))}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {slides[index].title}
      </p>
    </section>
  );
}
