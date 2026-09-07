import type Lenis from "lenis";

/**
 * The single live Lenis instance, if smooth-scroll has activated (it's
 * created lazily on first interaction — see SmoothScrollProvider — so
 * this is null until then, and again after prefers-reduced-motion skips
 * it entirely). Exists so code outside SmoothScrollProvider (the scroll
 * lock used by every dialog/drawer) can reach the instance without a
 * React context — nothing here needs to trigger a re-render.
 */
let instance: Lenis | null = null;

export function setLenisInstance(lenis: Lenis | null): void {
  instance = lenis;
}

export function getLenisInstance(): Lenis | null {
  return instance;
}
