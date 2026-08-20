import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TableOfContents from "@/src/components/guides/TableOfContents";
import ViewGuideTracker from "@/src/components/guides/ViewGuideTracker";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { renderMarkdown } from "@/src/lib/markdown";
import { getGuideBySlug, getGuides } from "@/src/lib/mock-guides";
import { SITE_URL } from "@/src/lib/site-config";

export async function generateStaticParams() {
  const guides = await getGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    return { title: "Guide not found" };
  }

  return {
    title: guide.title,
    description: guide.excerpt,
    alternates: {
      canonical: `/guides/${guide.slug}`,
    },
    openGraph: {
      type: "article",
      title: `${guide.title} — Nova`,
      description: guide.excerpt,
      url: `/guides/${guide.slug}`,
      modifiedTime: guide.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.title} — Nova`,
      description: guide.excerpt,
    },
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [guide, allGuides] = await Promise.all([
    getGuideBySlug(slug),
    getGuides(),
  ]);

  if (!guide) {
    notFound();
  }

  const { html, headings } = renderMarkdown(guide.body);

  const currentIndex = allGuides.findIndex((g) => g.id === guide.id);
  const prevGuide = currentIndex > 0 ? allGuides[currentIndex - 1] : null;
  const nextGuide =
    currentIndex >= 0 && currentIndex < allGuides.length - 1
      ? allGuides[currentIndex + 1]
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: `${SITE_URL}/guides/${guide.slug}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {/* Our own mock data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ViewGuideTracker guideSlug={guide.slug} category={guide.category} />
      <Link
        href="/guides"
        className="-my-2.5 mb-6 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-medium text-text-muted hover:text-text"
      >
        ← All Guides
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1fr_240px]">
        <article className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {GUIDE_CATEGORY_LABELS[guide.category]}
          </span>
          <h1 className="mt-2 break-words text-display-sm font-display font-extrabold text-text">
            {guide.title}
          </h1>

          <div
            className="markdown-body mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <nav className="mt-16 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">
            {prevGuide && (
              <Link
                href={`/guides/${prevGuide.slug}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-4 transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                  ← Previous
                </span>
                <span className="text-sm font-semibold text-text">
                  {prevGuide.title}
                </span>
              </Link>
            )}
            {nextGuide && (
              <Link
                href={`/guides/${nextGuide.slug}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-4 text-right transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong sm:col-start-2"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Next →
                </span>
                <span className="text-sm font-semibold text-text">
                  {nextGuide.title}
                </span>
              </Link>
            )}
          </nav>
        </article>

        {headings.length > 0 && (
          <aside className="hidden lg:block">
            <TableOfContents headings={headings} />
          </aside>
        )}
      </div>
    </div>
  );
}
