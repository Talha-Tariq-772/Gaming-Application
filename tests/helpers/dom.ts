/**
 * Minimal window.matchMedia stub for tests that need to simulate
 * prefers-reduced-motion / hover-capable media queries in a happy-dom
 * environment (happy-dom doesn't implement matchMedia itself). Pass the
 * exact query string(s) a component checks, mapped to whether they match.
 * Any query not listed defaults to non-matching.
 */
export function stubMatchMedia(overrides: Record<string, boolean>): void {
  window.matchMedia = ((query: string) => ({
    matches: overrides[query] ?? false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
