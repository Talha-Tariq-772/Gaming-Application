import Image from "next/image";
import { formatPrice } from "@/src/lib/format";
import type { Game } from "@/src/types/database";

const LOW_STOCK_THRESHOLD = 5;

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
}: {
  games: Game[];
  availableByGameId: Map<string, number>;
  onToggleActive: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
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
      {/* Table — md and up */}
      <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline md:block">
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
                      <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab">
                        <Image src={game.coverImageUrl} alt="" fill sizes="32px" className="object-cover" />
                      </div>
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
                        onClick={() => onEdit(game)}
                        className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ember hover:text-nova-ember-lo"
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
                <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab">
                  <Image src={game.coverImageUrl} alt="" fill sizes="44px" className="object-cover" />
                </div>
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
                    onClick={() => onEdit(game)}
                    className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ember hover:text-nova-ember-lo"
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
