import GameRowSkeleton from "@/src/components/home/GameRowSkeleton";
import HomeHeroSkeleton from "@/src/components/home/HomeHeroSkeleton";
import HowItWorksSkeleton from "@/src/components/home/HowItWorksSkeleton";

/**
 * Overrides the generic app/(storefront)/loading.tsx for "/" specifically —
 * a route group purely for this, no effect on the URL. The parent fallback
 * (~500px, deliberately generic — see PageLoadingSkeleton's own comment) is
 * fine for routes with modest, low-variance content, but the homepage's
 * real tree (hero + how-it-works + featured games) runs 2900-4200px
 * depending on viewport. Header/Footer both read cookies()/hit the
 * database, which forces this whole route group to render dynamically, so
 * this fallback is what actually paints first on every load — swapping a
 * ~500px placeholder for ~3000px+ of real content in one shot was the
 * single largest contributor to this page's CLS (measured 0.32-0.36,
 * against a "poor" threshold of 0.25). Each skeleton below shares its real
 * component's grid/padding classes so reserved height tracks the real
 * height at every breakpoint instead of hand-picked pixels that drift out
 * of sync the next time that component's copy or spacing changes.
 *
 * Part C: added Best Sellers and New Arrivals below Featured — same
 * GameRowSkeleton for all three (they're the same shape), rendered three
 * times, or this fallback would go back to being ~2 rows short of the
 * page's real height. Both new sections' flags (is_best_seller/
 * is_new_arrival) are false on every game today so they render nothing in
 * practice, but this fallback still needs to cover the case once either
 * flag is set, not just today's empty state.
 */
export default function Loading() {
  return (
    <>
      <HomeHeroSkeleton />
      <HowItWorksSkeleton />
      <GameRowSkeleton />
      <GameRowSkeleton />
      <GameRowSkeleton />
    </>
  );
}
