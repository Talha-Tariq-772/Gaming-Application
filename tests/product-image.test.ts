import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getCardImage, getHeaderImage } from "@/lib/product-image";
import { GAME_COVER_PLACEHOLDER, GAME_HEADER_PLACEHOLDER } from "@/src/lib/game-placeholder";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The 16 real catalog games seeded by
 * supabase/migrations/20260829000004_seed_catalog.sql — deliberately NOT
 * "every row currently in `games`": several other suites (admin-images,
 * admin-variants, rls, ...) create and delete their own transient test
 * rows against this same live project, often concurrently (vitest runs
 * test files in parallel, see vitest.config.mts). Scanning the live table
 * unfiltered caught exactly that race once — a still-being-cleaned-up
 * fixture row with no cover art at all, correctly but spuriously flagged
 * as a placeholder miss. Pinning to the known seed slugs makes this test
 * deterministic regardless of what else is running.
 */
const SEEDED_GAME_SLUGS = [
  "gta-vi",
  "ghost-of-yotei",
  "battlefield-6",
  "black-myth-wukong",
  "cod-black-ops-6",
  "fc-27",
  "fc-26",
  "need-for-speed-unbound",
  "assassins-creed-valhalla",
  "cod-modern-warfare-2",
  "dragon-ball-sparking-zero",
  "silent-hill-2",
  "spider-man-2",
  "hogwarts-legacy",
  "remnant-2",
  "dead-island-2",
];
const SEEDED_MEMBERSHIP_SLUGS = ["playstation-plus", "ps-plus-extra-premium", "xbox-game-pass-ultimate"];

/**
 * Read-only against the live catalog — no rows created, nothing to clean
 * up. Asserts every *game* row (not membership: those have no cover_path
 * by design, see 20260829000002_games_catalog_columns.sql's column
 * comment) resolves to real card AND header art through
 * lib/product-image.ts's full priority chain (local manifest, then
 * Supabase-managed coverPath/wallpaperPath), never the placeholder.
 * Memberships are reported separately, not asserted — a membership
 * falling through to the card placeholder is expected, not a bug.
 */
describe("product image resolution — every catalog row", () => {
  it("every active game resolves a non-placeholder card and header image", async () => {
    const { data, error } = await service
      .from("games")
      .select("slug, product_type, cover_path, wallpaper_path, cover_image_url")
      .in("slug", [...SEEDED_GAME_SLUGS, ...SEEDED_MEMBERSHIP_SLUGS])
      .order("slug", { ascending: true });
    if (error) throw error;
    expect(data?.length).toBe(SEEDED_GAME_SLUGS.length + SEEDED_MEMBERSHIP_SLUGS.length);

    const games = (data ?? []).filter((row) => row.product_type === "game");
    const memberships = (data ?? []).filter((row) => row.product_type === "membership");
    expect(games.length).toBe(SEEDED_GAME_SLUGS.length);

    const cardMisses: string[] = [];
    const headerMisses: string[] = [];

    for (const row of games) {
      const gameShape = {
        slug: row.slug,
        coverPath: row.cover_path,
        coverImageUrl: row.cover_image_url || GAME_COVER_PLACEHOLDER,
        wallpaperPath: row.wallpaper_path,
        productType: row.product_type as "game" | "membership",
      };
      const card = getCardImage(gameShape);
      const header = getHeaderImage(gameShape);
      if (card === GAME_COVER_PLACEHOLDER) cardMisses.push(row.slug);
      if (header === GAME_HEADER_PLACEHOLDER) headerMisses.push(row.slug);
    }

    // Informational only — memberships are expected to miss the card side.
    const membershipCardMisses = memberships
      .filter((row) => {
        const gameShape = {
          slug: row.slug,
          coverPath: row.cover_path,
          coverImageUrl: row.cover_image_url || GAME_COVER_PLACEHOLDER,
          wallpaperPath: row.wallpaper_path,
          productType: row.product_type as "game" | "membership",
        };
        return getCardImage(gameShape) === GAME_COVER_PLACEHOLDER;
      })
      .map((row) => row.slug);
    if (membershipCardMisses.length > 0) {
      console.log(
        `[product-image test] memberships with no card art (expected, informational): ${membershipCardMisses.join(", ")}`,
      );
    }

    if (cardMisses.length > 0 || headerMisses.length > 0) {
      throw new Error(
        [
          "Games that fell through to a placeholder:",
          cardMisses.length > 0 ? `  card: ${cardMisses.join(", ")}` : null,
          headerMisses.length > 0 ? `  header: ${headerMisses.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  });
});
