import GameCard from "@/src/components/games/GameCard";
import FeaturedGamesScroll from "@/src/components/home/FeaturedGamesScroll";
import { getGames } from "@/src/lib/catalog";

const BEST_SELLERS_COUNT = 8;

/**
 * Same isolation pattern as FeaturedGames — own fetch, own Suspense
 * boundary in page.tsx, renders nothing if the flag hasn't been set on
 * any game yet rather than an empty heading or empty carousel.
 *
 * Sorted by title, not a sales-rank field: is_best_seller is a plain
 * boolean flag (no units-sold or manual rank column exists to order by),
 * and this catalog has no real completed-sale volume yet to derive one
 * from honestly. Alphabetical is a deterministic, non-misleading order
 * rather than implying a ranking ("first" looking like "best-selling")
 * that doesn't exist yet.
 */
export default async function BestSellers() {
  const games = await getGames({ isBestSeller: true, sort: "name" });
  const bestSellers = games.slice(0, BEST_SELLERS_COUNT);

  if (bestSellers.length === 0) return null;

  return (
    <section aria-label="Best sellers" className="overflow-hidden">
      <FeaturedGamesScroll
        heading={
          <h2 className="mb-8 font-display text-2xl font-bold text-nova-bone">
            Best Sellers
          </h2>
        }
      >
        {bestSellers.map((game) => (
          <div key={game.id} className="w-56 shrink-0 snap-start sm:w-64">
            <GameCard game={game} />
          </div>
        ))}
      </FeaturedGamesScroll>
    </section>
  );
}
