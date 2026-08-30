import type { Metadata } from "next";
import Link from "next/link";
import WhatsAppLink from "@/src/components/WhatsAppLink";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import NovaButton from "@/src/components/ui/nova/NovaButton";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import Reveal from "@/src/components/ui/nova/Reveal";
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

const CARD_CLASS = "flex h-full flex-col gap-2 p-6";

export default async function CommunityPage() {
  const latestNews = await getNewsPosts(3);

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <Eyebrow>Community</Eyebrow>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">Join the Community</h1>
        <p className="mt-4 max-w-lg text-base text-nova-ash">
          Talk to other players, get quick support, and follow along with what&rsquo;s new.
        </p>
      </div>

      <Reveal stagger={0.04} className="mb-16 grid gap-4 sm:grid-cols-3">
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="block">
          <NovaCard className={CARD_CLASS}>
            <span className="font-display text-lg font-bold text-nova-bone">Discord</span>
            <span className="text-sm text-nova-ash">Chat with other players and the team.</span>
          </NovaCard>
        </a>
        <WhatsAppLink href={buildGeneralWhatsAppLink()} context="community" className="block">
          <NovaCard className={CARD_CLASS}>
            <span className="font-display text-lg font-bold text-nova-bone">WhatsApp</span>
            <span className="text-sm text-nova-ash">Message us directly for quick support.</span>
          </NovaCard>
        </WhatsAppLink>
        <a href={X_URL} target="_blank" rel="noopener noreferrer" className="block">
          <NovaCard className={CARD_CLASS}>
            <span className="font-display text-lg font-bold text-nova-bone">X (Twitter)</span>
            <span className="text-sm text-nova-ash">Follow for announcements and drops.</span>
          </NovaCard>
        </a>
      </Reveal>

      {latestNews.length > 0 && (
        <div className="mb-16">
          <Eyebrow tone="muted" className="mb-6 block">Latest News</Eyebrow>
          <Reveal stagger={0.04} className="grid gap-6 sm:grid-cols-3">
            {latestNews.map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`} className="block">
                <NovaCard className={CARD_CLASS}>
                  <span className="font-display text-base font-bold text-nova-bone">{post.title}</span>
                  {post.excerpt && <span className="line-clamp-2 text-sm text-nova-ash">{post.excerpt}</span>}
                </NovaCard>
              </Link>
            ))}
          </Reveal>
        </div>
      )}

      <NovaButton as="a" href="/guides" variant="ghost">
        Browse the Guides →
      </NovaButton>
    </div>
  );
}
