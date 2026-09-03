import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/src/lib/date";
import { renderMarkdown } from "@/src/lib/markdown";
import { getNewsPostBySlug, getNewsPosts } from "@/src/lib/news";
import { SITE_URL } from "@/src/lib/site-config";

export async function generateStaticParams() {
  const posts = await getNewsPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/news/${post.slug}`,
    },
    openGraph: {
      type: "article",
      title: `${post.title} — PSCBUNDLE`,
      description: post.excerpt,
      url: `/news/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} — PSCBUNDLE`,
      description: post.excerpt,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { html } = renderMarkdown(post.body);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "News", item: `${SITE_URL}/news` },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${SITE_URL}/news/${post.slug}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {/* Admin-authored content (no public write path — RLS is admin-only
          insert/update), not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Link
        href="/news"
        className="-my-2.5 mb-6 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-medium text-nova-ash hover:text-nova-bone"
      >
        ← All News
      </Link>

      <article className="mx-auto max-w-2xl">
        {post.coverImageUrl && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-authored cover URL, arbitrary domain */}
            <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {post.publishedAt && <span className="text-xs text-nova-smoke">{formatDate(post.publishedAt)}</span>}
        <h1 className="mt-2 wrap-break-word text-display-sm font-display font-extrabold text-nova-bone">
          {post.title}
        </h1>
        <div className="markdown-body mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
