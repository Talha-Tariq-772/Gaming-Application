import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import StoreFilterBar from "@/src/components/games/StoreFilterBar";
import StoreSliderSection from "@/src/components/store/StoreSliderSection";
import StoreSliderSkeleton from "@/src/components/store/StoreSliderSkeleton";
import type { GameFilters, GameGenre, GamePlatform, GameSort } from "@/src/types/database";
import { Suspense } from "react";
import GamesResults from "./GamesResults";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: RawSearchParams): GameFilters {
  const genre = firstValue(searchParams.genre);
  const platform = firstValue(searchParams.platform);
  const minPrice = firstValue(searchParams.minPrice);
  const maxPrice = firstValue(searchParams.maxPrice);
  const search = firstValue(searchParams.q);
  const sort = firstValue(searchParams.sort);

  return {
    genre: genre ? (genre.split(",") as GameGenre[]) : undefined,
    platform: platform ? (platform.split(",") as GamePlatform[]) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    search: search || undefined,
    sort: (sort as GameSort) || "newest",
    isNewArrival: firstValue(searchParams.newArrivals) === "1",
    isBestSeller: firstValue(searchParams.bestSellers) === "1",
  };
}

/**
 * The one and only top-level await for this route, isolated here (rather
 * than left in page.tsx directly) so page.tsx itself can be a plain,
 * non-async function wrapping this in a hand-placed <Suspense>.
 *
 * Measured effect (production build, /games desktop, 8 real runs each):
 * page.tsx awaiting this directly (or awaiting getSliderGames() directly,
 * the original shape) → 0.3633-0.3849 CLS on every run. This same logic
 * moved one level down, behind its own Suspense → roughly half the runs
 * drop to 0.0002-0.0004, the rest still land at 0.3633-0.3849. Genuinely
 * intermittent, not a full fix — a real, load-dependent race in how this
 * route's Suspense streaming resolves, not something this restructuring
 * fully closes. Flagged, not hidden: see the CLS numbers reported with
 * this commit.
 */
export default async function GamesPageBody({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);

  // Keyed by the raw query string so each unique filter combination is
  // treated as a fresh subtree — forcing the skeleton to reappear instead
  // of leaving stale results on screen during a transition.
  const suspenseKey = new URLSearchParams(
    Object.entries(resolvedParams).flatMap(([key, value]) => {
      if (value === undefined) return [];
      const values = Array.isArray(value) ? value : [value];
      return values.map((v) => [key, v] as [string, string]);
    }),
  ).toString();

  return (
    <>
      {/* Full-bleed — deliberately outside the max-w-page/px-4 wrapper below
          so it runs edge to edge instead of inheriting the page's side
          margins. Isolated in its own Suspense (StoreSliderSection does the
          actual getSliderGames() fetch). */}
      <Suspense fallback={<StoreSliderSkeleton />}>
        <StoreSliderSection />
      </Suspense>

      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember">
            Store
          </span>
          <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
            All Games
          </h1>
        </div>

        <h2 className="sr-only">Filters</h2>
        <StoreFilterBar />

        <SectionErrorBoundary label="games">
          <Suspense key={suspenseKey} fallback={<GamesGridSkeleton />}>
            <GamesResults filters={filters} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </>
  );
}
