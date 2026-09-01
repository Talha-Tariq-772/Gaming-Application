"use client";

import { useMemo, useState } from "react";
import CredentialGamePanel from "@/src/components/admin/CredentialGamePanel";
import type { CredentialStockEntry } from "@/src/lib/admin-queries";
import type { Game } from "@/src/types/database";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export default function AdminCredentialsClient({
  games,
  initialStock,
}: {
  games: Game[];
  initialStock: CredentialStockEntry[];
}) {
  const [stock, setStock] = useState(initialStock);
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const stockByGameId = useMemo(() => {
    const map = new Map<string, CredentialStockEntry>();
    for (const entry of stock) map.set(entry.gameId, entry);
    return map;
  }, [stock]);

  function handleStockChange(gameId: string, newAvailable: number) {
    setStock((prev) => {
      const existing = prev.find((s) => s.gameId === gameId);
      if (existing) {
        return prev.map((s) => (s.gameId === gameId ? { ...s, available: newAvailable } : s));
      }
      return [...prev, { gameId, available: newAvailable, reserved: 0, sold: 0, revoked: 0 }];
    });
  }

  const totals = stock.reduce(
    (acc, s) => ({
      available: acc.available + s.available,
      reserved: acc.reserved + s.reserved,
      sold: acc.sold + s.sold,
    }),
    { available: 0, reserved: 0, sold: 0 },
  );

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null;
  const emptyStock: CredentialStockEntry = { gameId: "", available: 0, reserved: 0, sold: 0, revoked: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-nova-bone">Credential Stock</h1>
        <p className="mt-1 text-sm text-nova-ash">
          Aggregate counts only — no credential values are ever shown here.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="grid grid-cols-3 gap-4 sm:max-w-md">
          <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
            <p className="text-xs uppercase tracking-wider text-nova-smoke">Available</p>
            <p className="mt-2 text-2xl font-bold text-nova-bone">{totals.available}</p>
          </div>
          <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
            <p className="text-xs uppercase tracking-wider text-nova-smoke">Reserved</p>
            <p className="mt-2 text-2xl font-bold text-nova-bone">{totals.reserved}</p>
          </div>
          <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
            <p className="text-xs uppercase tracking-wider text-nova-smoke">Sold</p>
            <p className="mt-2 text-2xl font-bold text-nova-bone">{totals.sold}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs text-nova-smoke">
          Low-stock threshold
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
            className="min-h-11 w-24 rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none"
          />
        </label>
      </div>

      {/* Table — md and up */}
      <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-nova-hairline bg-nova-crypt text-xs uppercase tracking-wider text-nova-smoke">
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 text-right font-medium">Available</th>
              <th className="px-4 py-3 text-right font-medium">Reserved</th>
              <th className="px-4 py-3 text-right font-medium">Sold</th>
              <th className="px-4 py-3 text-right font-medium">Revoked</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => {
              const s = stockByGameId.get(game.id) ?? { ...emptyStock, gameId: game.id };
              const lowStock = s.available <= threshold;
              return (
                <tr key={game.id} className="border-b border-nova-hairline last:border-b-0">
                  <td className="px-4 py-3 font-medium text-nova-bone">{game.title}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${lowStock ? "text-nova-gild" : "text-nova-bone"}`}>
                    {s.available}
                  </td>
                  <td className="px-4 py-3 text-right text-nova-ash">{s.reserved}</td>
                  <td className="px-4 py-3 text-right text-nova-ash">{s.sold}</td>
                  <td className="px-4 py-3 text-right text-nova-smoke">{s.revoked}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedGameId(game.id)}
                      className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below md */}
      <div className="flex flex-col gap-3 md:hidden">
        {games.map((game) => {
          const s = stockByGameId.get(game.id) ?? { ...emptyStock, gameId: game.id };
          const lowStock = s.available <= threshold;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setSelectedGameId(game.id)}
              className="rounded-lg border border-nova-hairline bg-nova-void p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-nova-bone">{game.title}</p>
                <p className="text-xs text-nova-smoke">Manage →</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-nova-hairline pt-3 text-center">
                <div>
                  <p className="text-xs text-nova-smoke">Avail.</p>
                  <p className={`mt-1 font-semibold ${lowStock ? "text-nova-gild" : "text-nova-bone"}`}>{s.available}</p>
                </div>
                <div>
                  <p className="text-xs text-nova-smoke">Resv.</p>
                  <p className="mt-1 font-semibold text-nova-ash">{s.reserved}</p>
                </div>
                <div>
                  <p className="text-xs text-nova-smoke">Sold</p>
                  <p className="mt-1 font-semibold text-nova-ash">{s.sold}</p>
                </div>
                <div>
                  <p className="text-xs text-nova-smoke">Rvkd.</p>
                  <p className="mt-1 font-semibold text-nova-ash">{s.revoked}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedGame && (
        <CredentialGamePanel
          game={selectedGame}
          stock={stockByGameId.get(selectedGame.id) ?? { ...emptyStock, gameId: selectedGame.id }}
          onClose={() => setSelectedGameId(null)}
          onStockChange={handleStockChange}
        />
      )}
    </div>
  );
}
