import type { StateStorage } from "zustand/middleware";

/**
 * Every persisted store in this app (cart, checkout, orders, games,
 * credentials) uses this instead of raw localStorage. zustand's default
 * storage adapter does NOT catch exceptions from the underlying storage —
 * calling localStorage.setItem in Safari private browsing (or inside a
 * sandboxed iframe, or once a quota is hit) throws synchronously, and
 * that throw propagates straight out of the store action that triggered
 * it (e.g. addItem on the cart), crashing whatever called it.
 *
 * This wrapper degrades to an in-memory Map instead: state still works
 * for the current tab session, it just doesn't survive a reload. That's
 * the deliberate tradeoff — a cart that doesn't persist across reloads
 * is fine, an "Add to Cart" click that throws is not.
 */
const memoryStore = new Map<string, string>();

let localStorageAvailable: boolean | null = null;

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorageAvailable !== null) return localStorageAvailable;

  try {
    const testKey = "__gk_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }

  return localStorageAvailable;
}

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (isLocalStorageAvailable()) {
        return window.localStorage.getItem(name);
      }
    } catch {
      // Availability can change between the check and the call (quota
      // hit mid-session) — fall through to memory either way.
    }
    return memoryStore.get(name) ?? null;
  },

  setItem: (name, value) => {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.setItem(name, value);
        return;
      }
    } catch {
      localStorageAvailable = false;
    }
    memoryStore.set(name, value);
  },

  removeItem: (name) => {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.removeItem(name);
        return;
      }
    } catch {
      localStorageAvailable = false;
    }
    memoryStore.delete(name);
  },
};
