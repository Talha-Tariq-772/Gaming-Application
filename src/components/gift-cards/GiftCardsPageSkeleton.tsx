import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";
import GiftCardFilterBarSkeleton from "./GiftCardFilterBarSkeleton";

/**
 * Full-page fallback for the <Suspense> wrapping GiftCardsPageBody, mirrors
 * GamesPageSkeleton minus the store slider (the gift-cards catalog has no
 * slider). GamesGridSkeleton is reused directly rather than duplicated — its
 * card-skeleton grid isn't games-specific, it's a plain aspect-3/4 +
 * title/tags/price placeholder shape that a gift-card grid looks identical
 * to at this loading stage.
 */
export default function GiftCardsPageSkeleton() {
  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-8">
        <div className="h-3.5 w-24 animate-pulse rounded bg-nova-slab" />
        <div className="mt-2 h-[52px] w-64 animate-pulse rounded bg-nova-slab md:h-[80px] md:w-96" />
      </div>

      <GiftCardFilterBarSkeleton />

      <GamesGridSkeleton />
    </div>
  );
}
