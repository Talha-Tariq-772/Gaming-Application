"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  prefersReducedMotion,
  SCROLLTRIGGER_MIN_WIDTH,
} from "@/src/lib/motion-guards";
import { DEFAULT_STAGGER, REVEAL_Y, dur, gsapTweenEase } from "@/src/lib/motion";

/**
 * NOVA_DESIGN_SPEC.md #5 scroll reveal: y: 40 -> 0, opacity fade,
 * configurable stagger. Structurally the same approach as
 * src/components/motion/ScrollReveal.tsx (no-op under reduced motion,
 * IntersectionObserver + CSS below the ScrollTrigger breakpoint, real
 * ScrollTrigger above it) — kept as its own component rather than a nova
 * variant of that one so nova's motion constants stay fully independent,
 * per motion.ts's own reasoning for not touching motion-tokens.ts.
 */
/** Actual current column count of a CSS grid — reads it back from computed
 * style rather than trusting a caller-supplied number, so it stays correct
 * across breakpoints (sm:grid-cols-2, xl:grid-cols-4, ...) without Reveal
 * needing to know any Tailwind class the caller used. Falls back to the
 * parent element when this one isn't itself a grid — the common case is
 * Reveal rendering `className="contents"` *inside* someone else's grid
 * (e.g. GamesResults.tsx), where `display: contents` means this element
 * has no box of its own to read a grid-template from at all. */
function getGridColumnCount(el: HTMLElement): number {
  const ownTemplate = window.getComputedStyle(el).gridTemplateColumns;
  const template =
    ownTemplate && ownTemplate !== "none"
      ? ownTemplate
      : window.getComputedStyle(el.parentElement ?? el).gridTemplateColumns;
  if (!template || template === "none") return 1;
  return template.split(" ").filter(Boolean).length;
}

export default function Reveal({
  children,
  className,
  stagger,
  batchByRow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds between each child's reveal; only applies when staggering
   * (i.e. when this wraps more than one child element). Defaults to
   * DEFAULT_STAGGER. */
  stagger?: number;
  /** When true, children batch by row instead of each getting its own
   * sequential delay — e.g. a 4-column grid reveals 4 cards at a time, one
   * row-delay apart, rather than 20 cards one after another. Requires the
   * wrapped element to actually be a CSS grid (column count is read from
   * computed style, not passed in, so it's always correct for whatever
   * breakpoint is active when the reveal fires). */
  batchByRow?: boolean;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const staggerGap = stagger ?? DEFAULT_STAGGER;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = scope.current;
    if (!el) return;

    const targets = Array.from(el.children) as HTMLElement[];
    if (targets.length === 0) return;

    const columns = batchByRow ? getGridColumnCount(el) : undefined;

    if (window.innerWidth < SCROLLTRIGGER_MIN_WIDTH) {
      targets.forEach((target, index) => {
        const batch = columns ? Math.floor(index / columns) : index;
        target.style.transitionDelay = `${batch * staggerGap}s`;
        target.classList.add("nova-reveal-init");
      });

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("nova-reveal-visible");
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.15 },
      );
      targets.forEach((target) => observer.observe(target));

      return () => observer.disconnect();
    }

    let cancelled = false;
    let revert: (() => void) | undefined;

    import("@/src/lib/use-gsap").then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;

      const ctx = gsap.context(() => {
        gsap.fromTo(
          targets,
          { opacity: 0, y: REVEAL_Y },
          {
            opacity: 1,
            y: 0,
            duration: dur.base,
            ease: gsapTweenEase.out,
            // axis: "y" makes gsap compute each target's delay purely
            // from its row in the [rows, columns] grid, so every card in
            // the same row shares one delay instead of fanning out
            // left-to-right within the row too.
            stagger: columns
              ? { each: staggerGap, from: "start", axis: "y", grid: [Math.ceil(targets.length / columns), columns] }
              : staggerGap,
            scrollTrigger: {
              trigger: targets[0],
              start: "top 85%",
              once: true,
            },
          },
        );
      }, el);
      revert = () => {
        ctx.revert();
        ScrollTrigger.refresh();
      };
    });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [staggerGap, batchByRow]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
