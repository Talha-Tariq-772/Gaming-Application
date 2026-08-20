/**
 * Generic route-level loading.tsx fallback — shown briefly on navigation
 * before the page's own (usually more specific) inner Suspense fallback
 * takes over. Deliberately plain: it only needs to give instant feedback
 * that navigation happened, not match the destination page's exact
 * layout.
 */
export default function PageLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-page px-4 py-16 md:px-8"
    >
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-4">
        <div className="h-4 w-24 rounded bg-surface-2" />
        <div className="h-10 w-2/3 rounded bg-surface-2" />
        <div className="mt-8 h-64 rounded-lg bg-surface-1" />
      </div>
    </div>
  );
}
