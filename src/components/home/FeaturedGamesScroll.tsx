"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGridCursorFollow } from "@/src/lib/use-grid-cursor-follow";

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={direction === "left" ? "" : "rotate-180"}
    >
      <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same pill treatment as StoreSlider's prev/next controls
// (src/components/store/StoreSlider/StoreSlider.tsx's CONTROL_BUTTON_CLASSES)
// so every arrow-driven carousel in the app reads as one control, not two.
const ARROW_BUTTON_CLASSES =
  "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-nova-hairline bg-nova-void/80 text-nova-bone backdrop-blur-sm transition-opacity duration-(--duration-fast) ease-standard hover:border-nova-ember/60 hover:text-nova-ember-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember";

// Two complete, mutually-exclusive class strings (never both present on
// the same element) rather than one base string plus a conditionally
// -added override — mixing an unprefixed `opacity-0` with `md:opacity-0
// md:group-hover/row:opacity-100` on the same button lets Tailwind's
// generation order (not the order these classes are written here) decide
// which wins, which is exactly the kind of hover-vs-disabled flicker this
// needs to not have.
const ARROW_HIDDEN_CLASSES = "pointer-events-none opacity-0";
const ARROW_VISIBLE_CLASSES =
  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100";

// How much of the visible track width one arrow click advances — under
// 100% so the card sitting at the edge stays partly visible as a "there's
// more" cue instead of jumping a clean page at a time.
const SCROLL_FRACTION = 0.9;
// Treated as "at the edge" within this many px, since scrollWidth/clientWidth
// can disagree with scrollLeft by a sub-pixel rounding amount that would
// otherwise leave an arrow permanently enabled one px past the real end.
const EDGE_EPSILON = 2;

/**
 * A plain horizontally-scrollable row (native overflow-x + scroll-snap)
 * with explicit prev/next arrow buttons — what Featured/Best
 * Sellers/New Arrivals (home/*.tsx) and RelatedGamesRow all render their
 * card track through.
 *
 * This replaces an earlier GSAP ScrollTrigger pinned-horizontal-scroll
 * version. That approach hijacked page scroll to drive the row's x
 * transform and needed a hand-rolled height reservation
 * (see git history) to avoid CLS — twice, across two sessions, the pin
 * handoff between this section and the next broke: first as dead space
 * between rows, then as this row visually overlapping the next mid-scroll.
 * Both were the same root cause (page-scroll hijacking three independent
 * pinned sections back to back is inherently fragile), so rather than
 * patch a third symptom, the mechanism itself is gone — no ScrollTrigger,
 * no pin, no scroll-distance math. Native overflow-x scrolling can't
 * desync from the page the pin did, because it never touches page scroll
 * at all.
 */
export default function FeaturedGamesScroll({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useGridCursorFollow(track);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    function updateEdges() {
      const trackEl = track.current;
      if (!trackEl) return;
      setAtStart(trackEl.scrollLeft <= EDGE_EPSILON);
      setAtEnd(trackEl.scrollLeft >= trackEl.scrollWidth - trackEl.clientWidth - EDGE_EPSILON);
    }

    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });

    // Card count/track width can change after mount (images loading in,
    // responsive width shifts) — a ResizeObserver catches those without
    // needing children as an effect dependency.
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, []);

  function scrollByDirection(direction: "left" | "right") {
    const el = track.current;
    if (!el) return;
    const amount = el.clientWidth * SCROLL_FRACTION * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {heading}
      {/* group/row: arrows fade in on hover/focus at md+ only (mouse-driven
          desktop); below md they're always visible, since touch has no
          hover state and swipe alone doesn't hint that arrows exist. */}
      <div className="group/row relative">
        <div
          ref={track}
          className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4"
        >
          {children}
        </div>

        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByDirection("left")}
          disabled={atStart}
          className={`left-1 ${ARROW_BUTTON_CLASSES} ${atStart ? ARROW_HIDDEN_CLASSES : ARROW_VISIBLE_CLASSES}`}
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByDirection("right")}
          disabled={atEnd}
          className={`right-1 ${ARROW_BUTTON_CLASSES} ${atEnd ? ARROW_HIDDEN_CLASSES : ARROW_VISIBLE_CLASSES}`}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  );
}
