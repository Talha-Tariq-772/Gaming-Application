"use client";

import { useEffect } from "react";
import { track } from "@/src/lib/analytics";

/**
 * Fires view_game once per mount. The game detail page is a Server
 * Component (it needs generateMetadata + generateStaticParams), so this
 * tiny client leaf is what actually calls track() — same pattern as
 * ViewGuideTracker.
 */
export default function ViewGameTracker({
  gameId,
  genre,
  platform,
}: {
  gameId: string;
  genre: string;
  platform: string | null;
}) {
  useEffect(() => {
    track("view_game", { gameId, genre, platform });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return null;
}
