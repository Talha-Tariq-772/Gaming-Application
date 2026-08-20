import type { Metadata } from "next";
import LegalPageContent from "@/src/components/legal/LegalPageContent";
import { LEGAL_PAGES } from "@/src/lib/legal-content";

const page = LEGAL_PAGES.about;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    title: `${page.title} — Nova`,
    description: page.description,
    url: "/about",
  },
  twitter: {
    card: "summary_large_image",
    title: `${page.title} — Nova`,
    description: page.description,
  },
};

export default function AboutPage() {
  return <LegalPageContent page={page} />;
}
