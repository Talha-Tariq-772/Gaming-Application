"use client";

import { useMemo, useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import DeleteGameDialog from "@/src/components/admin/DeleteGameDialog";
import GameFormDialog from "@/src/components/admin/GameFormDialog";
import GamesTable from "@/src/components/admin/GamesTable";
import VariantsPanel from "@/src/components/admin/VariantsPanel";
import { createGame, deleteGame, setGameActive, updateGame } from "@/src/lib/actions/admin-games";
import { setGameCostPrice } from "@/src/lib/actions/admin-cost-price";
import { formatPrice } from "@/src/lib/format";
import { useToastStore } from "@/src/stores/toast-store";
import type { AdminGame, Game, SetupGuide, VariantMode } from "@/src/types/database";
import type { CredentialStockEntry, EstimatedVariantEntry } from "@/src/lib/admin-queries";

export default function AdminGamesClient({
  initialGames,
  stock,
  setupGuides,
  estimatedVariants,
}: {
  initialGames: AdminGame[];
  stock: CredentialStockEntry[];
  setupGuides: SetupGuide[];
  /** Every active variant still price_source='estimate', across every
   * game — one screen listing all of them (see getEstimatedVariants). */
  estimatedVariants: EstimatedVariantEntry[];
}) {
  const [games, setGames] = useState<AdminGame[]>(initialGames);
  const [search, setSearch] = useState("");
  const [editingGame, setEditingGame] = useState<AdminGame | null | undefined>(undefined); // undefined = closed, null = adding new, Game = editing
  const [deletingGame, setDeletingGame] = useState<AdminGame | null>(null);
  const [variantsGame, setVariantsGame] = useState<AdminGame | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const availableByGameId = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of stock) map.set(entry.gameId, entry.available);
    return map;
  }, [stock]);

  const referencedGameIds = useMemo(() => new Set(stock.map((s) => s.gameId)), [stock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.title.toLowerCase().includes(q));
  }, [games, search]);

  async function handleToggleActive(game: AdminGame) {
    const result = await setGameActive(game.id, !game.isActive);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, ...result.game } : g)));
  }

  /**
   * Explicitly sets inactive — deliberately NOT handleToggleActive, which
   * flips. The blocked-delete toast offers this as a recovery action, and
   * a game that is already inactive would be switched back ON by a toggle,
   * which is the opposite of what the button says.
   */
  async function handleDeactivate(game: AdminGame) {
    const result = await setGameActive(game.id, false);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, ...result.game } : g)));
    showToast(`${game.title} hidden from the store`);
  }

  async function handleSave(
    values: Parameters<typeof createGame>[0] & { costPrice: number | null },
  ): Promise<{ ok: boolean; message?: string }> {
    const { costPrice, ...gameValues } = values;
    const result = editingGame ? await updateGame(editingGame.id, gameValues) : await createGame(gameValues);
    if (!result.ok) return result;

    // Cost price is saved separately, not as part of the games row write,
    // because setting it must also append to cost_price_history — that
    // pairing lives in one place (setGameCostPrice) rather than being
    // duplicated into createGame/updateGame. Only write when it actually
    // changed, so re-saving a game doesn't stack identical history rows.
    const previousCost = editingGame ? editingGame.costPrice : null;
    let savedCost = previousCost;
    if (costPrice !== previousCost) {
      const costResult = await setGameCostPrice(result.game.id, costPrice);
      if (!costResult.ok) {
        // The game itself saved — reflect that, then report the cost failure.
        setGames((prev) =>
          editingGame
            ? prev.map((g) => (g.id === result.game.id ? { ...g, ...result.game } : g))
            : [{ ...result.game, costPrice: null }, ...prev],
        );
        setEditingGame(undefined);
        showToast(costResult.message);
        return { ok: true };
      }
      savedCost = costResult.costPrice;
    }

    const saved: AdminGame = { ...result.game, costPrice: savedCost };
    setGames((prev) => {
      if (editingGame) return prev.map((g) => (g.id === saved.id ? saved : g));
      return [saved, ...prev];
    });
    showToast(editingGame ? "Game updated" : "Game added");
    setEditingGame(undefined);
    return { ok: true };
  }

  // uploadGameImage (src/lib/actions/admin-images.ts) writes to the same
  // object path on a replace (upsert:true), so the row's cover_path/
  // wallpaper_path only actually changes on the FIRST upload — but this
  // still needs to run then, both so GamesTable's thumbnail isn't stuck on
  // a placeholder and so reopening this game's dialog later has the right
  // path without a full page reload.
  function handleImageUpdated(gameId: string, patch: Partial<Pick<Game, "coverPath" | "wallpaperPath">>) {
    setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, ...patch } : g)));
  }

  function handleVariantModeChanged(gameId: string, variantMode: VariantMode) {
    setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, variantMode } : g)));
  }

  async function handleConfirmDelete() {
    if (!deletingGame) return;
    const game = deletingGame;
    const result = await deleteGame(game.id);

    if (!result.ok) {
      if (result.blockedByHistory) {
        // Same treatment deleteHardwareProduct's FK refusal gets: the
        // longer action-toast, carrying the alternative as a button rather
        // than only naming it in prose. This is the message an admin most
        // needs to actually read.
        showToast(result.message, {
          label: "Set inactive",
          onClick: () => handleDeactivate(game),
        });
      } else {
        showToast(result.message);
      }
      setDeletingGame(null);
      return;
    }

    setGames((prev) => prev.filter((g) => g.id !== game.id));
    showToast(`${game.title} deleted`);
    setDeletingGame(null);
  }

  function openVariantsForGameId(gameId: string) {
    const game = games.find((g) => g.id === gameId);
    if (game) setVariantsGame(game);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-nova-bone">Games</h1>
          <p className="mt-1 text-sm text-nova-ash">{games.length} total</p>
        </div>
        <AdminButton variant="primary" onClick={() => setEditingGame(null)}>
          Add Game
        </AdminButton>
      </div>

      {estimatedVariants.length > 0 && (
        <div className="rounded-lg border border-nova-gild/40 bg-nova-gild/10 p-4">
          <p className="text-sm font-semibold text-nova-gild">
            {estimatedVariants.length} variant{estimatedVariants.length === 1 ? "" : "s"} still have unconfirmed
            (estimate) prices
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {estimatedVariants.map((v) => (
              <li key={v.variantId}>
                <button
                  type="button"
                  onClick={() => openVariantsForGameId(v.gameId)}
                  className="min-h-8 text-left text-xs text-nova-ash hover:text-nova-bone"
                >
                  {v.gameTitle} — {v.label} ({formatPrice(v.pricePkr)})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search games…"
        aria-label="Search games"
        className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />

      <GamesTable
        games={filtered}
        availableByGameId={availableByGameId}
        onToggleActive={handleToggleActive}
        onEdit={(game) => setEditingGame(game)}
        onDelete={(game) => setDeletingGame(game)}
        onManageVariants={(game) => setVariantsGame(game)}
      />

      {editingGame !== undefined && (
        <GameFormDialog
          game={editingGame}
          setupGuides={setupGuides}
          onCancel={() => setEditingGame(undefined)}
          onSave={handleSave}
          onImageUpdated={handleImageUpdated}
        />
      )}

      {variantsGame && (
        <VariantsPanel
          game={variantsGame}
          onClose={() => setVariantsGame(null)}
          onVariantModeChanged={handleVariantModeChanged}
        />
      )}

      {deletingGame && (
        <DeleteGameDialog
          game={deletingGame}
          willHardDelete={!referencedGameIds.has(deletingGame.id)}
          onCancel={() => setDeletingGame(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
