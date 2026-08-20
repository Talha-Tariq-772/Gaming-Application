"use client";

import gsap from "gsap";
import { useGSAP as useGSAPBase } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAPBase);

  // transform/opacity-only project rule: force GSAP's default tween
  // properties away from layout-triggering ones so a stray `x`/`y` typo
  // can't silently animate top/left instead.
  gsap.config({ force3D: true });
}

export { gsap };
export { prefersReducedMotion, scrollTriggerAllowed, SCROLLTRIGGER_MIN_WIDTH } from "@/src/lib/motion-guards";

/**
 * Lightweight gsap entry point — core + the React hook only, NOT
 * ScrollTrigger (that's ~35KB min more, see use-gsap.ts). Import this one
 * for plain load/hover/click-triggered tweens that never scroll-link:
 * page transitions, the hero reveal, magnetic hover, count-up. Pulling in
 * ScrollTrigger for those would cost real bootup time for zero benefit —
 * it showed up directly as a Lighthouse regression during development.
 *
 * Anything that actually creates a ScrollTrigger must import use-gsap.ts
 * instead.
 */
export const useGSAP = useGSAPBase;
