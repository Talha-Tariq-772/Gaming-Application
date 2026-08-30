import GamesPageSkeleton from "@/src/components/games/GamesPageSkeleton";

/**
 * Defense in depth only — the hand-placed <Suspense fallback={<GamesPageSkeleton />}>
 * in page.tsx (wrapping GamesPageBody) is what actually governs what users
 * see on a fresh load; see GamesPageBody's comment for why this file-based
 * loading.tsx convention didn't behave the same way here as it does for
 * app/(storefront)/(home)/loading.tsx.
 */
export default function Loading() {
  return <GamesPageSkeleton />;
}
