"use client";

import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DURATION_FAST, EASE_STANDARD } from "@/src/lib/motion-tokens";

const HOVER_CAPABLE = "(hover: hover) and (pointer: fine)";
const MAX_SHIFT = 8; // px, each axis
const TARGET_SELECTOR = "[data-cursor-follow-target]";

/**
 * Delegated cursor-follow for a grid of cards: ONE pointermove listener on
 * the grid container, not one per card. Resolves the hovered card via
 * event.target.closest(TARGET_SELECTOR) and animates its <img>, so
 * GameCard itself never needs to be a client component for this.
 *
 * Same gating as every other hover effect in this app: checked before
 * anything is attached, so touch/coarse-pointer devices set up nothing,
 * and gsap-core is only dynamic-imported on the container's first
 * pointerenter (once, shared by every card under it — not once per card).
 */
export function useGridCursorFollow(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === "undefined" || !window.matchMedia(HOVER_CAPABLE).matches) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let gsapCore: typeof import("@/src/lib/gsap-core") | undefined;
    let activeImg: HTMLElement | null = null;
    let xTo: ((value: number) => void) | undefined;
    let yTo: ((value: number) => void) | undefined;

    function resetActive() {
      xTo?.(0);
      yTo?.(0);
      activeImg = null;
      xTo = undefined;
      yTo = undefined;
    }

    function activateTarget(img: HTMLElement) {
      if (!gsapCore) return;
      activeImg = img;
      xTo = gsapCore.gsap.quickTo(img, "x", { duration: DURATION_FAST, ease: EASE_STANDARD });
      yTo = gsapCore.gsap.quickTo(img, "y", { duration: DURATION_FAST, ease: EASE_STANDARD });
    }

    function handleMove(e: PointerEvent) {
      if (!gsapCore) return;
      const card = (e.target as HTMLElement)?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      const img = card?.querySelector("img") as HTMLElement | null;

      if (!card || !img) {
        if (activeImg) resetActive();
        return;
      }
      if (img !== activeImg) {
        if (activeImg) resetActive();
        activateTarget(img);
      }

      const rect = card.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      xTo?.(relX * MAX_SHIFT * 2);
      yTo?.(relY * MAX_SHIFT * 2);
    }

    function handleLeaveContainer() {
      if (activeImg) resetActive();
    }

    function activate() {
      import("@/src/lib/gsap-core").then((mod) => {
        if (cancelled) return;
        gsapCore = mod;
        container!.addEventListener("pointermove", handleMove);
        container!.addEventListener("pointerleave", handleLeaveContainer);
      });
    }

    container.addEventListener("pointerenter", activate, { once: true });

    return () => {
      cancelled = true;
      container.removeEventListener("pointerenter", activate);
      container.removeEventListener("pointermove", handleMove);
      container.removeEventListener("pointerleave", handleLeaveContainer);
    };
  }, [containerRef]);
}
