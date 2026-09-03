"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { scrollTriggerAllowed } from "@/src/lib/motion-guards";
import { useGridCursorFollow } from "@/src/lib/use-grid-cursor-follow";

/**
 * The only client boundary in the Featured Games section — everything
 * else (the heading, the grid of GameCards) is server-rendered and passed
 * in as props/children. This component owns nothing but the two refs the
 * scroll-pin effect and the cursor-follow delegation need.
 *
 * Desktop (scrollTriggerAllowed): pins the section and drives the track's
 * x transform off vertical scroll — the classic pinned-horizontal-scroll
 * pattern, dynamic-imported from use-gsap.ts so ScrollTrigger only loads
 * for visitors who'll actually see it.
 *
 * Mobile / reduced motion: none of the above. The track is a plain
 * horizontally-scrollable flex row (native overflow-x + scroll-snap, no
 * JS, no pin) — this *is* the "mobile gets simple fade-ups only" rule for
 * a section that's fundamentally a scroll-linked effect: there's no
 * lesser scroll-triggered version of a pin, so it just becomes normal
 * content.
 */
export default function FeaturedGamesScroll({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGridCursorFollow(track);

  // Reserves the pin's scroll distance as ordinary layout height *before*
  // GSAP ever runs, using the same distance formula ScrollTrigger's own
  // pin-spacer will end up needing. Without this, that spacer only appears
  // once the dynamic import below resolves and ScrollTrigger.create() runs
  // — every layer between here and the actual page load, this container
  // sat at its natural (short) height, then jumped by the full pin
  // distance the moment the pin was created. That jump was the single
  // largest contributor to this page's CLS, worse than the route-loading
  // skeleton mismatch it was originally mistaken for. Synchronous
  // (useLayoutEffect, before paint) and gated the same way the pin itself
  // is, so mobile/reduced-motion never sets this and never had the problem
  // to begin with.
  useLayoutEffect(() => {
    if (!scrollTriggerAllowed()) return;
    const trackEl = track.current;
    const containerEl = container.current;
    if (!trackEl || !containerEl) return;

    const distance = trackEl.scrollWidth - containerEl.clientWidth;
    if (distance <= 0) return;

    containerEl.style.minHeight = `${containerEl.offsetHeight + distance}px`;
  }, []);

  useEffect(() => {
    if (!scrollTriggerAllowed()) return;

    const trackEl = track.current;
    const containerEl = container.current;
    if (!trackEl || !containerEl) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("@/src/lib/use-gsap").then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;

      // The layout effect above already inflated containerEl's own height
      // by `distance` (inline minHeight) to reserve scroll room before
      // GSAP was ready. ScrollTrigger's `pin: true` below builds its OWN
      // pin-spacer sized off containerEl's height AT THIS MOMENT, plus
      // another `distance` for the pin's scroll range — left in place,
      // the two stack into naturalHeight + distance*2, which measured out
      // to almost a full extra viewport of empty space after this
      // section. Clearing it here, synchronously before ScrollTrigger
      // measures anything and before the next paint, hands sizing off to
      // the pin-spacer with nothing left to double-count.
      containerEl.style.minHeight = "";

      const distance = trackEl.scrollWidth - containerEl.clientWidth;
      if (distance <= 0) return;

      const tween = gsap.to(trackEl, {
        x: -distance,
        ease: "none",
        scrollTrigger: {
          trigger: containerEl,
          start: "top top",
          end: () => `+=${distance}`,
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true,
        },
      });

      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        ScrollTrigger.refresh();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={container} className="mx-auto max-w-page px-4 py-24 md:px-8">
      {heading}
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:snap-none md:overflow-visible md:pb-0"
      >
        {children}
      </div>
    </div>
  );
}
