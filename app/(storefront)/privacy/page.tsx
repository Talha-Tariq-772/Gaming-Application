import type { Metadata } from "next";
import LegalPageContent from "@/src/components/legal/LegalPageContent";
import { LEGAL_PAGES } from "@/src/lib/legal-content";

const page = LEGAL_PAGES.privacy;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    type: "website",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
    url: "/privacy",
  },
  twitter: {
    card: "summary_large_image",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
  },
};

export default function PrivacyPage() {
  return <LegalPageContent page={page} />;
}
