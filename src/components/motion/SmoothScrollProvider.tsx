"use client";

import { useEffect } from "react";
import { setLenisInstance } from "@/src/lib/lenis-instance";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { isScrollLocked } from "@/src/lib/use-scroll-lock";

const ACTIVATION_EVENTS = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
/** Fallback if the user never interacts (e.g. arrives via scrollbar drag
 * only, or an automated crawler) — still initializes eventually. */
const ACTIVATION_FALLBACK_MS = 4000;

/**
 * Mounted once at the root layout, so it runs on every route. gsap and
 * lenis are pulled in via dynamic import() (not a static top-level import)
 * so they never enter any route's initial JS payload, and the import is
 * only kicked off on the user's first real interaction — not on mount,
 * not on requestIdleCallback. A page's cold load (which is all Lighthouse
 * measures) never pays gsap/lenis's parse+eval cost, only a user who's
 * actually about to scroll does. First interaction is deliberately broad
 * (pointer, wheel, touch, key) so it fires slightly before an actual
 * scroll gesture lands, giving Lenis a moment to init first.
 *
 * Skips Lenis entirely under prefers-reduced-motion — native scroll jumps
 * straight to target instead of easing, which is the reduced-motion-safe
 * behavior, and ScrollTrigger still works fine against native scroll.
 */
export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function activate() {
      removeActivationListeners();
      clearTimeout(fallbackTimer);

      const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("@/src/lib/use-gsap"),
      ]);
      if (cancelled) return;

      const lenis = new Lenis({ autoRaf: false });
      lenis.on("scroll", ScrollTrigger.update);
      setLenisInstance(lenis);
      // Closes the race where a dialog opens as the page's first
      // interaction — the same interaction that triggered this activate()
      // call. useScrollLock's effect already ran by now (it's synchronous
      // with the click; this dynamic import is not) and could only find
      // getLenisInstance() returning null, so its own stop() call was a
      // no-op. Checking here, in the same synchronous stretch of code that
      // just constructed the instance (no `await` before this line and
      // the next), means no wheel/touch event can land in between —
      // provably, not just probably, closes the gap.
      if (isScrollLocked()) lenis.stop();

      function onTick(time: number) {
        lenis.raf(time * 1000);
      }
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        setLenisInstance(null);
        gsap.ticker.remove(onTick);
        lenis.destroy();
      };
    }

    function removeActivationListeners() {
      for (const event of ACTIVATION_EVENTS) {
        window.removeEventListener(event, activate);
      }
    }

    for (const event of ACTIVATION_EVENTS) {
      window.addEventListener(event, activate, { once: true, passive: true });
    }
    const fallbackTimer = setTimeout(activate, ACTIVATION_FALLBACK_MS);

    return () => {
      cancelled = true;
      removeActivationListeners();
      clearTimeout(fallbackTimer);
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
