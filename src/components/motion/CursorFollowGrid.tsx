"use client";

import { useRef, type ReactNode } from "react";
import { useGridCursorFollow } from "@/src/lib/use-grid-cursor-follow";

/**
 * Generic reusable wrapper: owns the one ref+listener the delegated
 * cursor-follow effect needs for a grid of GameCards, renders nothing of
 * its own beyond that — className/children are just passed through, so
 * this slots in wherever a plain grid <div> used to be.
 */
export default function CursorFollowGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGridCursorFollow(ref);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
