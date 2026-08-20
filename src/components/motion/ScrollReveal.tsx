"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  prefersReducedMotion,
  SCROLLTRIGGER_MIN_WIDTH,
} from "@/src/lib/motion-guards";
import { DURATION_BASE, EASE_STANDARD, FADE_UP_Y, STAGGER_GAP } from "@/src/lib/motion-tokens";

/**
 * Fades content up as it scrolls into view, once. No-ops entirely under
 * prefers-reduced-motion (content renders in its final state, no library
 * ever loads). Below SCROLLTRIGGER_MIN_WIDTH, uses a plain
 * IntersectionObserver + CSS transition — gsap/ScrollTrigger never load on
 * mobile for this. At/above it, dynamic-imports use-gsap.ts for a real
 * ScrollTrigger-driven reveal (only paid for by routes that render this).
 *
 * With `stagger`, animates el.children individually instead of el itself —
 * pass a `className` of "contents" (display:contents) if el sits inside a
 * CSS grid/flex layout its children need to participate in directly, e.g.
 * wrapping a subset of grid items without breaking the grid.
 */
export default function ScrollReveal({
  children,
  className,
  stagger = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = scope.current;
    if (!el) return;

    const targets = stagger ? (Array.from(el.children) as HTMLElement[]) : [el];
    if (targets.length === 0) return;

    if (window.innerWidth < SCROLLTRIGGER_MIN_WIDTH) {
      targets.forEach((target, index) => {
        target.style.transitionDelay = stagger ? `${index * STAGGER_GAP}s` : "0s";
        target.classList.add("scroll-reveal-init");
      });

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("scroll-reveal-visible");
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.15 }
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
          { opacity: 0, y: FADE_UP_Y },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_BASE,
            ease: EASE_STANDARD,
            stagger: stagger ? STAGGER_GAP : 0,
            scrollTrigger: {
              trigger: targets[0],
              start: "top 85%",
              once: true,
            },
          }
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
  }, [stagger]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
