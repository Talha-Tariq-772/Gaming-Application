import GiftCardDetailSkeleton from "@/src/components/gift-cards/GiftCardDetailSkeleton";

/**
 * Defense in depth only — the hand-placed <Suspense fallback={<GiftCardDetailSkeleton />}>
 * in page.tsx is what actually governs what users see on a fresh load, same
 * as app/(storefront)/games/[slug]/loading.tsx.
 */
export default function Loading() {
  return <GiftCardDetailSkeleton />;
}
