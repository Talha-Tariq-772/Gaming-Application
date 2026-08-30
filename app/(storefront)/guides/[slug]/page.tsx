import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TableOfContents from "@/src/components/guides/TableOfContents";
import ViewGuideTracker from "@/src/components/guides/ViewGuideTracker";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import NovaCard from "@/src/components/ui/nova/NovaCard";
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
        className="-my-2.5 mb-6 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-medium text-nova-ash hover:text-nova-bone"
      >
        ← All Guides
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1fr_240px]">
        <article className="min-w-0">
          <Eyebrow>{GUIDE_CATEGORY_LABELS[guide.category]}</Eyebrow>
          <h1 className="mt-2 wrap-break-word text-display-sm font-display font-extrabold text-nova-bone">
            {guide.title}
          </h1>

          <div
            className="markdown-body mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <nav className="mt-16 grid gap-4 border-t border-nova-hairline pt-8 sm:grid-cols-2">
            {prevGuide && (
              <Link href={`/guides/${prevGuide.slug}`} className="block">
                <NovaCard className="flex flex-col gap-1 p-4">
                  <Eyebrow tone="muted">← Previous</Eyebrow>
                  <span className="text-sm font-semibold text-nova-bone">
                    {prevGuide.title}
                  </span>
                </NovaCard>
              </Link>
            )}
            {nextGuide && (
              <Link href={`/guides/${nextGuide.slug}`} className="block sm:col-start-2">
                <NovaCard className="flex flex-col gap-1 p-4 text-right">
                  <Eyebrow tone="muted">Next →</Eyebrow>
                  <span className="text-sm font-semibold text-nova-bone">
                    {nextGuide.title}
                  </span>
                </NovaCard>
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
