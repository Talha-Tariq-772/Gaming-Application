import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TableOfContents from "@/src/components/guides/TableOfContents";
import ViewGuideTracker from "@/src/components/guides/ViewGuideTracker";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { excerptFromMarkdown, renderMarkdown } from "@/src/lib/markdown";
import { getGuideBySlug, getGuides } from "@/src/lib/mock-guides";
import { getSetupGuideBySlug, getSetupGuides } from "@/src/lib/setup-guides";
import { SITE_URL } from "@/src/lib/site-config";
import { GAME_PLATFORM_LABELS } from "@/src/types/database";

export async function generateStaticParams() {
  const [guides, setupGuides] = await Promise.all([getGuides(), getSetupGuides()]);
  return [...guides, ...setupGuides].map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  const setupGuide = guide ? null : await getSetupGuideBySlug(slug);

  if (!guide && !setupGuide) {
    return { title: "Guide not found" };
  }

  const title = guide?.title ?? setupGuide!.title;
  const description = guide?.excerpt ?? excerptFromMarkdown(setupGuide!.body);
  const modifiedTime = guide?.updatedAt ?? setupGuide!.updatedAt;

  return {
    title,
    description,
    alternates: {
      canonical: `/guides/${slug}`,
    },
    openGraph: {
      type: "article",
      title: `${title} — Nova`,
      description,
      url: `/guides/${slug}`,
      modifiedTime,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Nova`,
      description,
    },
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [guide, allGuides, setupGuide, allSetupGuides] = await Promise.all([
    getGuideBySlug(slug),
    getGuides(),
    getSetupGuideBySlug(slug),
    getSetupGuides(),
  ]);

  if (!guide && !setupGuide) {
    notFound();
  }

  const title = guide?.title ?? setupGuide!.title;
  const body = guide?.body ?? setupGuide!.body;
  const eyebrowLabel = guide
    ? GUIDE_CATEGORY_LABELS[guide.category]
    : [
        setupGuide!.platform ? GAME_PLATFORM_LABELS[setupGuide!.platform] : null,
        setupGuide!.productType === "membership" ? "Membership" : "Game",
      ]
        .filter(Boolean)
        .join(" · ");
  const trackerCategory = guide?.category ?? `setup-${setupGuide!.productType}`;

  const { html, headings } = renderMarkdown(body);

  // Prev/next nav stays within the same source list — a setup guide's
  // "next" should be another setup guide, not an unrelated FAQ-style mock
  // guide, and vice versa.
  const list = guide ? allGuides : allSetupGuides;
  const currentId = guide?.id ?? setupGuide!.id;
  const currentIndex = list.findIndex((g) => g.id === currentId);
  const prevGuide = currentIndex > 0 ? list[currentIndex - 1] : null;
  const nextGuide =
    currentIndex >= 0 && currentIndex < list.length - 1 ? list[currentIndex + 1] : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: `${SITE_URL}/guides/${slug}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {/* Our own mock/DB-authored data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ViewGuideTracker guideSlug={slug} category={trackerCategory} />
      <Link
        href="/guides"
        className="-my-2.5 mb-6 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-medium text-nova-ash hover:text-nova-bone"
      >
        ← All Guides
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1fr_240px]">
        <article className="min-w-0">
          <Eyebrow>{eyebrowLabel}</Eyebrow>
          <h1 className="mt-2 wrap-break-word text-display-sm font-display font-extrabold text-nova-bone">
            {title}
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
