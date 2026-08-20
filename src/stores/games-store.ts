import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/src/lib/safe-storage";
import type { Game } from "@/src/types/database";

/**
 * Same override pattern as orders-store, kept around only for the
 * /dev/states demo page (admin/games and cart validation are both wired
 * to real Supabase data now — see src/lib/use-games-by-ids.ts). MOCK_GAMES
 * is a static array, so local edits are recorded here rather than
 * mutating the seed data directly.
 */
interface GamesState {
  overrides: Record<string, Partial<Game>>;
  createdGames: Game[];
  updateGame: (id: string, patch: Partial<Game>) => void;
  addGame: (game: Game) => void;
}

export const useGamesStore = create<GamesState>()(
  persist(
    (set) => ({
      overrides: {},
      createdGames: [],

      updateGame: (id, patch) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [id]: { ...state.overrides[id], ...patch },
          },
        })),

      addGame: (game) =>
        set((state) => ({ createdGames: [...state.createdGames, game] })),
    }),
    { name: "gk-games", storage: createJSONStorage(() => safeStorage) },
  ),
);
