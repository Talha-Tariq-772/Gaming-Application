import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as tests/admin-images.test.ts. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const {
  removeGameImage,
  removeGiftCardImage,
  uploadGameImage,
  uploadGiftCardImage,
} = await import("@/src/lib/actions/admin-images");
const { getGiftCardProductsForAdmin } = await import("@/src/lib/actions/admin-gift-cards");
const { getGiftCardImage, getCardImage, getHeaderImage } = await import("@/lib/product-image");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `ImageMgmtTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let game: { id: string; slug: string };
let membership: { id: string; slug: string };
let giftCard: { id: string; slug: string };
let realImageBuffer: Buffer;

function formDataWith(fields: Record<string, string>, bytes: Buffer): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  fd.set("file", new File([bytes as unknown as BlobPart], "art.jpg", { type: "image/jpeg" }));
  return fd;
}

/** Whether a storage object actually exists, by listing its folder —
 * `download` on a public bucket can be served from cache, so a listing is
 * the honest check for "was this really deleted". */
async function objectExists(bucket: string, folder: string, name: string): Promise<boolean> {
  const { data, error } = await service.storage.from(bucket).list(folder, { limit: 100 });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === name);
}

beforeAll(async () => {
  const emailAdmin = `img-mgmt-admin-${run}@example.com`;
  const emailCustomer = `img-mgmt-customer-${run}@example.com`;

  const { data: a, error: aErr } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (aErr) throw aErr;
  admin = { id: a.user.id, email: emailAdmin };
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: c, error: cErr } = await service.auth.admin.createUser({
    email: emailCustomer,
    password,
    email_confirm: true,
  });
  if (cErr) throw cErr;
  customer = { id: c.user.id, email: emailCustomer };

  const { data: gameRow, error: gameErr } = await service
    .from("games")
    .insert({
      title: `Image Mgmt Game ${run}`,
      slug: `image-mgmt-game-${run}`,
      genre: "Action",
      price: 999,
      is_active: true,
    })
    .select("id, slug")
    .single();
  if (gameErr) throw gameErr;
  game = gameRow;

  const { data: gcRow, error: gcErr } = await service
    .from("gift_card_products")
    .insert({
      slug: `image-mgmt-gc-${run}`,
      title: `Image Mgmt Gift Card ${run}`,
      platform: "psn",
      region: "US",
      price_pkr: 3000,
      is_active: true,
    })
    .select("id, slug")
    .single();
  if (gcErr) throw gcErr;
  giftCard = gcRow;

  const { data: memRow, error: memErr } = await service
    .from("games")
    .insert({
      title: `Image Mgmt Membership ${run}`,
      slug: `image-mgmt-membership-${run}`,
      genre: null,
      price: 1500,
      is_active: true,
      product_type: "membership",
    })
    .select("id, slug")
    .single();
  if (memErr) throw memErr;
  membership = memRow;

  // Real source art already on disk — a genuine, decodable jpeg, not a
  // synthetic fixture. Same source tests/admin-images.test.ts uses.
  const cardSourceDir = path.join(process.cwd(), "assets", "product-images", "card");
  const [firstFile] = await fs.readdir(cardSourceDir);
  realImageBuffer = await fs.readFile(path.join(cardSourceDir, firstFile));

  sessionState.client = await signedInClient(admin.email, password);
}, 120_000);

afterAll(async () => {
  await runCleanupSteps(
    [
      {
        label: "storage: game covers",
        run: async () => {
          if (game?.slug) {
            await deleteWithRetry(
              () =>
                service.storage
                  .from("game-images")
                  .remove([`covers/${game.slug}-400.webp`, `covers/${game.slug}-800.webp`]),
              "storage: game covers",
            );
          }
        },
      },
      {
        label: "storage: game wallpapers",
        run: async () => {
          if (game?.slug) {
            await deleteWithRetry(
              () =>
                service.storage
                  .from("game-images")
                  .remove([
                    `wallpapers/${game.slug}-640.webp`,
                    `wallpapers/${game.slug}-1280.webp`,
                    `wallpapers/${game.slug}-1920.webp`,
                  ]),
              "storage: game wallpapers",
            );
          }
        },
      },
      {
        label: "storage: membership header",
        run: async () => {
          if (membership?.slug) {
            await deleteWithRetry(
              () =>
                service.storage
                  .from("membership-images")
                  .remove([
                    `${membership.slug}/header-640.webp`,
                    `${membership.slug}/header-1280.webp`,
                    `${membership.slug}/header-1920.webp`,
                  ]),
              "storage: membership header",
            );
          }
        },
      },
      {
        label: "storage: gift card art",
        run: async () => {
          if (giftCard?.slug) {
            await deleteWithRetry(
              () =>
                service.storage
                  .from("gift-card-images")
                  .remove([`${giftCard.slug}/card.webp`, `${giftCard.slug}/header.webp`]),
              "storage: gift card art",
            );
          }
        },
      },
      {
        label: "gift card",
        run: async () => {
          if (giftCard?.id) {
            await deleteWithRetry(
              () => service.from("gift_card_products").delete().eq("id", giftCard.id),
              "gift card",
            );
          }
        },
      },
      {
        label: "games",
        run: async () => {
          const ids = [game?.id, membership?.id].filter((id): id is string => Boolean(id));
          if (ids.length) {
            await deleteWithRetry(() => service.from("games").delete().in("id", ids), "games");
          }
        },
      },
      {
        label: "admin",
        run: async () => {
          if (admin?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(admin.id), "admin");
        },
      },
      {
        label: "customer",
        run: async () => {
          if (customer?.id) {
            await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
          }
        },
      },
    ],
    20_000,
  );
}, 180_000);

/* ------------------------------------------------------------------ */
/* Authorization                                                       */
/* ------------------------------------------------------------------ */

describe("image management is admin-only", () => {
  it("rejects a non-admin session on every action", async () => {
    sessionState.client = await signedInClient(customer.email, password);

    await expect(
      uploadGiftCardImage(formDataWith({ productId: giftCard.id, kind: "card" }, realImageBuffer)),
    ).rejects.toThrow();
    await expect(removeGiftCardImage(giftCard.id, "card")).rejects.toThrow();
    await expect(removeGameImage(game.id, "cover")).rejects.toThrow();
    await expect(getGiftCardProductsForAdmin()).rejects.toThrow();

    sessionState.client = await signedInClient(admin.email, password);
  });
});

/* ------------------------------------------------------------------ */
/* Games: upload, replace, remove                                      */
/* ------------------------------------------------------------------ */

describe("game cover and wallpaper: upload, replace, remove", () => {
  it("uploads a cover, writes every derivative, and records the path", async () => {
    const result = await uploadGameImage(
      formDataWith({ gameId: game.id, kind: "cover" }, realImageBuffer),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(`covers/${game.slug}`);

    for (const width of [400, 800]) {
      expect(await objectExists("game-images", "covers", `${game.slug}-${width}.webp`)).toBe(true);
    }

    const { data: row } = await service
      .from("games")
      .select("cover_path")
      .eq("id", game.id)
      .single();
    expect(row!.cover_path).toBe(`covers/${game.slug}`);
  });

  it("replaces in place, keeping the same path and derivative set", async () => {
    // Replace writes to the same object path (upsert), so the stored path
    // is unchanged — which is exactly why the dialog cache-busts its
    // preview rather than relying on a new URL.
    const before = await service.from("games").select("cover_path").eq("id", game.id).single();

    const result = await uploadGameImage(
      formDataWith({ gameId: game.id, kind: "cover" }, realImageBuffer),
    );
    expect(result.ok).toBe(true);

    const after = await service.from("games").select("cover_path").eq("id", game.id).single();
    expect(after.data!.cover_path).toBe(before.data!.cover_path);
    expect(await objectExists("game-images", "covers", `${game.slug}-800.webp`)).toBe(true);
  });

  it("removes the cover: every derivative object goes, and the column is nulled", async () => {
    const result = await removeGameImage(game.id, "cover");
    expect(result.ok, result.ok ? "" : result.message).toBe(true);

    for (const width of [400, 800]) {
      expect(
        await objectExists("game-images", "covers", `${game.slug}-${width}.webp`),
        `covers/${game.slug}-${width}.webp should be gone`,
      ).toBe(false);
    }

    const { data: row } = await service
      .from("games")
      .select("cover_path")
      .eq("id", game.id)
      .single();
    expect(row!.cover_path).toBeNull();
  });

  it("removing an image that was never set succeeds instead of erroring", async () => {
    // The requested end state (no image) already holds. An admin
    // double-clicking Remove should not be shown a failure.
    const result = await removeGameImage(game.id, "cover");
    expect(result.ok).toBe(true);
  });

  it("uploads and removes a wallpaper independently of the cover", async () => {
    const uploaded = await uploadGameImage(
      formDataWith({ gameId: game.id, kind: "wallpaper" }, realImageBuffer),
    );
    expect(uploaded.ok, uploaded.ok ? "" : uploaded.message).toBe(true);
    expect(await objectExists("game-images", "wallpapers", `${game.slug}-1920.webp`)).toBe(true);

    const removed = await removeGameImage(game.id, "wallpaper");
    expect(removed.ok).toBe(true);
    for (const width of [640, 1280, 1920]) {
      expect(await objectExists("game-images", "wallpapers", `${game.slug}-${width}.webp`)).toBe(
        false,
      );
    }

    const { data: row } = await service
      .from("games")
      .select("cover_path, wallpaper_path")
      .eq("id", game.id)
      .single();
    expect(row!.wallpaper_path).toBeNull();
    // Removing one must not disturb the other.
    expect(row!.cover_path).toBeNull();
  });

  it("uploads a membership header into the membership-images bucket", async () => {
    // The path that repopulates membership art. A membership has no
    // cover by design (uploadGameImage rejects that combination) — its
    // header is stored as wallpaper_path, in a DIFFERENT bucket and
    // under a different prefix shape ({slug}/header, not
    // wallpapers/{slug}). Nothing covered that branch end to end, and
    // it is the one an admin needs when membership_images is empty.
    const result = await uploadGameImage(
      formDataWith({ gameId: membership.id, kind: "wallpaper" }, realImageBuffer),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(`${membership.slug}/header`);

    for (const width of [640, 1280, 1920]) {
      expect(
        await objectExists("membership-images", membership.slug, `header-${width}.webp`),
      ).toBe(true);
    }

    const { data: row } = await service
      .from("games")
      .select("wallpaper_path, cover_path")
      .eq("id", membership.id)
      .single();
    expect(row!.wallpaper_path).toBe(`${membership.slug}/header`);
    expect(row!.cover_path).toBeNull();
  });

  it("removes a membership header from the right bucket", async () => {
    // removeGameImage has to resolve the same bucket/prefix the upload
    // used " + D + " a remove that computed "game-images/wallpapers/{slug}"
    // would null the column while leaving the real objects behind.
    const result = await removeGameImage(membership.id, "wallpaper");
    expect(result.ok, result.ok ? "" : result.message).toBe(true);

    for (const width of [640, 1280, 1920]) {
      expect(
        await objectExists("membership-images", membership.slug, `header-${width}.webp`),
        `${membership.slug}/header-${width}.webp should be gone`,
      ).toBe(false);
    }

    const { data: row } = await service
      .from("games")
      .select("wallpaper_path")
      .eq("id", membership.id)
      .single();
    expect(row!.wallpaper_path).toBeNull();
  });

  it("rejects a file that isn't a decodable image", async () => {
    const notAnImage = Buffer.from("MZ\u0090\u0000this is an executable, not a picture");
    const fd = new FormData();
    fd.set("gameId", game.id);
    fd.set("kind", "cover");
    // A spoofed image/jpeg Content-Type — the magic-byte decode is what
    // has to catch this, not the header.
    fd.set("file", new File([notAnImage as unknown as BlobPart], "evil.jpg", { type: "image/jpeg" }));

    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/readable image|supported/i);
  });
});

/* ------------------------------------------------------------------ */
/* Gift cards: upload, replace, remove                                 */
/* ------------------------------------------------------------------ */

describe("gift card art: upload, replace, remove", () => {
  it("uploads a card image and records its public URL", async () => {
    const result = await uploadGiftCardImage(
      formDataWith({ productId: giftCard.id, kind: "card" }, realImageBuffer),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;

    expect(result.url).toContain("gift-card-images");
    expect(result.url).toContain(`${giftCard.slug}/card.webp`);
    expect(await objectExists("gift-card-images", giftCard.slug, "card.webp")).toBe(true);

    const { data: row } = await service
      .from("gift_card_products")
      .select("card_image_url")
      .eq("id", giftCard.id)
      .single();
    expect(row!.card_image_url).toBe(result.url);
  });

  it("uploads a header image into the same product folder", async () => {
    const result = await uploadGiftCardImage(
      formDataWith({ productId: giftCard.id, kind: "header" }, realImageBuffer),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain(`${giftCard.slug}/header.webp`);
    expect(await objectExists("gift-card-images", giftCard.slug, "header.webp")).toBe(true);
  });

  it("the uploaded card image becomes what the storefront resolves", async () => {
    const { data: row } = await service
      .from("gift_card_products")
      .select("card_image_url, platform")
      .eq("id", giftCard.id)
      .single();

    const resolved = getGiftCardImage({
      cardImageUrl: row!.card_image_url,
      platform: row!.platform,
    });
    expect(resolved).toBe(row!.card_image_url);
  });

  it("removes the card image and restores the per-platform fallback", async () => {
    const result = await removeGiftCardImage(giftCard.id, "card");
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    expect(await objectExists("gift-card-images", giftCard.slug, "card.webp")).toBe(false);

    const { data: row } = await service
      .from("gift_card_products")
      .select("card_image_url, header_image_url, platform")
      .eq("id", giftCard.id)
      .single();
    expect(row!.card_image_url).toBeNull();
    // Removing one must not disturb the other.
    expect(row!.header_image_url).not.toBeNull();

    // The page still has a real image to render — this is the "removal
    // doesn't break the page" guarantee, at the resolver level.
    const resolved = getGiftCardImage({ cardImageUrl: null, platform: row!.platform });
    expect(resolved).toBe("/products/gift-cards/optimised/psn.webp");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("removes the header image, leaving the shared banner to take over", async () => {
    const result = await removeGiftCardImage(giftCard.id, "header");
    expect(result.ok).toBe(true);
    expect(await objectExists("gift-card-images", giftCard.slug, "header.webp")).toBe(false);

    const { data: row } = await service
      .from("gift_card_products")
      .select("header_image_url")
      .eq("id", giftCard.id)
      .single();
    // GiftCardsHero falls back to the shared artwork on a null imageUrl —
    // there is no state in which the banner has no src at all.
    expect(row!.header_image_url).toBeNull();
  });

  it("removing art that was never set succeeds", async () => {
    expect((await removeGiftCardImage(giftCard.id, "card")).ok).toBe(true);
    expect((await removeGiftCardImage(giftCard.id, "header")).ok).toBe(true);
  });

  it("reports a deleted product rather than failing opaquely", async () => {
    const missing = randomUUID();
    const uploaded = await uploadGiftCardImage(
      formDataWith({ productId: missing, kind: "card" }, realImageBuffer),
    );
    expect(uploaded.ok).toBe(false);
    if (uploaded.ok) return;
    expect(uploaded.message).toMatch(/no longer exists/i);

    const removed = await removeGiftCardImage(missing, "card");
    expect(removed.ok).toBe(false);
    if (removed.ok) return;
    expect(removed.message).toMatch(/no longer exists/i);
  });

  it("the admin listing includes inactive products the public query cannot see", async () => {
    await service.from("gift_card_products").update({ is_active: false }).eq("id", giftCard.id);

    const listed = await getGiftCardProductsForAdmin();
    expect(listed.some((p) => p.id === giftCard.id)).toBe(true);

    await service.from("gift_card_products").update({ is_active: true }).eq("id", giftCard.id);
  });
});

/* ------------------------------------------------------------------ */
/* The fallback guarantee                                              */
/* ------------------------------------------------------------------ */

describe("a product with no stored art still resolves a real image", () => {
  it("getCardImage never returns an empty src", () => {
    // <Image> throws outright on an empty src, so "falls back to a
    // placeholder" has to mean a real non-empty path, not "".
    const resolved = getCardImage({
      slug: `nonexistent-${run}`,
      coverPath: null,
      coverImageUrl: "",
    });
    expect(resolved).toBe("/game-cover-placeholder.png");
  });

  it("getHeaderImage never returns an empty src", () => {
    const resolved = getHeaderImage({ slug: `nonexistent-${run}`, wallpaperPath: null });
    expect(resolved).toBe("/game-header-placeholder.png");
  });

  it("a real game with both images removed resolves to placeholders, not blanks", async () => {
    const { data: row } = await service
      .from("games")
      .select("slug, cover_path, wallpaper_path, cover_image_url, product_type")
      .eq("id", game.id)
      .single();
    expect(row!.cover_path).toBeNull();
    expect(row!.wallpaper_path).toBeNull();

    const cover = getCardImage({
      slug: row!.slug,
      coverPath: row!.cover_path,
      coverImageUrl: row!.cover_image_url ?? "",
    });
    const header = getHeaderImage({ slug: row!.slug, wallpaperPath: row!.wallpaper_path });

    expect(cover.length).toBeGreaterThan(0);
    expect(header.length).toBeGreaterThan(0);
    expect(cover).toBe("/game-cover-placeholder.png");
    expect(header).toBe("/game-header-placeholder.png");
  });
});
