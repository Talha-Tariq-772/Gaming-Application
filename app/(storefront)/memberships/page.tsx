import type { Metadata } from "next";
import { Suspense } from "react";
import MembershipsBody from "./MembershipsBody";
import MembershipsSkeleton from "./MembershipsSkeleton";

const TITLE = "Memberships";
const DESCRIPTION = "PlayStation Plus, PS Plus Extra & Premium, and Xbox Game Pass Ultimate — delivered as full account credentials.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/memberships",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
    url: "/memberships",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
  },
};

/**
 * Deliberately NOT async, with zero top-level awaits of its own — same
 * split as /games and the game detail route. MembershipsBody does the one
 * real await; this file's only job is to exist as a plain synchronous
 * wrapper around the Suspense boundary. MembershipsSkeleton is sized from
 * this route's own measured real heights (see that file's comment) — same
 * component also backs loading.tsx for the route-level transition.
 */
export default function MembershipsPage() {
  return (
    <Suspense fallback={<MembershipsSkeleton />}>
      <MembershipsBody />
    </Suspense>
  );
}
