import type { Metadata } from "next";
import LegalPlaceholderNotice from "@/src/components/legal/LegalPlaceholderNotice";
import WhatsAppButton from "@/src/components/WhatsAppButton";
import { formatDate } from "@/src/lib/date";
import { LEGAL_PAGES } from "@/src/lib/legal-content";
import { renderMarkdown } from "@/src/lib/markdown";
import { buildGeneralWhatsAppLink } from "@/src/lib/order";

const page = LEGAL_PAGES.contact;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    type: "website",
    title: `${page.title} — Nova`,
    description: page.description,
    url: "/contact",
  },
  twitter: {
    card: "summary_large_image",
    title: `${page.title} — Nova`,
    description: page.description,
  },
};

export default function ContactPage() {
  const { html } = renderMarkdown(page.body);

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mx-auto max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember">
          Legal
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          {page.title}
        </h1>
        <p className="mt-2 text-xs text-nova-smoke">
          Last updated {formatDate(page.updatedAt)}
        </p>

        <div className="mt-8 flex flex-col items-start gap-4 rounded-lg border border-nova-ember bg-nova-crypt p-6 shadow-glow sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-nova-bone">
              Message us on WhatsApp
            </p>
            <p className="mt-1 text-sm text-nova-ash">
              Online 9am–9pm PKT, every day.
            </p>
          </div>
          <WhatsAppButton
            href={buildGeneralWhatsAppLink()}
            context="contact"
            className="w-full sm:w-fit"
          >
            Open WhatsApp
          </WhatsAppButton>
        </div>

        <div className="mt-8">
          <LegalPlaceholderNotice />
        </div>

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
