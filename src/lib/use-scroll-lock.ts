"use client";

import { useEffect } from "react";
import { getLenisInstance } from "@/src/lib/lenis-instance";

/**
 * Module-level (not per-hook-instance) so two overlays open at once —
 * e.g. OrderDetailPanel with ApproveConfirmDialog stacked on top of it,
 * both call this — don't unlock scroll the moment the inner one closes
 * while the outer one is still open. Only the last lock releasing
 * actually restores scroll.
 */
let lockCount = 0;
let savedScrollY = 0;

/**
 * Read by SmoothScrollProvider immediately after constructing a new Lenis
 * instance — closes a real race: opening a dialog is often the page's
 * very first interaction, which is also what lazily instantiates Lenis
 * (see that file). Measured via Playwright: the "lenis" class lands on
 * <html> ~15-20ms after the triggering click, strictly after this hook's
 * effect has already run and found getLenisInstance() returning null —
 * so the stop() call in this hook is a no-op for that instance, and a
 * freshly-constructed Lenis starts un-stopped by default. SmoothScrollProvider
 * checks this function in the same synchronous stretch of code that just
 * built the instance (no `await` in between), so no wheel/touch event can
 * land in the gap — provably closes the race, not just narrows it.
 */
export function isScrollLocked(): boolean {
  return lockCount > 0;
}

/**
 * Locks page scroll while `isOpen` is true. Two layers:
 *
 * - `position: fixed` on <body>, top offset by the current scrollY, left/
 *   right pinned to 0. This is the actual, load-bearing lock — verified
 *   (see the report accompanying this change) that `overflow: clip` on
 *   documentElement, despite computing correctly, does NOT reliably block
 *   wheel, keyboard, or programmatic scrollTo() in this Chromium version:
 *   scrollTo() went through 100% of the time, and even wheel/keyboard
 *   went through on repeated input. Taking body out of normal flow
 *   removes the scrollable surface itself, which blocks every input
 *   method uniformly — wheel, touch, keyboard (space/Home/End/PageUp/
 *   PageDown/arrows), scrollbar drag, and scrollTo() — with no per-key or
 *   per-input special-casing, and correctly stops iOS Safari's rubber-band
 *   overscroll of the body, which preventDefault-based approaches don't
 *   reliably do. Unlock restores the exact saved scrollY in one
 *   non-animated jump — this is the "jump to top" trick's failure mode
 *   from being *skipped* (no restore step at all), not from being used;
 *   done correctly, restoring the saved position is the entire point.
 * - `overflow: clip` on documentElement, kept alongside as defense in
 *   depth (harmless, and it's what collapses documentElement's own
 *   scrollHeight once body is out of flow) — but not relied on alone
 *   anymore.
 * - Lenis's own stop()/start(): once active, Lenis eases scroll over
 *   several animation frames. Without pausing it, a wheel/touch delta
 *   captured right as the overlay opens can leave Lenis mid-animation
 *   toward a stale target, producing a visible jump the moment it's
 *   unlocked. stop() resets Lenis's target to its current actual
 *   position instead.
 */
export function useScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;

    lockCount += 1;
    if (lockCount === 1) {
      savedScrollY = window.scrollY;
      document.documentElement.style.setProperty("overflow", "clip");
      const body = document.body.style;
      body.position = "fixed";
      body.top = `-${savedScrollY}px`;
      body.left = "0";
      body.right = "0";
    }
    getLenisInstance()?.stop();

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.documentElement.style.removeProperty("overflow");
        const body = document.body.style;
        body.position = "";
        body.top = "";
        body.left = "";
        body.right = "";
        window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
        getLenisInstance()?.start();
      }
    };
  }, [isOpen]);
}
