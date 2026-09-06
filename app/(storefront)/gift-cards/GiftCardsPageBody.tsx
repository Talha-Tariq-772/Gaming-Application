import { Suspense } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import GiftCardFilterBar from "@/src/components/gift-cards/GiftCardFilterBar";
import type { GiftCardFilters, GiftCardPlatform, GiftCardRegion, GiftCardSort } from "@/src/types/database";
import GiftCardsResults from "./GiftCardsResults";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: RawSearchParams): GiftCardFilters {
  const platform = firstValue(searchParams.platform);
  const region = firstValue(searchParams.region);
  const search = firstValue(searchParams.q);
  const sort = firstValue(searchParams.sort);

  return {
    platform: platform ? (platform.split(",") as GiftCardPlatform[]) : undefined,
    region: region ? (region.split(",") as GiftCardRegion[]) : undefined,
    search: search || undefined,
    sort: (sort as GiftCardSort) || "newest",
  };
}

/**
 * The one and only top-level await for this route, isolated here (rather
 * than left in page.tsx directly) — same pattern as GamesPageBody.
 */
export default async function GiftCardsPageBody({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);

  // Keyed by the raw query string so each unique filter combination is
  // treated as a fresh subtree — same reasoning as GamesPageBody.
  const suspenseKey = new URLSearchParams(
    Object.entries(resolvedParams).flatMap(([key, value]) => {
      if (value === undefined) return [];
      const values = Array.isArray(value) ? value : [value];
      return values.map((v) => [key, v] as [string, string]);
    }),
  ).toString();

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">
          Gift Cards
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          Platform Gift Cards
        </h1>
      </div>

      <h2 className="sr-only">Filters</h2>
      <GiftCardFilterBar />

      <SectionErrorBoundary label="gift cards">
        <Suspense key={suspenseKey} fallback={<GamesGridSkeleton />}>
          <GiftCardsResults filters={filters} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}
