"use client";

import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DURATION_FAST, EASE_STANDARD } from "@/src/lib/motion-tokens";

const HOVER_CAPABLE = "(hover: hover) and (pointer: fine)";
const MAX_SHIFT = 6; // px, each axis — subtle, not a real 3D parallax

/**
 * TEST-ONLY — used by HeroVisualV2 (src/components/home/HeroVisualV2.tsx).
 *
 * Desktop-only mouse-follow shift for the hero image, gated exactly like
 * useMagneticHover/useGridCursorFollow: nothing attached at all under
 * reduced motion or on touch/coarse-pointer devices, gsap-core only
 * dynamic-imported on the container's first real pointerenter, one
 * delegated pointermove listener on the container (not per-layer/
 * per-particle). Targets `target`, not `containerRef` itself, so the
 * shift applies to the image's own transform layer while hit-testing
 * still covers the full visual (including the decorative overlays).
 */
export function useHeroParallax(
  containerRef: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === "undefined" || !window.matchMedia(HOVER_CAPABLE).matches) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let xTo: ((value: number) => void) | undefined;
    let yTo: ((value: number) => void) | undefined;

    function handleMove(e: PointerEvent) {
      if (!xTo || !yTo || !container) return;
      const rect = container.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      xTo(relX * MAX_SHIFT * 2);
      yTo(relY * MAX_SHIFT * 2);
    }

    function handleLeave() {
      xTo?.(0);
      yTo?.(0);
    }

    function activate() {
      import("@/src/lib/gsap-core").then(({ gsap }) => {
        if (cancelled) return;
        const el = target.current;
        if (!el) return;
        xTo = gsap.quickTo(el, "x", { duration: DURATION_FAST, ease: EASE_STANDARD });
        yTo = gsap.quickTo(el, "y", { duration: DURATION_FAST, ease: EASE_STANDARD });
        container!.addEventListener("pointermove", handleMove);
        container!.addEventListener("pointerleave", handleLeave);
      });
    }

    container.addEventListener("pointerenter", activate, { once: true });

    return () => {
      cancelled = true;
      container.removeEventListener("pointerenter", activate);
      container.removeEventListener("pointermove", handleMove);
      container.removeEventListener("pointerleave", handleLeave);
    };
  }, [containerRef, target]);
}
