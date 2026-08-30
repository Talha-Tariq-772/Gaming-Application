import { getSliderGames } from "@/src/lib/catalog";
import StoreSlider from "./StoreSlider";

/**
 * Isolated in its own async Server Component (rather than page.tsx awaiting
 * getSliderGames() directly) for the same reason GamesResults isolates its
 * own query: when the page component itself is async, the *whole* page
 * (heading, filter bar, grid) waits on that one top-level await before any
 * of it can render — and on a fresh page load, that meant Next.js showed
 * the parent app/(storefront)/loading.tsx's generic fallback for the
 * entire wait, never giving /games's own route-level loading.tsx a chance
 * to appear as its own painted frame. A generic ~500px placeholder
 * swapping directly for the real ~2900px+ page in one shot was most of
 * this route's measured CLS. Isolating the fetch here lets the heading and
 * filter bar render immediately regardless of how long this query takes,
 * exactly like GamesResults already does for the grid below it.
 */
export default async function StoreSliderSection() {
  const sliderGames = await getSliderGames();
  return <StoreSlider games={sliderGames} />;
}
