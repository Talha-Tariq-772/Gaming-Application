"use client";

import { useMemo, useState } from "react";
import {
  assignSliderSlot,
  removeFromSliderSlot,
  reorderSliderSlot,
  type SliderActionResult,
} from "@/src/lib/actions/admin-slider";
import { gameWallpaperImage } from "@/src/lib/storage-image";
import type { Game } from "@/src/types/database";

const SLOT_COUNT = 5;

export default function AdminSliderClient({ games: initialGames }: { games: Game[] }) {
  const [games, setGames] = useState(initialGames);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingGameId, setPendingGameId] = useState<Record<number, string>>({});

  const slots = useMemo(() => {
    const arr: (Game | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
    for (const game of games) {
      const pos = game.sliderPosition;
      if (pos !== null && pos >= 1 && pos <= SLOT_COUNT) arr[pos - 1] = game;
    }
    return arr;
  }, [games]);

  const candidates = useMemo(
    () => games.filter((g) => g.sliderPosition === null && g.isActive).sort((a, b) => a.title.localeCompare(b.title)),
    [games],
  );

  function applyUpdates(result: SliderActionResult): boolean {
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setError(null);
    if (result.updates.length > 0) {
      const byId = new Map(result.updates.map((u) => [u.gameId, u.sliderPosition]));
      setGames((prev) => prev.map((g) => (byId.has(g.id) ? { ...g, sliderPosition: byId.get(g.id)! } : g)));
    }
    return true;
  }

  async function handleAdd(position: number) {
    const gameId = pendingGameId[position];
    if (!gameId) return;
    setBusySlot(position);
    const result = await assignSliderSlot(gameId, position);
    setBusySlot(null);
    if (applyUpdates(result)) {
      setPendingGameId((prev) => ({ ...prev, [position]: "" }));
    }
  }

  async function handleRemove(game: Game) {
    setBusySlot(game.sliderPosition);
    const result = await removeFromSliderSlot(game.id);
    setBusySlot(null);
    applyUpdates(result);
  }

  async function handleReorder(position: number, direction: "up" | "down") {
    setBusySlot(position);
    const result = await reorderSliderSlot(position, direction);
    setBusySlot(null);
    applyUpdates(result);
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-testid="slider-heading">
        <h1 className="text-xl font-bold text-nova-bone">Homepage Slider</h1>
        <p className="mt-1 text-sm text-nova-ash">
          5 ordered slots. Only games with a wallpaper actually render on the storefront.
        </p>
      </div>

      {error && <p className="text-sm text-nova-blood">{error}</p>}

      <ul data-testid="slider-list" className="flex flex-col gap-3">
        {slots.map((game, index) => {
          const position = index + 1;
          const busy = busySlot === position;
          const wallpaper = game?.wallpaperPath ? gameWallpaperImage(game.wallpaperPath, game.productType) : null;

          return (
            <li
              key={position}
              className="flex items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-nova-hairline text-sm font-bold text-nova-smoke">
                {position}
              </span>

              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab">
                {wallpaper ? (
                  // eslint-disable-next-line @next/next/no-img-element -- storage derivative preview, same reasoning as GameCard.tsx/storage-image.ts
                  <img src={wallpaper.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-center text-[10px] text-nova-smoke">
                    {game ? "No wallpaper" : "Empty"}
                  </span>
                )}
              </div>

              {game ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-nova-bone">{game.title}</p>
                  {!game.wallpaperPath && (
                    <p className="mt-0.5 text-xs text-nova-gild">
                      No wallpaper uploaded — this slot won&apos;t render on the live site.
                    </p>
                  )}
                  {!game.isActive && (
                    <p className="mt-0.5 text-xs text-nova-gild">
                      This game is inactive — it won&apos;t appear on the live site either.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <select
                    value={pendingGameId[position] ?? ""}
                    onChange={(e) => setPendingGameId((prev) => ({ ...prev, [position]: e.target.value }))}
                    aria-label={`Game for slot ${position}`}
                    disabled={busy || candidates.length === 0}
                    className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="">
                      {candidates.length === 0 ? "No games available" : "Select a game…"}
                    </option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                        {c.wallpaperPath ? "" : " (no wallpaper)"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !pendingGameId[position]}
                    onClick={() => handleAdd(position)}
                    className="min-h-11 shrink-0 rounded-md border border-nova-hairline px-3 py-2 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? "…" : "Add"}
                  </button>
                </div>
              )}

              {game && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={busy || position === 1}
                    onClick={() => handleReorder(position, "up")}
                    aria-label={`Move ${game.title} up`}
                    className="flex h-8 w-8 items-center justify-center rounded border border-nova-hairline text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || position === SLOT_COUNT}
                    onClick={() => handleReorder(position, "down")}
                    aria-label={`Move ${game.title} down`}
                    className="flex h-8 w-8 items-center justify-center rounded border border-nova-hairline text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(game)}
                    className="min-h-8 rounded border border-nova-hairline px-2 text-xs font-semibold text-nova-blood hover:text-nova-blood/80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
