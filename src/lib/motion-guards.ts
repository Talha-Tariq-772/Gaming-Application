/**
 * Zero-dependency motion guards (no gsap/lenis imports) so components that
 * only need to *check* reduced-motion/breakpoint state can do so without
 * pulling gsap's bundle in via a static import. use-gsap.ts re-exports
 * these for components that already depend on gsap anyway.
 */

/** Below this width, ScrollTrigger-driven effects are disabled — mobile
 * gets plain fade-ups instead (see scrollTriggerAllowed). Matches the
 * `md` breakpoint used for layout switches elsewhere in the app. */
export const SCROLLTRIGGER_MIN_WIDTH = 768;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Whether ScrollTrigger-driven effects (pin, scrub, scroll-linked reveals)
 * are allowed to run. False when the user has prefers-reduced-motion set,
 * or on viewports under SCROLLTRIGGER_MIN_WIDTH.
 *
 * Every scroll-triggered animation in this codebase must branch on this
 * before creating a ScrollTrigger — when false, render the final state
 * (reduced motion) or fall back to a plain fade-up with no scroll linkage
 * (mobile).
 */
export function scrollTriggerAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    !prefersReducedMotion() &&
    window.innerWidth >= SCROLLTRIGGER_MIN_WIDTH
  );
}
