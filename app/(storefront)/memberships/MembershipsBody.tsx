import { chamferClipPath } from "@/src/components/ui/nova/Chamfer";
import Eyebrow from "@/src/components/ui/nova/Eyebrow";
import FadeDivider from "@/src/components/ui/nova/FadeDivider";
import VariantPicker from "@/src/components/games/VariantPicker";
import SetupGuideCard from "@/src/components/guides/SetupGuideCard";
import { getGames, getGameStock } from "@/src/lib/catalog";
import { getSetupGuideById } from "@/src/lib/setup-guides";
import { gameWallpaperImage, membershipSectionHeaderImage } from "@/src/lib/storage-image";
import type { Game, SetupGuide } from "@/src/types/database";

/**
 * One product card: its own wallpaper (each membership has its own
 * "{slug}/header" — see 20260829000004_seed_catalog.sql), title, and the
 * exact same VariantPicker/AddToCartButton every game detail page uses —
 * unchanged, not a membership-specific variant of either.
 */
function MembershipProductCard({ game, inStock }: { game: Game; inStock: boolean }) {
  const wallpaper = game.wallpaperPath ? gameWallpaperImage(game.wallpaperPath, game.productType) : null;

  return (
    <div
      style={chamferClipPath(12)}
      className="flex flex-col overflow-hidden border border-nova-hairline bg-nova-crypt"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-nova-slab">
        {wallpaper && (
          // eslint-disable-next-line @next/next/no-img-element -- wallpaperPath derivatives are already exact pre-sized .webp files; see storage-image.ts
          <img
            src={wallpaper.src}
            srcSet={wallpaper.srcSet}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h2 className="wrap-break-word font-display text-lg font-bold text-nova-bone">{game.title}</h2>
        <VariantPicker game={game} inStock={inStock} />
      </div>
    </div>
  );
}

/**
 * The one real await for this route, isolated here the same way
 * GameDetailBody/GamesPageBody split theirs out — page.tsx stays a plain
 * synchronous Suspense wrapper.
 */
export default async function MembershipsBody() {
  const memberships = await getGames({ productType: "membership", sort: "name" });
  const stocks = await Promise.all(memberships.map((m) => getGameStock(m.id)));

  // All three share one setup_guide_id today (20260831000002_seed_setup_
  // guides.sql links every membership row to the same guide) — dedupe by
  // id so it renders once, not three identical cards. Written generically
  // in case that ever changes.
  const guideIds = [...new Set(memberships.map((m) => m.setupGuideId).filter((id): id is string => id !== null))];
  const guides = (await Promise.all(guideIds.map((id) => getSetupGuideById(id)))).filter(
    (g): g is SetupGuide => g !== null,
  );

  const header = membershipSectionHeaderImage();

  return (
    <div>
      {/* Full-bleed header — same clamp() height and vertical falloff as
          the game detail page's wallpaper (GameDetailBody.tsx), using the
          shared bucket-root header instead of any one product's own. */}
      <div
        className="relative w-full overflow-hidden bg-nova-crypt"
        style={{ height: "clamp(420px, 45vw, 620px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- bucket-root derivatives are already exact pre-sized .webp files; see storage-image.ts */}
        <img
          src={header.src}
          srcSet={header.srcSet}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-nova-void/20 to-nova-void"
        />
      </div>

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div
          data-testid="memberships-hero"
          className="relative -mt-16 flex flex-col gap-2 pb-1 sm:-mt-20 md:-mt-24 md:pb-2"
        >
          <Eyebrow>Memberships</Eyebrow>
          {/* An arbitrary-value font-size below sm, not text-display-sm at
              every breakpoint like GameDetailBody's title — "PLAYSTATION"
              (11 uppercase characters, no internal break point) is wider
              on its own than a 390px column at display-sm's ~44px size,
              forcing wrap-break-word's last-resort mid-word split
              ("PLAYSTATI/ON"). Confirmed via a real browser render at
              390px, not assumed.
              Deliberately text-[1.75rem], not a named size like text-2xl:
              globals.css has a `.font-display.text-lg/xl/2xl` override
              (uppercase + font-size: var(--text-heading)) that sits
              outside Tailwind's own layers specifically to beat utility
              specificity — including responsive ones. Since it matches on
              the literal class name and `sm:text-display-sm` is a
              different token than `text-display-sm`, that override doesn't
              get cancelled at sm: and up, so it was capping the heading at
              ~40px even at 1440px (confirmed: measured hero height dropped
              from 237px to 157px there when text-2xl was tried). An
              arbitrary value matches none of these compound selectors, so
              sm:text-display-sm's normal mobile-first override applies
              cleanly; uppercase/tracking/leading are added by hand to match
              text-display-sm's own values since its special-case rule
              doesn't apply below sm: either — kept in sync with that rule
              by hand (Session 9: 0.92/0.04em -> 1.05/0.02em, matching
              Session 7's line-height fix that this file had fallen out of
              sync with; also dropped font-extrabold here, since
              text-[1.75rem] isn't covered by the compound rule either and
              was requesting a weight Marcellus doesn't ship). */}
          <h1 className="wrap-break-word font-display text-[1.75rem] leading-[1.05] uppercase tracking-[0.02em] text-nova-bone sm:text-display-sm">
            PlayStation & Xbox Memberships
          </h1>
          <p className="mt-2 max-w-2xl text-base text-nova-ash">
            Delivered as full account credentials, same as every game in the store — pay, get approved, reveal
            the login, and activate on your console.
          </p>
        </div>

        <div data-testid="memberships-grid" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership, i) => (
            <MembershipProductCard
              key={membership.id}
              game={membership}
              inStock={membership.isActive && stocks[i] > 0}
            />
          ))}
        </div>

        <FadeDivider className="my-12" />

        <div data-testid="memberships-guide" className="max-w-3xl pb-16">
          <Eyebrow tone="muted">Setup Guide</Eyebrow>
          {/* Only force 2 columns once there's a second guide to fill the
              other one — today there's exactly one (all three memberships
              point at the same setup_guide_id), and cramming its card into
              a half-width column at this section's max-w-3xl forced
              SetupGuideCard's title to wrap mid-word at 1440px. Confirmed
              via a real browser render, not assumed. */}
          <div className={`mt-4 grid gap-4 ${guides.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {guides.map((guide) => (
              <SetupGuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
