import type { Metadata } from "next";
import LegalPageContent from "@/src/components/legal/LegalPageContent";
import { LEGAL_PAGES } from "@/src/lib/legal-content";

const page = LEGAL_PAGES["refund-policy"];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/refund-policy",
  },
  openGraph: {
    type: "website",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
    url: "/refund-policy",
  },
  twitter: {
    card: "summary_large_image",
    title: `${page.title} — PSCBUNDLE`,
    description: page.description,
  },
};

export default function RefundPolicyPage() {
  return <LegalPageContent page={page} />;
}
