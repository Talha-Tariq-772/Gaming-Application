import EmptyState from "@/src/components/games/EmptyState";
import GameCard from "@/src/components/games/GameCard";
import CursorFollowGrid from "@/src/components/motion/CursorFollowGrid";
import ScrollReveal from "@/src/components/motion/ScrollReveal";
import { getGames } from "@/src/lib/catalog";
import type { GameFilters } from "@/src/types/database";

/** Matches the first grid row at the widest breakpoint (xl:grid-cols-4) —
 * these are above the fold on load, so they render immediately (also the
 * LCP-priority cards in GameCard) instead of via ScrollReveal, which would
 * otherwise delay their own paint for no visual benefit. */
const ABOVE_FOLD_COUNT = 4;

/**
 * Isolated in its own async Server Component (rather than inlined in
 * page.tsx) so the Suspense boundary wrapping it doesn't also cover the
 * filter sidebar — filters stay interactive while only the grid re-suspends.
 */
export default async function GamesResults({
  filters,
}: {
  filters: GameFilters;
}) {
  const games = await getGames(filters);

  if (games.length === 0) {
    const hasFilters = Boolean(
      filters.search ||
        (filters.genre && filters.genre.length > 0) ||
        (filters.platform && filters.platform.length > 0) ||
        filters.minPrice !== undefined ||
        filters.maxPrice !== undefined,
    );
    return <EmptyState resetHref="/games" hasFilters={hasFilters} />;
  }

  const aboveFold = games.slice(0, ABOVE_FOLD_COUNT);
  const rest = games.slice(ABOVE_FOLD_COUNT);

  return (
    <>
      {/* The visible "Filters" h2 lives in the sidebar, which is hidden
          below the lg breakpoint — this keeps h1 -> h2 -> h3 (game title)
          intact at every viewport instead of just on desktop. */}
      <h2 className="sr-only">Results</h2>
      <CursorFollowGrid className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {aboveFold.map((game) => (
          <GameCard key={game.id} game={game} priority />
        ))}
        {rest.length > 0 && (
          <ScrollReveal className="contents" stagger>
            {rest.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </ScrollReveal>
        )}
      </CursorFollowGrid>
    </>
  );
}
