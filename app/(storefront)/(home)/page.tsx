import { Suspense } from "react";
import BestSellers from "@/src/components/home/BestSellers";
import FeaturedGames from "@/src/components/home/FeaturedGames";
import GameRowSkeleton from "@/src/components/home/GameRowSkeleton";
import HomeHero from "@/src/components/home/HomeHero";
import HowItWorks from "@/src/components/home/HowItWorks";
import NewArrivals from "@/src/components/home/NewArrivals";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";

// HomeHero -> NovaFigureVisual picks one of two hero figures at random on
// every render (see that file). Nothing else on this route reads a request-
// scoped dynamic API (the catalog client is the stateless/cacheable one —
// see src/lib/supabase/public.ts), so without this the route is eligible
// for static optimization and Math.random() would be evaluated once at
// build time, not per request — every visitor would get the same figure
// forever instead of an actual rotation.
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
