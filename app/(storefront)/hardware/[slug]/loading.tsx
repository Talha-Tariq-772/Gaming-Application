import HardwareDetailSkeleton from "@/src/components/hardware/HardwareDetailSkeleton";

/**
 * Defense in depth only — the hand-placed
 * <Suspense fallback={<HardwareDetailSkeleton />}> in page.tsx is what
 * actually governs what users see on a fresh load, same as
 * app/(storefront)/gift-cards/[slug]/loading.tsx.
 */
export default function Loading() {
  return <HardwareDetailSkeleton />;
}
