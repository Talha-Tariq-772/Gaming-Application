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
    <>
      {/* Reserves GiftCardsHero's own full-bleed aspect-[12/5] box — outside
          the padded wrapper below, same placement as the real component,
          so Suspense resolving doesn't shift anything horizontally either. */}
      <div className="aspect-[12/5] w-full animate-pulse bg-nova-slab" />

      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <GiftCardFilterBarSkeleton />

        <GamesGridSkeleton />
      </div>
    </>
  );
}
