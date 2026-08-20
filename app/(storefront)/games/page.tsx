import type { Metadata } from "next";
import { Suspense } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import CatalogFilters from "@/src/components/games/CatalogFilters";
import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import MobileFiltersSheet from "@/src/components/games/MobileFiltersSheet";
import SortSelect from "@/src/components/games/SortSelect";
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
  };
}

export default async function GamesPage({
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
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Store
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-text">
          All Games
        </h1>
      </div>

      <div className="grid gap-12 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <h2 className="mb-6 font-display text-lg font-bold text-text">
            Filters
          </h2>
          <CatalogFilters />
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <MobileFiltersSheet />
            <SortSelect />
          </div>

          <SectionErrorBoundary label="games">
            <Suspense key={suspenseKey} fallback={<GamesGridSkeleton />}>
              <GamesResults filters={filters} />
            </Suspense>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
