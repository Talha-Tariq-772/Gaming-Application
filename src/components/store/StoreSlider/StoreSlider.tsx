"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { canCreateWebGLContext } from "@/src/components/hero/Nova/webgl-support";
import NovaButton from "@/src/components/ui/nova/NovaButton";
import { formatPrice } from "@/src/lib/format";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { priceDisplay } from "@/src/lib/price-display";
import { gameWallpaperImage } from "@/src/lib/storage-image";
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
 * brief's "prefetch slide 2 only, slides 3-5 load lazily on advance". */
const PREFETCH_AHEAD = 1;

interface Slide {
  key: string;
  href: string;
  title: string;
  priceLabel: string | null;
  wasPriceLabel: string | null;
  src: string;
  srcSet: string;
}

function buildSlides(games: Game[]): Slide[] {
  return games
    .filter((game): game is Game & { wallpaperPath: string } => Boolean(game.wallpaperPath))
    .slice(0, 5)
    .map((game) => {
      const wallpaper = gameWallpaperImage(game.wallpaperPath, game.productType);
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
  "flex min-h-11 min-w-11 items-center justify-center rounded-full border border-nova-hairline bg-nova-void/60 text-nova-bone backdrop-blur-sm transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/60 hover:text-nova-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember";

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
      className="relative w-full overflow-hidden bg-nova-crypt"
      style={{ height: "clamp(420px, 45vw, 620px)" }}
    >
      {useWebGL ? (
        <SliderCanvas urls={urls} activeIndex={index} onError={() => setUseWebGL(false)} />
      ) : (
        <div className="absolute inset-0">
          {slides.map((slide, i) =>
            i <= maxRendered ? (
              // eslint-disable-next-line @next/next/no-img-element -- wallpaperPath derivatives are already exact pre-sized .webp files; see storage-image.ts and GameCard.tsx's identical reasoning
              <img
                key={slide.key}
                src={slide.src}
                srcSet={slide.srcSet}
                sizes="100vw"
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                aria-hidden={i !== index}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : null,
          )}
        </div>
      )}

      {/* Horizontal scrim behind the text zone — keeps the title/price/CTA
          legible over any wallpaper, regardless of its own brightness. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-nova-void/85 via-nova-void/40 to-transparent"
      />
      {/* Separate, shallow scrim for the bottom control strip (pause/dots) —
          independent of the text scrim above since the controls sit outside
          the text zone entirely. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-nova-void/80 to-transparent"
      />

      {/* Text zone: left-anchored, vertically centered, nothing else lives
          here — prev/next sit at the outer edges and pause/dots sit at the
          bottom-center, both outside this column. */}
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
          <h2
            className="font-display uppercase text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.3 }}
          >
            {slides[index].title}
          </h2>
        </Link>
        {slides[index].priceLabel && (
          <span className="flex items-baseline gap-2 font-sans">
            <span className="text-lg font-semibold text-nova-bone">{slides[index].priceLabel}</span>
            {slides[index].wasPriceLabel && (
              <span className="text-sm text-nova-smoke line-through">{slides[index].wasPriceLabel}</span>
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
