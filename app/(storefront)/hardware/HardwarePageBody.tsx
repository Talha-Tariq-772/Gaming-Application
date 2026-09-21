import { Suspense } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import HardwareCategoryBar from "@/src/components/hardware/HardwareCategoryBar";
import HardwareHero from "@/src/components/hardware/HardwareHero";
import { HARDWARE_CATEGORIES, type HardwareCategory, type HardwareFilters } from "@/src/types/database";
import HardwareResults from "./HardwareResults";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The category param reaches a PostgREST `.in()` filter, so it is
 * validated against the real enum rather than cast — an unrecognised
 * value becomes "no category filter", never a passthrough.
 */
function parseCategory(raw: string | undefined): HardwareCategory | null {
  if (!raw) return null;
  return HARDWARE_CATEGORIES.includes(raw as HardwareCategory) ? (raw as HardwareCategory) : null;
}

/**
 * The one and only top-level await for this route, isolated here (rather
 * than left in page.tsx directly) — same pattern as GiftCardsPageBody.
 */
export default async function HardwarePageBody({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const category = parseCategory(firstValue(resolvedParams.category));
  const inStockOnly = firstValue(resolvedParams.stock) === "in";
  const search = firstValue(resolvedParams.q) || undefined;

  const filters: HardwareFilters = {
    category: category ? [category] : undefined,
    inStockOnly,
    search,
    sort: "newest",
  };

  // Keyed by the resolved filters so each unique combination is treated
  // as a fresh subtree — same reasoning as GiftCardsPageBody.
  const suspenseKey = `${category ?? "all"}|${inStockOnly ? "in" : "any"}|${search ?? ""}`;

  return (
    <>
      {/* Full-bleed, outside the padded wrapper below — same technique as
          HomeHero and GiftCardsPageBody. */}
      <HardwareHero />

      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <h2 className="sr-only">Filters</h2>
        <HardwareCategoryBar active={category} inStockOnly={inStockOnly} />

        <SectionErrorBoundary label="hardware">
          <Suspense key={suspenseKey} fallback={<GamesGridSkeleton />}>
            <HardwareResults filters={filters} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </>
  );
}
