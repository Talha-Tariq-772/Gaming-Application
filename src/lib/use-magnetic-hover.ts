"use client";

import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DURATION_FAST, EASE_STANDARD } from "@/src/lib/motion-tokens";

const HOVER_CAPABLE = "(hover: hover) and (pointer: fine)";
const STRENGTH = 0.35;

/**
 * Pulls `ref`'s element a fraction of the way toward the cursor while
 * hovered, snapping back on leave. gsap-core.ts isn't dynamic-imported
 * until the pointer actually enters the element, so this costs nothing on
 * page load, and nothing at all for touch/coarse-pointer visitors (no
 * persistent hover to react to). No-ops under reduced motion.
 */
export function useMagneticHover(
  ref: RefObject<HTMLElement | null>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    if (typeof window === "undefined" || !window.matchMedia(HOVER_CAPABLE).matches) {
      return;
    }

    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    let xTo: ((value: number) => void) | undefined;
    let yTo: ((value: number) => void) | undefined;

    function handleMove(e: MouseEvent) {
      if (!xTo || !yTo || !el) return;
      const rect = el.getBoundingClientRect();
      xTo((e.clientX - (rect.left + rect.width / 2)) * STRENGTH);
      yTo((e.clientY - (rect.top + rect.height / 2)) * STRENGTH);
    }

    function handleLeave() {
      xTo?.(0);
      yTo?.(0);
    }

    function activate() {
      import("@/src/lib/gsap-core").then(({ gsap }) => {
        if (cancelled || !el) return;
        xTo = gsap.quickTo(el, "x", { duration: DURATION_FAST, ease: EASE_STANDARD });
        yTo = gsap.quickTo(el, "y", { duration: DURATION_FAST, ease: EASE_STANDARD });
        el.addEventListener("mousemove", handleMove);
        el.addEventListener("mouseleave", handleLeave);
      });
    }

    el.addEventListener("pointerenter", activate, { once: true });

    return () => {
      cancelled = true;
      el.removeEventListener("pointerenter", activate);
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [ref, enabled]);
}
