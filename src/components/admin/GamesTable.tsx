import { formatPrice } from "@/src/lib/format";
import { gameCoverImage } from "@/src/lib/storage-image";
import type { Game } from "@/src/types/database";

const LOW_STOCK_THRESHOLD = 5;

/**
 * Theme sweep (light/dark session) found every row here rendering a solid
 * black square in light mode — this table was reading `game.coverImageUrl`
 * (the legacy column, unpopulated on every seeded game) instead of
 * `coverPath`, so every real cover fell through to GAME_COVER_PLACEHOLDER,
 * a static PNG deliberately drawn dark-on-transparent for the dark theme —
 * fine as a near-invisible tile against a dark admin sidebar, a stark black
 * hole against a light one. Fixed two ways: real games now resolve their
 * cover the same way GameCard/GameDetailBody already do (coverPath through
 * gameCoverImage — the 400w derivative is plenty for a 32-44px thumbnail,
 * no need for the 800w one those larger call sites use), and the "no cover
 * uploaded yet" case gets an inline icon on bg-nova-slab instead of a baked
 * image, so it re-themes for free instead of needing a second static asset.
 * Plain <img>, not next/image, matching gameCoverImage's own doc comment:
 * these are already exact pre-sized .webp files.
 */
function GameCoverThumb({ game, className }: { game: Game; className: string }) {
  const cover = game.coverPath ? gameCoverImage(game.coverPath) : null;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab ${className}`}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- coverPath derivatives are already exact pre-sized .webp files; see storage-image.ts
        <img
          src={cover.sizes[0].url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-nova-smoke">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}
    </div>
  );
}

function ActiveToggle({
  game,
  onToggleActive,
}: {
  game: Game;
  onToggleActive: (game: Game) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={game.isActive}
      aria-label={`${game.title} active`}
      onClick={() => onToggleActive(game)}
      className="flex h-11 w-11 items-center justify-center"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors duration-(--duration-fast) ease-standard ${
          game.isActive ? "bg-nova-ember" : "bg-nova-slab"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-nova-void transition-transform duration-(--duration-fast) ease-standard ${
            game.isActive ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function GamesTable({
  games,
  availableByGameId,
  onToggleActive,
  onEdit,
  onDelete,
  onManageVariants,
}: {
  games: Game[];
  availableByGameId: Map<string, number>;
  onToggleActive: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
  onManageVariants: (game: Game) => void;
}) {
  if (games.length === 0) {
    return (
      <div className="rounded-lg border border-nova-hairline bg-nova-crypt px-4 py-12 text-center text-sm text-nova-ash">
        No games match your search.
      </div>
    );
  }

  const rows = games.map((game) => ({ game, available: availableByGameId.get(game.id) ?? 0 }));

  return (
    <>
      {/* Table — md and up. contain-layout is load-bearing, not decorative:
          without it, this wrapper's own overflow-x-auto correctly scrolls
          the table internally (its own scrollWidth/clientWidth are
          properly split), but its content's true width still leaks into
          document.documentElement.scrollWidth — measured at 768px, a
          768px-wide document with this table inside reports 805px
          scrollWidth, and window.scrollTo(x, 0) genuinely moves the whole
          page sideways. Confirmed via direct isolation (toggling this
          property alone) that the leak is specifically an overflow-auto
          vs document-level overflow-x:clip (globals.css, html/body)
          interaction in this Chromium build — switching this wrapper to
          overflow-x:hidden does NOT fix it; contain:layout does, by
          establishing a real independent formatting context rather than
          relying on overflow alone for isolation. */}
      <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline contain-layout md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-nova-hairline bg-nova-crypt text-xs uppercase tracking-wider text-nova-smoke">
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Genre</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ game, available }) => {
              const lowStock = available <= LOW_STOCK_THRESHOLD;
              return (
                <tr key={game.id} className="border-b border-nova-hairline last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <GameCoverThumb game={game} className="h-10 w-8" />
                      <span className="font-medium text-nova-bone">{game.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-nova-ash">{game.genre}</td>
                  <td className="px-4 py-3 text-nova-ash">{game.platform}</td>
                  <td className="px-4 py-3 text-right text-nova-bone">{formatPrice(game.price)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${lowStock ? "text-nova-gild" : "text-nova-bone"}`}>
                    {available}
                  </td>
                  <td className="px-4 py-3">
                    <ActiveToggle game={game} onToggleActive={onToggleActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onManageVariants(game)}
                        className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ash hover:text-nova-bone"
                      >
                        Variants
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(game)}
                        className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(game)}
                        className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-blood hover:text-nova-blood/80"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below md */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ game, available }) => {
          const lowStock = available <= LOW_STOCK_THRESHOLD;
          return (
            <div key={game.id} className="flex flex-col gap-3 rounded-lg border border-nova-hairline bg-nova-void p-4">
              <div className="flex items-center gap-3">
                <GameCoverThumb game={game} className="h-14 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-nova-bone">{game.title}</p>
                  <p className="truncate text-xs text-nova-smoke">
                    {game.genre} · {game.platform}
                  </p>
                </div>
                <ActiveToggle game={game} onToggleActive={onToggleActive} />
              </div>

              <div className="flex items-center justify-between border-t border-nova-hairline pt-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-nova-bone">{formatPrice(game.price)}</span>
                  <span className={lowStock ? "text-nova-gild" : "text-nova-ash"}>Stock: {available}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onManageVariants(game)}
                    className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ash hover:text-nova-bone"
                  >
                    Variants
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(game)}
                    className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(game)}
                    className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-blood hover:text-nova-blood/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
