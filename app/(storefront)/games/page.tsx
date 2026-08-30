import type { Metadata } from "next";
import { Suspense } from "react";
import GamesPageSkeleton from "@/src/components/games/GamesPageSkeleton";
import GamesPageBody, { type RawSearchParams } from "./GamesPageBody";

const TITLE = "Store";
const DESCRIPTION = "Browse the full Nova catalog.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/games",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
    url: "/games",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
  },
};

/**
 * Deliberately NOT async, with zero top-level awaits of its own — see
 * GamesPageBody's comment for the measured effect of that distinction.
 * GamesPageBody does the one real await (searchParams) and everything
 * downstream of it; this file's only job is to exist as a plain
 * synchronous wrapper around the Suspense boundary.
 */
export default function GamesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <Suspense fallback={<GamesPageSkeleton />}>
      <GamesPageBody searchParams={searchParams} />
    </Suspense>
  );
}
