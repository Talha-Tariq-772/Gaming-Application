import { useEffect, useState } from "react";

/**
 * Zustand's `persist` middleware rehydrates from localStorage as soon as the
 * store module runs on the client — before React's hydration pass — so a
 * component reading persisted state on its very first render can disagree
 * with the server-rendered HTML (which never had access to localStorage).
 *
 * Gate any UI that depends on persisted state behind this hook: it's false
 * on the server and on the client's first render (matching SSR output),
 * then flips true in an effect once it's safe to show the real data.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
