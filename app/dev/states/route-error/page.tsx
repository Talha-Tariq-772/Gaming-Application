// Force dynamic (request-time) rendering — this page throws
// unconditionally, and Next tries to statically prerender pages at
// `next build` time by default. Without this, the throw happens during
// the build itself (no error.tsx to catch it there) and fails the whole
// build instead of just this one route at request time.
export const dynamic = "force-dynamic";

/**
 * DEV ONLY. Throws unconditionally on render so app/error.tsx's
 * route-level boundary has something real to catch. Part of /dev/states —
 * remove this whole app/dev directory before production.
 */
export default function RouteErrorTrigger(): never {
  throw new Error("Simulated route-level failure — this page always throws.");
}
