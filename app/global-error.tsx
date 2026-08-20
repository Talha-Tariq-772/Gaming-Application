"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Catches an error in the ROOT layout itself (app/layout.tsx) — the one
 * case app/error.tsx can't cover, since a route-level error boundary
 * can't recover from a failure in something that wraps it. Must render
 * its own <html>/<body>: it fully replaces the root layout when active,
 * so nothing here can depend on it. Deliberately uses plain elements and
 * inline-safe classes only, not the Button component or next/font
 * variables — this is the last line of defense and shouldn't depend on
 * anything that might itself be part of what broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-4 text-center text-text antialiased">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-danger">
          Error
        </span>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-text-muted">
          A critical error occurred. Please try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
