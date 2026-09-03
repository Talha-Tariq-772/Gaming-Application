import type { Metadata } from "next";
import { Suspense } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import GuideSearchInput from "@/src/components/guides/GuideSearchInput";
import GuidesGridSkeleton from "@/src/components/guides/GuidesGridSkeleton";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import GuidesResults from "./GuidesResults";

const TITLE = "Guides";
const DESCRIPTION =
  "Redemption instructions, payment help, account setup, and troubleshooting for the PSCBUNDLE storefront.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
    url: "/guides",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — PSCBUNDLE`,
    description: DESCRIPTION,
  },
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const search = firstValue(resolvedParams.q);

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <Eyebrow>Help</Eyebrow>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          Guides
        </h1>
        <p className="mt-4 max-w-lg text-base text-nova-ash">
          Redemption instructions, payment help, account setup, and
          troubleshooting — everything you need to get from checkout to
          playing.
        </p>
      </div>

      <div className="mb-10">
        <GuideSearchInput />
      </div>

      <SectionErrorBoundary label="guides">
        <Suspense key={search ?? ""} fallback={<GuidesGridSkeleton />}>
          <GuidesResults search={search} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}
