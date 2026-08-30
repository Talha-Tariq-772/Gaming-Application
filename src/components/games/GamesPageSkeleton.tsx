import GamesGridSkeleton from "./GamesGridSkeleton";
import StoreFilterBarSkeleton from "./StoreFilterBarSkeleton";
import StoreSliderSkeleton from "../store/StoreSliderSkeleton";

/**
 * Full-page fallback for the <Suspense> wrapping GamesPageBody in
 * app/(storefront)/games/page.tsx. Also used as that route's file-based
 * loading.tsx content for defense in depth, but the hand-placed Suspense in
 * page.tsx is the one that actually matters — see GamesPageBody's comment
 * for why file-based loading.tsx at a real (non-group) route segment
 * didn't behave the same way here as app/(storefront)/(home)/loading.tsx
 * does for the homepage.
 */
export default function GamesPageSkeleton() {
  return (
    <>
      <StoreSliderSkeleton />

      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <div className="mb-8">
          <div className="h-3.5 w-16 animate-pulse rounded bg-nova-slab" />
          <div className="mt-2 h-[52px] w-56 animate-pulse rounded bg-nova-slab md:h-[80px] md:w-72" />
        </div>

        <StoreFilterBarSkeleton />

        <GamesGridSkeleton />
      </div>
    </>
  );
}
