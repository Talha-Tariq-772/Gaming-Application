import GiftCardsPageSkeleton from "@/src/components/gift-cards/GiftCardsPageSkeleton";

/**
 * Defense in depth only — the hand-placed <Suspense fallback={<GiftCardsPageSkeleton />}>
 * in page.tsx is what actually governs what users see on a fresh load, same
 * as app/(storefront)/games/loading.tsx.
 */
export default function Loading() {
  return <GiftCardsPageSkeleton />;
}
