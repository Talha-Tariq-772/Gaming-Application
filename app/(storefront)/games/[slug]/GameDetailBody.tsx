import Link from "next/link";
import { notFound } from "next/navigation";
import { chamferClipPath } from "@/src/components/ui/nova/Chamfer";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import FadeDivider from "@/src/components/ui/nova/FadeDivider";
import Tag from "@/src/components/games/Tag";
import TrailerEmbed from "@/src/components/games/TrailerEmbed";
import ViewGameTracker from "@/src/components/games/ViewGameTracker";
import VariantPicker from "@/src/components/games/VariantPicker";
import { formatDate } from "@/src/lib/date";
import { getGameBySlug, getGameStock } from "@/src/lib/catalog";
import { renderMarkdown } from "@/src/lib/markdown";
import { REDEMPTION_GUIDE_SLUG } from "@/src/lib/mock-guides";
import { getSetupGuideById } from "@/src/lib/setup-guides";
import { SITE_URL } from "@/src/lib/site-config";
import { gameCoverImage, gameWallpaperImage } from "@/src/lib/storage-image";
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

  const [stock, setupGuide] = await Promise.all([
    getGameStock(game.id),
    getSetupGuideById(game.setupGuideId),
  ]);
  const setupGuideHtml = setupGuide ? renderMarkdown(setupGuide.body).html : null;

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
      availability:
        game.isActive && stock > 0
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

  const wallpaper = game.wallpaperPath ? gameWallpaperImage(game.wallpaperPath, game.productType) : null;
  const cover = game.coverPath ? gameCoverImage(game.coverPath) : null;
  const eyebrowText = [game.genre, game.platform ? GAME_PLATFORM_LABELS[game.platform] : null]
    .filter(Boolean)
    .join(" · ");
  const hasDescription = game.description.trim().length > 0;

  return (
    <div>
      {/* Our own mock data, not user input — safe to serialize directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ViewGameTracker gameId={game.id} genre={game.genre} platform={game.platform} />

      {/* Full-bleed wallpaper header — outside the max-w-page wrapper below,
          same edge-to-edge treatment as StoreSliderSection, same reserved
          clamp() height as the slider so it never sizes off the loaded
          image. Falls back to the flat cover image (still inside a
          fixed-height container) for the handful of rows without a
          wallpaper_path — memberships today. */}
      <div
        className="relative w-full overflow-hidden bg-nova-crypt"
        style={{ height: "clamp(420px, 45vw, 620px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- wallpaperPath derivatives are already exact pre-sized .webp files; see storage-image.ts */}
        <img
          src={wallpaper ? wallpaper.src : game.coverImageUrl}
          srcSet={wallpaper?.srcSet}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Vertical falloff into nova-void — merges the wallpaper into the
            page instead of ending on a hard edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-nova-void/20 to-nova-void"
        />
      </div>

      <div className="mx-auto max-w-page px-4 md:px-8">
        {/* Cover overlapping the wallpaper's bottom edge on the left, title
            beside it — the overlap is a negative margin on this whole row,
            not absolute positioning, so it stays correct regardless of the
            wallpaper's own (fixed, clamp()'d) height. */}
        <div
          data-testid="game-hero-row"
          className="relative -mt-16 flex items-end gap-5 sm:-mt-20 md:-mt-24 md:gap-8"
        >
          <div
            style={chamferClipPath(12)}
            className="relative aspect-3/4 w-28 shrink-0 overflow-hidden border border-nova-hairline bg-nova-crypt sm:w-36 md:w-44"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- coverPath derivatives are already exact pre-sized .webp files; see storage-image.ts */}
            <img
              src={cover ? cover.src : game.coverImageUrl}
              srcSet={cover?.srcSet}
              sizes="(min-width: 768px) 176px, 112px"
              alt={game.title}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-2 pb-1 md:pb-2">
            {eyebrowText && <Eyebrow>{eyebrowText}</Eyebrow>}
            <h1 className="wrap-break-word font-display text-display-sm font-extrabold text-nova-bone">
              {game.title}
            </h1>
          </div>
        </div>

        <div data-testid="game-purchase" className="mt-8 max-w-md md:mt-10">
          <VariantPicker game={game} inStock={game.isActive && stock > 0} />
        </div>

        <FadeDivider className="my-12" />

        {/* Single stacked column, not a two-column split — no seeded game
            has a trailer_url or non-empty description today (neither
            column ever got populated in any migration), so a
            trailer-and-description-on-the-left / details-on-the-right
            grid would leave the entire left column dead space on every
            real game page. TrailerEmbed/hasDescription still render
            correctly the moment either field is populated. */}
        <div data-testid="game-content" className="flex max-w-3xl flex-col gap-10 pb-16">
          <TrailerEmbed
            trailerUrl={game.trailerUrl}
            posterUrl={game.coverImageUrl}
            title={game.title}
          />
          {hasDescription && (
            <p className="wrap-break-word text-base text-nova-ash">{game.description}</p>
          )}

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div>
              <Eyebrow tone="muted">Genre</Eyebrow>
              <p className="mt-2 text-sm text-nova-bone">
                <Tag>{game.genre}</Tag>
              </p>
            </div>
            {game.platform && (
              <div>
                <Eyebrow tone="muted">Platform</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">
                  <Tag>{GAME_PLATFORM_LABELS[game.platform]}</Tag>
                </p>
              </div>
            )}
            {game.releaseDate && (
              <div>
                <Eyebrow tone="muted">Release Date</Eyebrow>
                <p className="mt-2 text-sm text-nova-bone">{formatDate(game.releaseDate)}</p>
              </div>
            )}
          </div>

          <div>
            <Eyebrow tone="muted">Setup Guide</Eyebrow>
            {setupGuide && setupGuideHtml ? (
              <details
                style={chamferClipPath(10)}
                className="group mt-2 border border-nova-hairline bg-nova-crypt"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-4 text-sm font-semibold text-nova-bone">
                  {setupGuide.title}
                  <span className="text-nova-ash transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div
                  className="markdown-body px-4 pb-5"
                  dangerouslySetInnerHTML={{ __html: setupGuideHtml }}
                />
                <div className="px-4 pb-5">
                  <Link
                    href={`/guides/${setupGuide.slug}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-nova-ember hover:text-nova-ember-lo"
                  >
                    Open the full guide →
                  </Link>
                </div>
              </details>
            ) : (
              <div
                style={chamferClipPath(10)}
                className="mt-2 flex flex-col items-start gap-2 border border-dashed border-nova-hairline bg-nova-crypt px-4 py-5"
              >
                <p className="text-sm text-nova-ash">This game&apos;s setup guide is coming soon.</p>
                <Link
                  href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-nova-ember hover:text-nova-ember-lo"
                >
                  In the meantime, see the general redemption guide →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
