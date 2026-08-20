import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/src/components/games/AddToCartButton";
import Tag from "@/src/components/games/Tag";
import TrailerEmbed from "@/src/components/games/TrailerEmbed";
import ViewGameTracker from "@/src/components/games/ViewGameTracker";
import { formatPrice } from "@/src/lib/format";
import { getGameBySlug, getGames } from "@/src/lib/catalog";
import { REDEMPTION_GUIDE_SLUG } from "@/src/lib/mock-guides";
import { SITE_URL } from "@/src/lib/site-config";

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

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  const gameUrl = `${SITE_URL}/games/${game.slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: game.title,
    description: game.description,
    image: game.coverImageUrl,
    sku: game.id,
    category: game.genre,
    offers: {
      "@type": "Offer",
      url: gameUrl,
      price: String(game.price),
      priceCurrency: "PKR",
      availability: game.isActive
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Store", item: `${SITE_URL}/games` },
      { "@type": "ListItem", position: 3, name: game.title, item: gameUrl },
    ],
  };

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      {/* Our own mock data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ViewGameTracker
        gameId={game.id}
        genre={game.genre}
        platform={game.platform}
      />
      <div className="grid gap-12 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface-1">
            <Image
              src={game.coverImageUrl}
              alt={game.title}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <TrailerEmbed
            trailerUrl={game.trailerUrl}
            posterUrl={game.coverImageUrl}
            title={game.title}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="break-words text-display-sm font-display font-extrabold text-text">
              {game.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>{game.genre}</Tag>
              <Tag>{game.platform}</Tag>
            </div>
          </div>

          <span className="text-3xl font-display font-bold text-text">
            {formatPrice(game.price)}
          </span>

          <p className="break-words text-base text-text-muted">
            {game.description}
          </p>

          {game.isActive ? (
            <AddToCartButton game={game} />
          ) : (
            <p className="w-fit rounded-md border border-border bg-surface-1 px-4 py-3 text-sm text-text-muted">
              This game is no longer available for purchase.
            </p>
          )}

          <details className="group rounded-lg border border-border bg-surface-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-text">
              Setup Guide
              <span className="text-text-muted transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="px-4 pb-4">
              <p className="text-sm text-text-muted">{game.setupGuide}</p>
              <Link
                href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:text-accent-strong"
              >
                Read the full redemption guide →
              </Link>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
