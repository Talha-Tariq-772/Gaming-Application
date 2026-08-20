"use client";

import { useEffect } from "react";

/**
 * Guarantees FAQ deep-linking works everywhere: on mount and on
 * hashchange, opens the <details id="..."> matching the URL fragment and
 * scrolls it into view. Newer browsers can already auto-expand a
 * <details> on fragment navigation into its hidden content, but support
 * isn't universal — this makes the "send someone straight to an answer"
 * use case reliable regardless of browser, without depending on that.
 * Renders nothing; it's a functional deep-link fixup, not UI.
 */
export default function FaqHashSync() {
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const el = document.getElementById(hash);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
