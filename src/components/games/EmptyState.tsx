import Button from "@/components/Button";
import { formatPrice } from "@/src/lib/format";
import { GAME_PLATFORM_LABELS } from "@/src/types/database";
import type { GameFilters } from "@/src/types/database";

/** Renders exactly which filters produced zero results — so "no games
 * match" is never a dead end the visitor has to guess their way out of. */
function describeFilters(filters: GameFilters): string[] {
  const parts: string[] = [];
  if (filters.genre && filters.genre.length > 0) parts.push(`Genre: ${filters.genre.join(", ")}`);
  if (filters.platform && filters.platform.length > 0) {
    parts.push(`Platform: ${filters.platform.map((p) => GAME_PLATFORM_LABELS[p]).join(", ")}`);
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice !== undefined ? formatPrice(filters.minPrice) : "Rs 0";
    const max = filters.maxPrice !== undefined ? formatPrice(filters.maxPrice) : "any";
    parts.push(`Price: ${min}–${max}`);
  }
  if (filters.isNewArrival) parts.push("New Arrivals");
  if (filters.isBestSeller) parts.push("Best Sellers");
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  return parts;
}

export default function EmptyState({
  resetHref,
  filters,
}: {
  resetHref: string;
  filters: GameFilters;
}) {
  const active = describeFilters(filters);

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-nova-bone">
          No games available right now
        </p>
        <p className="max-w-sm text-sm text-nova-ash">
          Check back soon — new titles are added regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
      <p className="font-display text-xl font-bold text-nova-bone">
        No games match your filters
      </p>
      <p className="max-w-md text-sm text-nova-ash">{active.join(" · ")}</p>
      <Button as="a" href={resetHref} variant="secondary">
        Clear filters
      </Button>
    </div>
  );
}
