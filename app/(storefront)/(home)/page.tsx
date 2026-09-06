import { Suspense } from "react";
import BestSellers from "@/src/components/home/BestSellers";
import FeaturedGames from "@/src/components/home/FeaturedGames";
import GameRowSkeleton from "@/src/components/home/GameRowSkeleton";
import HomeHero from "@/src/components/home/HomeHero";
import HowItWorks from "@/src/components/home/HowItWorks";
import NewArrivals from "@/src/components/home/NewArrivals";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";

// Originally forced dynamic because HomeHero -> NovaFigureVisual picked one
// of two hero figures at random on every render. HomeHero no longer renders
// that (see HomeHero.tsx's own comment) — this is left in place regardless
// because app/(storefront)/(home)/loading.tsx documents Header/Footer's own
// cookies() reads as already forcing this whole route group dynamic
// independently of anything this page itself does.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <HomeHero />
      <HowItWorks />
      <SectionErrorBoundary label="featured games">
        <Suspense fallback={<GameRowSkeleton />}>
          <FeaturedGames />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="best sellers">
        <Suspense fallback={<GameRowSkeleton />}>
          <BestSellers />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="new arrivals">
        <Suspense fallback={<GameRowSkeleton />}>
          <NewArrivals />
        </Suspense>
      </SectionErrorBoundary>
    </>
  );
}
