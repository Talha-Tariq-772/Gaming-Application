import HardwarePageSkeleton from "@/src/components/hardware/HardwarePageSkeleton";

/**
 * Defense in depth only — the hand-placed
 * <Suspense fallback={<HardwarePageSkeleton />}> in page.tsx is what
 * actually governs what users see on a fresh load, same as
 * app/(storefront)/gift-cards/loading.tsx.
 */
export default function Loading() {
  return <HardwarePageSkeleton />;
}
