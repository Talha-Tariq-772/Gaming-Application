import type { Metadata } from "next";
import { Suspense } from "react";
import HardwarePageSkeleton from "@/src/components/hardware/HardwarePageSkeleton";
import HardwarePageBody, { type RawSearchParams } from "./HardwarePageBody";

const TITLE = "Hardware & Accessories";
const DESCRIPTION =
  "PlayStation consoles, controllers, headsets and gaming accessories — real stock, shipped across Pakistan.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/hardware",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
    url: "/hardware",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
  },
};

/**
 * Deliberately NOT async, with zero top-level awaits of its own — same
 * pattern as app/(storefront)/gift-cards/page.tsx (see GamesPageBody's
 * comment for the measured CLS reasoning this mirrors).
 */
export default function HardwarePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <Suspense fallback={<HardwarePageSkeleton />}>
      <HardwarePageBody searchParams={searchParams} />
    </Suspense>
  );
}
