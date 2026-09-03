"use client";

import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { gsapTweenEase } from "@/src/lib/motion";

const HOVER_CAPABLE = "(hover: hover) and (pointer: fine)";
const DURATION = 0.9;
const MAX_SHIFT_X = 20; // px
const MAX_SHIFT_Y = 12; // px

/**
 * Homepage hero figure pointer parallax (NovaFigureVisual). Gated exactly
 * like useMagneticHover/useGridCursorFollow/use-hero-parallax: nothing
 * attached at all under reduced motion or on touch/coarse-pointer devices,
 * gsap-core dynamic-imported only on the container's first real
 * pointerenter, one delegated pointermove listener on the container (not
 * the moving layer itself, so the hit area stays the full visual even once
 * the layer has shifted).
 *
 * A dedicated hook rather than reusing use-hero-parallax.ts — that one is
 * explicitly TEST-ONLY, wired to HeroVisualV2 (a comparison variant never
 * rendered by the live homepage), and tuned to a different spec (6px
 * uniform both axes, shifts WITH the pointer, DURATION_FAST/EASE_STANDARD
 * from the legacy motion-tokens.ts). Same reasoning NovaButton.tsx gives
 * for not reusing MagneticButton's useMagneticHover instead of its own
 * pointer-tracking effect: nova's tuning moves independently of a hook
 * other, unrelated components still depend on.
 *
 * Shift is OPPOSITE the pointer (negated before scaling) — the figure
 * leans away from the cursor, the standard parallax-depth illusion, not a
 * "follow the cursor" magnetic effect. GSAP's x/y shorthand only ever
 * touches `transform`, never a layout-affecting property, so this can't
 * reopen the hero's CLS budget.
 */
export function useFigureParallax(
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
      // relX/relY range -0.5..0.5, so *2 normalizes to -1..1 before
      // scaling by the per-axis max — negated so the figure moves
      // opposite the pointer, not with it.
      xTo(-relX * MAX_SHIFT_X * 2);
      yTo(-relY * MAX_SHIFT_Y * 2);
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
        xTo = gsap.quickTo(el, "x", { duration: DURATION, ease: gsapTweenEase.out });
        yTo = gsap.quickTo(el, "y", { duration: DURATION, ease: gsapTweenEase.out });
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
