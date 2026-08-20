import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/src/lib/date";
import { getNewsPosts } from "@/src/lib/news";

const TITLE = "News";
const DESCRIPTION = "Announcements, updates, and drops from Nova.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/news",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
    url: "/news",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
  },
};

export default async function NewsPage() {
  const posts = await getNewsPosts();

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">News</span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-text">News</h1>
        <p className="mt-4 max-w-lg text-base text-text-muted">
          Announcements, updates, and drops from the Nova team.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-1 px-4 py-24 text-center text-sm text-text-muted">
          Nothing here yet — check back soon.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="group flex flex-col gap-3">
              {post.coverImageUrl && (
                <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-authored cover URL, arbitrary domain (same reasoning as the Header avatar) */}
                  <img
                    src={post.coverImageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-(--duration-base) ease-standard group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {post.publishedAt && (
                  <span className="text-xs text-text-faint">{formatDate(post.publishedAt)}</span>
                )}
                <h2 className="line-clamp-2 break-words font-display text-lg font-bold text-text transition-colors duration-(--duration-fast) ease-standard group-hover:text-accent">
                  {post.title}
                </h2>
                {post.excerpt && <p className="line-clamp-2 text-sm text-text-muted">{post.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
