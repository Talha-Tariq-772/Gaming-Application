import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import { formatPrice } from "@/src/lib/format";
import { priceDisplay } from "@/src/lib/price-display";
import { GAME_PLATFORM_LABELS } from "@/src/types/database";
import type { Game } from "@/src/types/database";
import Tag from "./Tag";

/**
 * Server component — no client JS of its own. The cursor-follow parallax
 * on the cover image is applied by a single delegated listener on the
 * grid container (see use-grid-cursor-follow.ts), not per-card; the
 * data-cursor-follow-target marker below is just how that listener finds
 * which card is under the pointer via closest(). Rendering 8+ of these in
 * a grid used to mean 8+ client-component boundaries hydrating for a
 * hover effect that can never even fire on the touch devices most of
 * those hydrations were for.
 */
export default function GameCard({
  game,
  priority = false,
}: {
  game: Game;
  /** First row of the grid should skip lazy-loading — it's the LCP
   * candidate on every catalog/results page, and lazy-loading it delays
   * LCP for no benefit since it's already above the fold. */
  priority?: boolean;
}) {
  const price = priceDisplay(game);

  return (
    <Link href={`/games/${game.slug}`} className="group flex flex-col gap-3">
      <NovaCard data-cursor-follow-target>
        <CardImage game={game} priority={priority} />
      </NovaCard>
      <div className="flex flex-col gap-1.5 transition-transform duration-(--duration-fast) ease-standard motion-reduce:transition-none group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
        <h3 className="line-clamp-2 font-sans text-[15px] font-semibold uppercase tracking-[0.06em] text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
          {game.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          {game.genre && <Tag>{game.genre}</Tag>}
          {game.platform && <Tag>{GAME_PLATFORM_LABELS[game.platform]}</Tag>}
        </div>
        {price && (
          <span className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-nova-bone">{price.label}</span>
            {price.wasPricePkr !== null && (
              <span className="text-xs text-nova-smoke line-through">
                {formatPrice(price.wasPricePkr)}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
