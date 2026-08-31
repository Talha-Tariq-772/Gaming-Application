import GameCard from "@/src/components/games/GameCard";
import FeaturedGamesScroll from "@/src/components/home/FeaturedGamesScroll";
import { getGames } from "@/src/lib/catalog";

const FEATURED_COUNT = 8;
/** Matches GamesResults' ABOVE_FOLD_COUNT convention — the cards visible
 * without scrolling the row (or the page) get eager/high-priority images;
 * every card past this point, and every card in the rows below this one
 * (Best Sellers, New Arrivals), stays lazy. */
const EAGER_COUNT = 4;

/**
 * Fetches its own data (rather than receiving `games` as a prop from
 * page.tsx) specifically so it can be wrapped in its own <Suspense> +
 * SectionErrorBoundary — the hero renders immediately regardless of how
 * long this takes or whether it fails, instead of the whole homepage
 * blocking on/crashing from one section's fetch. Same isolation pattern
 * as GamesResults and GuidesResults.
 */
export default async function FeaturedGames() {
  const games = await getGames();
  const featured = games.slice(0, FEATURED_COUNT);

  if (featured.length === 0) return null;

  return (
    <section aria-label="Featured games" className="overflow-hidden">
      <FeaturedGamesScroll
        // Single fluid size (--text-heading, globals.css), not a
        // breakpoint jump to text-3xl — see Session 7's typography pass.
        heading={
          <h2 className="mb-8 font-display text-2xl font-bold text-nova-bone">
            Featured
          </h2>
        }
      >
        {featured.map((game, i) => (
          <div key={game.id} className="w-56 shrink-0 snap-start sm:w-64">
            <GameCard game={game} priority={i < EAGER_COUNT} />
          </div>
        ))}
      </FeaturedGamesScroll>
    </section>
  );
}
