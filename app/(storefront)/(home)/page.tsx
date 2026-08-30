import { Suspense } from "react";
import FeaturedGames from "@/src/components/home/FeaturedGames";
import FeaturedGamesSkeleton from "@/src/components/home/FeaturedGamesSkeleton";
import HomeHero from "@/src/components/home/HomeHero";
import HowItWorks from "@/src/components/home/HowItWorks";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";

export default function Home() {
  return (
    <>
      <HomeHero />
      <HowItWorks />
      <SectionErrorBoundary label="featured games">
        <Suspense fallback={<FeaturedGamesSkeleton />}>
          <FeaturedGames />
        </Suspense>
      </SectionErrorBoundary>
    </>
  );
}
