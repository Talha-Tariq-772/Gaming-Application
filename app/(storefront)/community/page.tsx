import type { Metadata } from "next";
import Link from "next/link";
import WhatsAppLink from "@/src/components/WhatsAppLink";
import { getNewsPosts } from "@/src/lib/news";
import { buildGeneralWhatsAppLink } from "@/src/lib/order";

const TITLE = "Community";
const DESCRIPTION = "Join the conversation, get quick support, and keep up with what's new at Nova.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/community",
  },
  openGraph: {
    type: "website",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
    url: "/community",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Nova`,
    description: DESCRIPTION,
  },
};

// TODO: replace with the real Discord/social URLs before launch.
const DISCORD_URL = "https://discord.gg/replace-me";
const X_URL = "https://x.com/replace-me";

const CARD_CLASS =
  "flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-6 transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong";

export default async function CommunityPage() {
  const latestNews = await getNewsPosts(3);

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Community</span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-text">Join the Community</h1>
        <p className="mt-4 max-w-lg text-base text-text-muted">
          Talk to other players, get quick support, and follow along with what&rsquo;s new.
        </p>
      </div>

      <div className="mb-16 grid gap-4 sm:grid-cols-3">
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={CARD_CLASS}>
          <span className="font-display text-lg font-bold text-text">Discord</span>
          <span className="text-sm text-text-muted">Chat with other players and the team.</span>
        </a>
        <WhatsAppLink href={buildGeneralWhatsAppLink()} context="community" className={CARD_CLASS}>
          <span className="font-display text-lg font-bold text-text">WhatsApp</span>
          <span className="text-sm text-text-muted">Message us directly for quick support.</span>
        </WhatsAppLink>
        <a href={X_URL} target="_blank" rel="noopener noreferrer" className={CARD_CLASS}>
          <span className="font-display text-lg font-bold text-text">X (Twitter)</span>
          <span className="text-sm text-text-muted">Follow for announcements and drops.</span>
        </a>
      </div>

      {latestNews.length > 0 && (
        <div className="mb-16">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-faint">Latest News</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {latestNews.map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`} className={CARD_CLASS}>
                <span className="font-display text-base font-bold text-text">{post.title}</span>
                {post.excerpt && <span className="line-clamp-2 text-sm text-text-muted">{post.excerpt}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/guides"
        className="-my-2.5 flex min-h-11 w-fit items-center py-2.5 text-sm font-semibold text-accent hover:text-accent-strong"
      >
        Browse the Guides →
      </Link>
    </div>
  );
}
