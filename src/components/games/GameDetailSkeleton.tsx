/**
 * Reserves the redesigned game detail page's real footprint during
 * app/(storefront)/games/[slug]'s route-level loading.tsx window. Every
 * value below is a directly measured real height (390/768/1440px) across
 * three seeded games, not an estimate:
 *
 * - Wallpaper: same clamp(420px, 45vw, 620px) formula as the real header
 *   and the store slider — deterministic, not measured.
 * - Hero row (cover + eyebrow/title): 232px @390, 235px @768/1440 — the
 *   worst case across the catalog's longest title ("Call of Duty: Modern
 *   Warfare II", 5 wrapped lines at 390px); every shorter title's row is
 *   cover-art-height-dominated instead (still ≤235px). A future title
 *   longer than that one would need re-measuring.
 * - Purchase block: sized to the single-variant path (108/116/125px),
 *   since 15 of the catalog's 16 games are variantMode='single' — gta-vi,
 *   the one multi-variant game, has a taller real block (variant pills)
 *   and will show a somewhat larger shift than everything else. Accepted,
 *   not chased — see this session's CLS report.
 * - Content block (genre/release-date/setup guide): 257-262px across
 *   breakpoints for every current game, all of which lack a trailer,
 *   description, and platform value — re-measure if any of the three stop
 *   being universally empty/null. Re-measured this session after the setup
 *   guide placeholder was replaced with a real, collapsed-by-default
 *   `<details>` (Session 4) — collapsed height (~90-93px including its
 *   label) is noticeably shorter than the old dashed placeholder box it
 *   replaced (was ~312-322px total), so the last skeleton row below was
 *   shrunk from h-24 to h-14 to match.
 */
export default function GameDetailSkeleton() {
  return (
    <div>
      <div className="w-full bg-nova-crypt" style={{ height: "clamp(420px, 45vw, 620px)" }} />

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div className="relative -mt-16 flex h-[232px] items-end gap-5 sm:-mt-20 sm:h-[235px] md:-mt-24 md:gap-8">
          <div className="aspect-3/4 w-28 shrink-0 animate-pulse rounded-lg bg-nova-slab sm:w-36 md:w-44" />
          <div className="flex flex-1 flex-col justify-end gap-2 pb-1 md:pb-2">
            <div className="h-[11px] w-24 animate-pulse rounded-full bg-nova-slab" />
            <div className="h-9 w-full animate-pulse rounded bg-nova-slab sm:h-12 md:h-14" />
          </div>
        </div>

        <div className="mt-8 flex max-w-md flex-col gap-3 md:mt-10">
          <div className="h-9 w-40 animate-pulse rounded bg-nova-slab" />
          <div className="h-11 w-36 animate-pulse rounded bg-nova-slab" />
        </div>

        <div className="my-12 h-px w-full bg-nova-hairline" />

        <div className="flex max-w-3xl flex-col gap-8 pb-16">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-[11px] w-14 animate-pulse rounded-full bg-nova-slab" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-nova-slab" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-[11px] w-20 animate-pulse rounded-full bg-nova-slab" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-nova-slab" />
          </div>
        </div>
      </div>
    </div>
  );
}
