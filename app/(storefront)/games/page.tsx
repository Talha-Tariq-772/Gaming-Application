import type { Metadata } from "next";
import { Suspense } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import StoreFilterBar from "@/src/components/games/StoreFilterBar";
import StoreSlider from "@/src/components/store/StoreSlider";
import { getSliderGames } from "@/src/lib/catalog";
import type {
  GameFilters,
  GameGenre,
  GamePlatform,
  GameSort,
} from "@/src/types/database";
import GamesResults from "./GamesResults";

const TITLE = "Store";
const DESCRIPTION = "Browse the full Nova catalog.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/games",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
    url: "/games",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
  },
};

type RawSearchParams = Record<string, string | string[] | undefined>;

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

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);
  const sliderGames = await getSliderGames();

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
          margins. */}
      <StoreSlider games={sliderGames} />

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
