"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { scrollTriggerAllowed } from "@/src/lib/motion-guards";
import { DURATION_SLOW, EASE_STANDARD } from "@/src/lib/motion-tokens";
import { useHeroParallax } from "@/src/lib/use-hero-parallax";

/**
 * Hero variant compared against the existing R3F hero (HeroVisual.tsx,
 * untouched). Compares a pure-CSS/GSAP layered image treatment (Ken Burns +
 * particle drift + entrance + optional parallax).
 * Toggled from HomeHero.tsx via HERO_VARIANT.
 *
 * Placeholder images live in public/hero-test/ (gitignored — see
 * .gitignore). Not committed, so none of this exists in a deployed build
 * until it's replaced with a real asset — see below.
 */
// PLACEHOLDER — sourced from Pinterest, not rights-cleared.
// MUST be replaced with an original/licensed asset before any
// public deploy. See HERO_ASSET_PATHS constant below to swap.
const HERO_ASSET_PATHS = [
  "/hero-test/hero-1.png",
  "/hero-test/hero-2.png",
];

const HERO_ASSET_STORAGE_KEY = "hero-v2-asset-index";

const PARTICLE_COUNT = 20;

interface Particle {
  id: number;
  left: number; // %
  size: number; // px
  duration: number; // s
  delay: number; // s
}

/**
 * Deterministic pseudo-random particle layout — no Math.random(). Server
 * and client must compute identical values or these inline styles trigger
 * a hydration mismatch; the golden-angle-ish multiplier just gives a
 * visually even, non-repeating-looking spread from a plain index.
 */
function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: (i * 43.7) % 100,
    size: 2 + ((i * 7) % 4),
    duration: 6 + ((i * 3) % 8),
    delay: (i * 0.9) % 8,
  }));
}

const PARTICLES = buildParticles(PARTICLE_COUNT);

export default function HeroVisualV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  // GSAP entrance (scale/blur) AND GSAP parallax (x/y) both target this
  // same element — GSAP composes its own transform tweens coherently, so
  // that's safe. The Ken Burns loop is pure CSS and lives on a *separate*
  // nested element (imageLoopRef's child below) specifically so it never
  // fights GSAP over the `transform` property — a CSS @keyframes
  // animation overrides an inline/GSAP-set value for the same property
  // on the same element, which would silently break either the parallax
  // or the Ken Burns loop if they shared one.
  const imageLayerRef = useRef<HTMLDivElement>(null);
  // No competing CSS animation targets this wrapper's own opacity (each
  // particle's drift/fade is on the particle itself), so it's safe for
  // the entrance fade to apply directly here.
  const particlesEntranceRef = useRef<HTMLDivElement>(null);

  // Local dev/testing only — cycles the placeholder through hero-1 -> -2 ->
  // hero-1 in order on each full page load. Defaults to index 0 for
  // the very first render so server and pre-hydration client markup match
  // (no hydration mismatch); the effect below then reads+advances the
  // index from localStorage once on mount and swaps the image in. That
  // swap is a deliberate one-time client-only pop, not a bug — this path
  // never ships (see PLACEHOLDER comment above), so it doesn't need the
  // CLS-avoidance rigor the rest of this project has for real assets.
  const [assetIndex, setAssetIndex] = useState(0);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HERO_ASSET_STORAGE_KEY);
      const lastIndex = stored === null ? -1 : parseInt(stored, 10);
      const nextIndex =
        ((Number.isInteger(lastIndex) ? lastIndex : -1) + 1 + HERO_ASSET_PATHS.length) %
        HERO_ASSET_PATHS.length;
      window.localStorage.setItem(HERO_ASSET_STORAGE_KEY, String(nextIndex));
      setAssetIndex(nextIndex);
    } catch {
      // localStorage unavailable (private mode, etc.) — stay on index 0.
    }
  }, []);

  useHeroParallax(containerRef, imageLayerRef);

  // Entrance: GSAP fade + scale(0.96->1) + blur-to-sharp, once on mount.
  // Deliberately never touches opacity on anything that ancestors the
  // <Image> itself (only its own scale/filter) — the image stays fully
  // opaque from first paint so it can still be the LCP element, matching
  // the same reasoning already documented in HeroVisual.tsx/HomeHero.tsx
  // for why the poster image and headline are never opacity-animated on
  // load. The decorative particle layer IS opacity-faded here since it's
  // a sibling of the image tree, not an ancestor of it.
  //
  // Gated on scrollTriggerAllowed() (reduced-motion OR viewport < 768px),
  // not just reduced-motion — confirmed via paired Lighthouse mobile runs
  // (4 each, v1 median 76 vs. an unconditional-entrance v2 median 58) that
  // dynamic-importing gsap-core and running any tween unconditionally on
  // mobile measurably worsens the exact main-thread-contention-during-
  // hydration bottleneck HeroVisual.tsx already documents and gates its
  // own R3F scene behind for the same reason. Below 768px this component
  // still gets its Ken Burns/particle loops — those are pure CSS,
  // effectively free — just not the one-shot JS entrance polish.
  useEffect(() => {
    if (!scrollTriggerAllowed()) return;
    const imageLayer = imageLayerRef.current;
    if (!imageLayer) return;

    let cancelled = false;
    import("@/src/lib/gsap-core").then(({ gsap }) => {
      if (cancelled) return;

      const particlesEl = particlesEntranceRef.current;

      gsap.set(imageLayer, { scale: 0.96, filter: "blur(8px)" });
      if (particlesEl) gsap.set(particlesEl, { opacity: 0 });

      const tl = gsap.timeline();
      tl.to(imageLayer, {
        scale: 1,
        filter: "blur(0px)",
        duration: DURATION_SLOW,
        ease: EASE_STANDARD,
      });
      if (particlesEl) {
        tl.to(particlesEl, { opacity: 1, duration: DURATION_SLOW, ease: EASE_STANDARD }, "<");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      // Session 8: was plain `aspect-square w-full` — this figure's
      // height followed its grid column's WIDTH, which at 1366-1440px is
      // ~627-644px, taller than the viewport; that's what forced the
      // whole hero section past one screen.
      //
      // Fix keeps width as the driving dimension (still `w-full`, now
      // against the correctly-bounded column from HomeHero.tsx's flex-1 +
      // min-w-0) but adds `md:max-h-full` as a real ceiling: if the
      // width-derived square would ever be taller than the row's
      // available height, this clamps it down. Tried making HEIGHT the
      // driving dimension instead (`md:h-full md:w-auto max-w-full`)
      // first — that clamped WIDTH correctly but never fed the clamp back
      // into height, since aspect-ratio only auto-derives a dimension
      // that's genuinely `auto`, not one with its own explicit value;
      // measured a non-square 644x772 box at 1440x900 as a result. This
      // width-first version was verified square (real getBoundingClientRect()
      // measurement, not assumed) at 1366x768, 1440x900, and 1920x1080 —
      // every size this hero actually ships at, where the column is
      // narrower than the row is tall. Below md (stacked layout, no
      // bounded row) unchanged: plain w-full.
      className="relative aspect-square w-full max-w-full overflow-hidden bg-nova-void md:max-h-full"
    >
      <div ref={imageLayerRef} className="absolute inset-0">
        <div className="absolute inset-0 hero-v2-kenburns">
          <Image
            src={HERO_ASSET_PATHS[assetIndex]}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div
        ref={particlesEntranceRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="hero-v2-particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
