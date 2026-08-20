"use client";

import { useMemo, useState } from "react";
import DeleteGameDialog from "@/src/components/admin/DeleteGameDialog";
import GameFormDialog from "@/src/components/admin/GameFormDialog";
import GamesTable from "@/src/components/admin/GamesTable";
import { createGame, deleteGame, setGameActive, updateGame } from "@/src/lib/actions/admin-games";
import { useToastStore } from "@/src/stores/toast-store";
import type { Game } from "@/src/types/database";
import type { CredentialStockEntry } from "@/src/lib/admin-queries";

export default function AdminGamesClient({
  initialGames,
  stock,
}: {
  initialGames: Game[];
  stock: CredentialStockEntry[];
}) {
  const [games, setGames] = useState(initialGames);
  const [search, setSearch] = useState("");
  const [editingGame, setEditingGame] = useState<Game | null | undefined>(undefined); // undefined = closed, null = adding new, Game = editing
  const [deletingGame, setDeletingGame] = useState<Game | null>(null);
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

  async function handleToggleActive(game: Game) {
    const result = await setGameActive(game.id, !game.isActive);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    setGames((prev) => prev.map((g) => (g.id === game.id ? result.game : g)));
  }

  async function handleSave(values: Parameters<typeof createGame>[0]): Promise<{ ok: boolean; message?: string }> {
    const result = editingGame ? await updateGame(editingGame.id, values) : await createGame(values);
    if (!result.ok) return result;

    setGames((prev) => {
      if (editingGame) return prev.map((g) => (g.id === result.game.id ? result.game : g));
      return [result.game, ...prev];
    });
    showToast(editingGame ? "Game updated" : "Game added");
    setEditingGame(undefined);
    return { ok: true };
  }

  async function handleConfirmDelete() {
    if (!deletingGame) return;
    const result = await deleteGame(deletingGame.id);
    if (!result.ok) {
      showToast(result.message);
      setDeletingGame(null);
      return;
    }
    if (result.hardDeleted) {
      setGames((prev) => prev.filter((g) => g.id !== deletingGame.id));
      showToast(`${deletingGame.title} deleted`);
    } else {
      setGames((prev) => prev.map((g) => (g.id === deletingGame.id ? { ...g, isActive: false } : g)));
      showToast(`${deletingGame.title} deactivated`);
    }
    setDeletingGame(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Games</h1>
          <p className="mt-1 text-sm text-text-muted">{games.length} total</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingGame(null)}
          className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-strong"
        >
          Add Game
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search games…"
        aria-label="Search games"
        className="min-h-11 w-full max-w-xs rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
      />

      <GamesTable
        games={filtered}
        availableByGameId={availableByGameId}
        onToggleActive={handleToggleActive}
        onEdit={(game) => setEditingGame(game)}
        onDelete={(game) => setDeletingGame(game)}
      />

      {editingGame !== undefined && (
        <GameFormDialog game={editingGame} onCancel={() => setEditingGame(undefined)} onSave={handleSave} />
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
