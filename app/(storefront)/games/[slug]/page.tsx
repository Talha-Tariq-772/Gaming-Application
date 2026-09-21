import type { Metadata } from "next";
import { Suspense } from "react";
import GameDetailSkeleton from "@/src/components/games/GameDetailSkeleton";
import { getGameBySlug, getGames } from "@/src/lib/catalog";
import GameDetailBody from "./GameDetailBody";

/**
 * Both product types in the `games` table, not just product_type='game'.
 *
 * getGames() defaults to productType: "game", so the three membership
 * products (PlayStation Plus, PS Plus Extra & Premium, Xbox Game Pass
 * Ultimate) were the only sellable rows in the catalog with no dedicated
 * page of their own. getGameBySlug has never filtered on product_type, so
 * /games/playstation-plus already resolved and rendered — it was simply
 * never prerendered and nothing linked to it. Listing them here makes
 * that a real page rather than an accident of the lookup being permissive.
 *
 * The detail page itself needs no membership branch: HeaderImage already
 * resolves a membership's own "{slug}/header" art via wallpaperPath +
 * productType, the cover falls through to the placeholder (memberships
 * have no cover by design), and RelatedGamesRow skips a genre-less
 * product instead of querying genre=null. /memberships stays the
 * merchandised landing page for the family.
 */
export async function generateStaticParams() {
  const [games, memberships] = await Promise.all([
    getGames(),
    getGames({ productType: "membership" }),
  ]);
  return [...games, ...memberships].map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
    return { title: "Game not found" };
  }

  return {
    title: game.title,
    description: game.description,
    alternates: {
      canonical: `/games/${game.slug}`,
    },
    openGraph: {
      type: "website",
      title: `${game.title} — PSCBUNDLE`,
      description: game.description,
      url: `/games/${game.slug}`,
      // Image itself comes from opengraph-image.tsx in this route segment
      // (the game's cover composited with title/price) — Next auto-injects
      // it into both og:image and twitter:image, no need to set it here.
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} — PSCBUNDLE`,
      description: game.description,
    },
  };
}

/**
 * Deliberately NOT async, with zero top-level awaits of its own — see
 * GameDetailBody's comment and /games' GamesPageBody for the measured
 * effect of that distinction. GameDetailBody does the one real await
 * (params -> getGameBySlug) and everything downstream of it; this file's
 * only job is to exist as a plain synchronous wrapper around the Suspense
 * boundary.
 */
export default function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<GameDetailSkeleton />}>
      <GameDetailBody params={params} />
    </Suspense>
  );
}
