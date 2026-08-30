import Image from "next/image";
import type { CSSProperties } from "react";
import NovaButton from "@/src/components/ui/nova/NovaButton";
import NovaCanvasGate from "./NovaCanvasGate";

// PLACEHOLDER — procedurally generated (scripts/generate-nova-poster.mjs),
// not an art-directed asset. Swap the file (or this path) for a real
// poster whenever one exists; nothing else here needs to change.
const HERO_POSTER_SRC = "/nova-hero-poster.webp";

const HEADLINE = "PLAY WHAT'S NEXT";
const CHAR_STAGGER_S = 0.018;

/**
 * NOVA_DESIGN_SPEC.md #6. Server component — the poster below is the LCP
 * element (always rendered, no client JS gating it), and the headline's
 * char-split reveal is pure CSS (see globals.css's .nova-hero-char), not
 * GSAP. The only client code this renders is <NovaCanvasGate />, which
 * decides — in its own three.js-free effect — whether the WebGL layer
 * (NovaCanvas.tsx, a separate chunk via next/dynamic) gets requested at
 * all; a visitor with reduced motion or no WebGL never fetches it, and
 * the poster is the entire experience for them, not a fallback that looks
 * broken.
 */
export default function NovaHero() {
  return (
    <section className="relative flex min-h-svh w-full items-center overflow-hidden bg-nova-void">
      <Image
        src={HERO_POSTER_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <NovaCanvasGate />

      <div className="relative z-10 mx-auto max-w-page px-4 py-32 md:px-8">
        {/* Session 2's .font-display.text-display-lg rule (globals.css)
            already applies uppercase, 0.04em tracking, 0.92 line-height,
            and weight 700 for this exact class combination. */}
        <h1
          aria-hidden="true"
          className="max-w-4xl font-display text-display-lg text-nova-bone"
        >
          {HEADLINE.split("").map((char, i) => (
            <span
              key={i}
              className="nova-hero-char"
              style={{ "--char-delay": `${i * CHAR_STAGGER_S}s` } as CSSProperties}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </h1>
        <span className="sr-only">{HEADLINE}</span>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <NovaButton as="a" href="/games" variant="primary">
            Enter the Store
          </NovaButton>
          <NovaButton as="a" href="/styleguide" variant="ghost">
            View Styleguide
          </NovaButton>
        </div>
      </div>
    </section>
  );
}
