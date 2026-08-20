"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

  useEffect(() => {
    if (!scrollTriggerAllowed()) return;

    const trackEl = track.current;
    const containerEl = container.current;
    if (!trackEl || !containerEl) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("@/src/lib/use-gsap").then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;

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
