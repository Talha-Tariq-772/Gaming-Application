import GameCard from "@/src/components/games/GameCard";
import FeaturedGamesScroll from "@/src/components/home/FeaturedGamesScroll";
import { getGames } from "@/src/lib/catalog";
import type { Game } from "@/src/types/database";

const NEW_ARRIVALS_COUNT = 8;

/** release_date descending, nulls last — getGames' `sort` enum has no
 * release-date option (only created_at/price/title), and this catalog is
 * small enough that sorting the already-filtered result client-side costs
 * nothing worth a new server-side sort mode for. */
function byReleaseDateDesc(a: Game, b: Game): number {
  if (a.releaseDate === null && b.releaseDate === null) return 0;
  if (a.releaseDate === null) return 1;
  if (b.releaseDate === null) return -1;
  return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
}

/** Same isolation pattern as FeaturedGames/BestSellers — own fetch, own
 * Suspense boundary, renders nothing if is_new_arrival isn't set on any
 * game yet. */
export default async function NewArrivals() {
  const games = await getGames({ isNewArrival: true });
  const newArrivals = [...games].sort(byReleaseDateDesc).slice(0, NEW_ARRIVALS_COUNT);

  if (newArrivals.length === 0) return null;

  return (
    <section aria-label="New arrivals" className="overflow-hidden">
      <FeaturedGamesScroll
        heading={
          <h2 className="mb-8 font-display text-2xl font-bold text-nova-bone">
            New Arrivals
          </h2>
        }
      >
        {newArrivals.map((game) => (
          <div key={game.id} className="w-56 shrink-0 snap-start sm:w-64">
            <GameCard game={game} />
          </div>
        ))}
      </FeaturedGamesScroll>
    </section>
  );
}
