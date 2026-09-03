"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Wraps next-themes so app/layout.tsx (a Server Component) never imports
 * from "next-themes" directly — that package's provider carries its own
 * "use client" boundary internally, but re-exporting it through our own
 * thin client component keeps the import graph explicit and matches every
 * other provider in layout.tsx (AuthProvider, AnalyticsConsentProvider).
 *
 * attribute="class": next-themes toggles a "light"/"dark" class on <html>
 * (not a data-* attribute) — globals.css's light-mode overrides target
 * `.light` selectors to match. defaultTheme="system" + enableSystem: no
 * theme choice is forced; a first-time visitor gets their OS preference.
 * Once someone explicitly picks a theme (ThemeToggle), next-themes persists
 * it to localStorage itself and that choice wins over the system preference
 * on every future visit — nothing else in this app needs to manage that.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
