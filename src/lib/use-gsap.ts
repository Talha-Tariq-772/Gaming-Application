"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap, useGSAP } from "@/src/lib/gsap-core";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, useGSAP, ScrollTrigger };
export { prefersReducedMotion, scrollTriggerAllowed, SCROLLTRIGGER_MIN_WIDTH } from "@/src/lib/motion-guards";

/**
 * Scroll-linked gsap entry point: everything gsap-core.ts exports, plus
 * ScrollTrigger registered. Import this ONLY from components that actually
 * create a ScrollTrigger (scroll-triggered fade-ups, the pinned horizontal
 * section). Everything else should import gsap-core.ts — ScrollTrigger is
 * a real ~35KB-minified plugin, and pulling it into a component that never
 * uses it (e.g. a plain load-time reveal) shows up directly as wasted
 * bootup time in Lighthouse. See gsap-core.ts for the full rationale.
 */
