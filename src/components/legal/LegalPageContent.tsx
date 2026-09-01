import { formatDate } from "@/src/lib/date";
import { renderMarkdown } from "@/src/lib/markdown";
import type { LegalPage } from "@/src/lib/legal-content";
import LegalPlaceholderNotice from "./LegalPlaceholderNotice";

export default function LegalPageContent({ page }: { page: LegalPage }) {
  const { html } = renderMarkdown(page.body);

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mx-auto max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">
          Legal
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          {page.title}
        </h1>
        <p className="mt-2 text-xs text-nova-smoke">
          Last updated {formatDate(page.updatedAt)}
        </p>

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
