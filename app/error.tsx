"use client";

import { useEffect } from "react";
import Button from "@/components/Button";

/**
 * Route-level error boundary — catches anything an uncaught error in a
 * page or layout below the root throws. Never renders error.message or
 * error.stack: Next's own dev overlay already surfaces full detail in
 * development, so this UI is identical in every environment and never
 * leaks internals in production. Logs to console for now; swap for a
 * real error-tracking call when one exists.
 */
export default function Error({
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
    <main
      id="main-content"
      className="mx-auto flex max-w-page flex-col items-center justify-center gap-6 px-4 py-48 text-center md:px-8"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-danger">
        Error
      </span>
      <h1 className="text-display-sm font-display font-extrabold text-text">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-text-muted">
        We hit an unexpected error loading this page. Try again, or head
        back to the store.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Button as="a" href="/games" variant="secondary">
          Back to Store
        </Button>
      </div>
    </main>
  );
}
