"use client";

import { useEffect, useState } from "react";

/**
 * Styleguide color swatches used to print a hardcoded hex string next to
 * each token. That went stale the moment nova-* tokens got light-mode
 * values (globals.css's `.light` block) — the swatch BOX already read its
 * color from `var(--color-nova-*)` and updated correctly per theme, but
 * the hex text below it was a static literal frozen at whatever the dark
 * value was, so light mode showed a light-colored box labeled with its
 * dark hex. Reads the real computed value instead, so it's automatically
 * correct for whichever theme (or hero lock, if this were ever used
 * inside one) is actually active — no per-theme hex pairs to keep in sync
 * by hand. `fallbackHex` is only what SSR/first paint show before this
 * effect runs, never a value this component trusts afterward.
 */
export default function SwatchHexLabel({
  varName,
  fallbackHex,
}: {
  varName: string;
  fallbackHex: string;
}) {
  const [hex, setHex] = useState(fallbackHex);

  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (raw) setHex(raw.toUpperCase());
  }, [varName]);

  return <>{hex}</>;
}
