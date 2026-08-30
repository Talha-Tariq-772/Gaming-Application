import type { Metadata } from "next";
import { Suspense } from "react";
import GameDetailSkeleton from "@/src/components/games/GameDetailSkeleton";
import { getGameBySlug, getGames } from "@/src/lib/catalog";
import GameDetailBody from "./GameDetailBody";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((game) => ({ slug: game.slug }));
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
      title: `${game.title} — Nova`,
      description: game.description,
      url: `/games/${game.slug}`,
      // Image itself comes from opengraph-image.tsx in this route segment
      // (the game's cover composited with title/price) — Next auto-injects
      // it into both og:image and twitter:image, no need to set it here.
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} — Nova`,
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
