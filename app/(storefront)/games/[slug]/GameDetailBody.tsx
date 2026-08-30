import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/src/components/games/AddToCartButton";
import Tag from "@/src/components/games/Tag";
import TrailerEmbed from "@/src/components/games/TrailerEmbed";
import ViewGameTracker from "@/src/components/games/ViewGameTracker";
import { formatPrice } from "@/src/lib/format";
import { getGameBySlug } from "@/src/lib/catalog";
import { REDEMPTION_GUIDE_SLUG } from "@/src/lib/mock-guides";
import { SITE_URL } from "@/src/lib/site-config";
import { GAME_PLATFORM_LABELS } from "@/src/types/database";

/**
 * The one and only top-level await for this route, isolated here (rather
 * than left in page.tsx directly) so page.tsx itself can be a plain,
 * non-async function wrapping this in a hand-placed <Suspense> — same
 * pattern as /games' GamesPageBody.
 */
export default async function GameDetailBody({
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
          <div className="relative aspect-3/4 overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt">
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
            <h1 className="wrap-break-word text-display-sm font-display font-extrabold text-nova-bone">
              {game.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>{game.genre}</Tag>
              {game.platform && <Tag>{GAME_PLATFORM_LABELS[game.platform]}</Tag>}
            </div>
          </div>

          <span className="text-3xl font-display font-bold text-nova-bone">
            {formatPrice(game.price)}
          </span>

          <p className="wrap-break-word text-base text-nova-ash">
            {game.description}
          </p>

          {game.isActive ? (
            <AddToCartButton game={game} />
          ) : (
            <p className="w-fit rounded-md border border-nova-hairline bg-nova-crypt px-4 py-3 text-sm text-nova-ash">
              This game is no longer available for purchase.
            </p>
          )}

          <details className="group rounded-lg border border-nova-hairline bg-nova-crypt">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-nova-bone">
              Setup Guide
              <span className="text-nova-ash transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="px-4 pb-4">
              <p className="text-sm text-nova-ash">{game.setupGuide}</p>
              <Link
                href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-nova-ember hover:text-nova-ember-lo"
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
