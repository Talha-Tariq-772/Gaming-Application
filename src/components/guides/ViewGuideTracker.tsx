"use client";

import { useEffect } from "react";
import { track } from "@/src/lib/analytics";

/** Fires view_guide once per mount — see ViewGameTracker for why this is
 * a separate client leaf rather than called from the page itself. */
export default function ViewGuideTracker({
  guideSlug,
  category,
}: {
  guideSlug: string;
  category: string;
}) {
  useEffect(() => {
    track("view_guide", { guideSlug, category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideSlug]);

  return null;
}
