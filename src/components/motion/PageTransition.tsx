"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DURATION_BASE, EASE_STANDARD, FADE_UP_Y } from "@/src/lib/motion-tokens";

/**
 * Rendered from app/template.tsx, which Next remounts on every navigation
 * (unlike layout.tsx, which persists) — that remount is what gives this an
 * "enter" animation to hook per route. There's no matching exit animation:
 * the App Router unmounts the old tree synchronously on navigation with no
 * hook to animate it out first, short of the experimental View Transitions
 * API. A fade+y-shift on enter is the standard tradeoff for GSAP-driven
 * route transitions here.
 *
 * Skips the very first mount of a session (the cold page load, before any
 * client-side navigation has happened) both because there's nothing to
 * transition *from* on a hard load, and because it means gsap doesn't need
 * to be fetched until the user actually navigates — the first paint of any
 * page never pays for it. gsap is dynamic-import()ed rather than statically
 * imported for the same reason this component sits in the root template:
 * a static import here would put gsap in every route's initial bundle.
 */
let hasEnteredOnce = false;

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasEnteredOnce) {
      hasEnteredOnce = true;
      return;
    }
    if (prefersReducedMotion()) return;

    let cancelled = false;
    import("@/src/lib/gsap-core").then(({ gsap }) => {
      if (cancelled) return;
      gsap.fromTo(
        scope.current,
        { opacity: 0, y: FADE_UP_Y },
        { opacity: 1, y: 0, duration: DURATION_BASE, ease: EASE_STANDARD }
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={scope}>{children}</div>;
}
