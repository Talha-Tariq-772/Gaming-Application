import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import Reveal from "@/src/components/ui/nova/Reveal";
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
        <Eyebrow>News</Eyebrow>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">News</h1>
        <p className="mt-4 max-w-lg text-base text-nova-ash">
          Announcements, updates, and drops from the Nova team.
        </p>
      </div>

      {posts.length === 0 ? (
        <NovaCard className="px-4 py-24 text-center text-sm text-nova-ash">
          Nothing here yet — check back soon.
        </NovaCard>
      ) : (
        <Reveal stagger={0.04} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="group block">
              <NovaCard className="flex h-full flex-col gap-3 p-4">
                {post.coverImageUrl && (
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt">
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
                    <span className="text-xs text-nova-smoke">{formatDate(post.publishedAt)}</span>
                  )}
                  <h2 className="line-clamp-2 wrap-break-word font-display text-lg font-bold text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
                    {post.title}
                  </h2>
                  {post.excerpt && <p className="line-clamp-2 text-sm text-nova-ash">{post.excerpt}</p>}
                </div>
              </NovaCard>
            </Link>
          ))}
        </Reveal>
      )}
    </div>
  );
}
