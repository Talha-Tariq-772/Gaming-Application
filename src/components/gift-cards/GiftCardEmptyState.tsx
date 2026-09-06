import Button from "@/components/Button";
import { GIFT_CARD_PLATFORM_LABELS, GIFT_CARD_REGION_LABELS } from "@/src/types/database";
import type { GiftCardFilters } from "@/src/types/database";

/** Mirrors src/components/games/EmptyState.tsx — renders exactly which
 * filters produced zero results. */
function describeFilters(filters: GiftCardFilters): string[] {
  const parts: string[] = [];
  if (filters.platform && filters.platform.length > 0) {
    parts.push(`Platform: ${filters.platform.map((p) => GIFT_CARD_PLATFORM_LABELS[p]).join(", ")}`);
  }
  if (filters.region && filters.region.length > 0) {
    parts.push(`Region: ${filters.region.map((r) => GIFT_CARD_REGION_LABELS[r]).join(", ")}`);
  }
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  return parts;
}

export default function GiftCardEmptyState({
  resetHref,
  filters,
}: {
  resetHref: string;
  filters: GiftCardFilters;
}) {
  const active = describeFilters(filters);

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-nova-bone">
          No gift cards available right now
        </p>
        <p className="max-w-sm text-sm text-nova-ash">
          Check back soon — new denominations and platforms are added regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
      <p className="font-display text-xl font-bold text-nova-bone">
        No gift cards match your filters
      </p>
      <p className="max-w-md text-sm text-nova-ash">{active.join(" · ")}</p>
      <Button as="a" href={resetHref} variant="secondary">
        Clear filters
      </Button>
    </div>
  );
}
