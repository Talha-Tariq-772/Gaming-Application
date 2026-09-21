import Button from "@/components/Button";
import { HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import type { HardwareFilters } from "@/src/types/database";

/** Mirrors GiftCardEmptyState — renders exactly which filters produced
 * zero results, rather than a generic "nothing found". */
function describeFilters(filters: HardwareFilters): string[] {
  const parts: string[] = [];
  if (filters.category && filters.category.length > 0) {
    parts.push(`Category: ${filters.category.map((c) => HARDWARE_CATEGORY_LABELS[c]).join(", ")}`);
  }
  if (filters.inStockOnly) parts.push("In stock only");
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  return parts;
}

export default function HardwareEmptyState({
  resetHref,
  filters,
}: {
  resetHref: string;
  filters: HardwareFilters;
}) {
  const active = describeFilters(filters);

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-nova-bone">
          No hardware available right now
        </p>
        <p className="max-w-sm text-sm text-nova-ash">
          Check back soon &mdash; consoles, controllers and accessories are restocked regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
      <p className="font-display text-xl font-bold text-nova-bone">
        No hardware matches your filters
      </p>
      <p className="max-w-md text-sm text-nova-ash">{active.join(" · ")}</p>
      <Button as="a" href={resetHref} variant="secondary">
        Clear filters
      </Button>
    </div>
  );
}
