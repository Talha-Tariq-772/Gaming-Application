import type { Metadata } from "next";
import LegalPageContent from "@/src/components/legal/LegalPageContent";
import { LEGAL_PAGES } from "@/src/lib/legal-content";

const page = LEGAL_PAGES.terms;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    type: "website",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
    url: "/terms",
  },
  twitter: {
    card: "summary_large_image",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
  },
};

export default function TermsPage() {
  return <LegalPageContent page={page} />;
}
