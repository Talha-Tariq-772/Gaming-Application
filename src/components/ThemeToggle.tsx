"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * useTheme()'s `resolvedTheme` is undefined on the server and on the
 * client's very first render (next-themes only knows the real value after
 * its blocking inline script + the provider's own effect have run) — same
 * SSR-vs-client-truth gap useHydrated() exists to paper over elsewhere in
 * this app (see that file's comment). Rendering the icon before that would
 * either guess wrong or mismatch the server markup, so this gates on its
 * own `mounted` flag (the pattern next-themes' own docs recommend) rather
 * than reusing useHydrated, since what's being awaited here is next-themes'
 * own effect, not a Zustand persist rehydration.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-nova-hairline bg-nova-crypt text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/40"
    >
      {/* Both icons always render (never conditionally mounted) so the
          button's hit target and hydration output never depend on
          `mounted` — only which icon is visible does, via opacity/scale,
          which is purely decorative and can't itself cause a mismatch.
          Sun shows when light is active (clicking switches TO dark), moon
          shows when dark is active (clicking switches TO light) — each
          icon depicts the CURRENT theme, not the target. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`absolute h-5 w-5 transition-all duration-(--duration-fast) ease-standard ${
          isDark ? "scale-50 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={`absolute h-5 w-5 transition-all duration-(--duration-fast) ease-standard ${
          isDark ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <path d="M20.7 14.9A8.5 8.5 0 1 1 9.1 3.3a7 7 0 1 0 11.6 11.6Z" />
      </svg>
      <span className="sr-only" role="status" aria-live="polite">
        {mounted ? `${isDark ? "Dark" : "Light"} theme active` : ""}
      </span>
    </button>
  );
}
