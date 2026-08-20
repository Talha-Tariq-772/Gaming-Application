import Button from "@/components/Button";

export default function EmptyState({
  resetHref,
  hasFilters = true,
}: {
  resetHref: string;
  /** False when the catalog is empty outright (not just empty for the
   * current filter combination) — a different message, and no "reset
   * filters" action since there's nothing to reset to. */
  hasFilters?: boolean;
}) {
  if (!hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface-1 px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-text">
          No games available right now
        </p>
        <p className="max-w-sm text-sm text-text-muted">
          Check back soon — new titles are added regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface-1 px-6 py-24 text-center">
      <p className="font-display text-xl font-bold text-text">
        No games match your filters
      </p>
      <p className="max-w-sm text-sm text-text-muted">
        Try widening your price range, clearing a genre or platform, or
        searching for something else.
      </p>
      <Button as="a" href={resetHref} variant="secondary">
        Reset filters
      </Button>
    </div>
  );
}
