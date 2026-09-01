import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "@/src/components/faq/FaqAccordion";
import FaqHashSync from "@/src/components/faq/FaqHashSync";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import { getFaqItems } from "@/src/lib/mock-guides";

const TITLE = "FAQ";
const DESCRIPTION =
  "Answers to common questions about payment verification, account setup, and troubleshooting on Nova.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
    url: "/faq",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
  },
};

export default async function FaqPage() {
  const items = await getFaqItems();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {/* Our own mock data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqHashSync />

      <div className="mb-12 max-w-2xl">
        <Eyebrow>Help</Eyebrow>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 text-base text-nova-ash">
          Can&rsquo;t find what you&rsquo;re after? See the full{" "}
          <Link
            href="/guides"
            className="text-nova-ember-text underline underline-offset-2 hover:text-nova-ember-lo"
          >
            guides
          </Link>{" "}
          section, or message us on WhatsApp from your order page.
        </p>
      </div>

      <FaqAccordion items={items} />
    </div>
  );
}
