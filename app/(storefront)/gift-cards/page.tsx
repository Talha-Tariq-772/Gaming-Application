import type { Metadata } from "next";
import { Suspense } from "react";
import GiftCardsPageSkeleton from "@/src/components/gift-cards/GiftCardsPageSkeleton";
import GiftCardsPageBody, { type RawSearchParams } from "./GiftCardsPageBody";

const TITLE = "Gift Cards";
const DESCRIPTION = "PSN, Xbox, Steam, Google Play, and Apple gift cards — instant digital delivery.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/gift-cards",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
    url: "/gift-cards",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
  },
};

/**
 * Deliberately NOT async, with zero top-level awaits of its own — same
 * pattern as app/(storefront)/games/page.tsx (see GamesPageBody's comment
 * for the measured CLS reasoning this mirrors).
 */
export default function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <Suspense fallback={<GiftCardsPageSkeleton />}>
      <GiftCardsPageBody searchParams={searchParams} />
    </Suspense>
  );
}
