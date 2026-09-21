"use server";

import sharp from "sharp";
import { COVER_WIDTHS, WALLPAPER_WIDTHS, processCover, processWallpaper } from "@/src/lib/image-processing";
import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Real formats sharp can decode AND that the game-images/membership-images/
// gift-card-images buckets accept (the allowed_mime_types on each, see
// 20260829000001_storage_buckets.sql and 20260921000003_gift_card_images.sql).
// Checked against sharp's own parse of the file's magic bytes below, never
// the client-supplied MIME header — that header is attacker-controlled and
// proves nothing about the actual bytes.
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ImageKind = "cover" | "wallpaper";
export type GiftCardImageKind = "card" | "header";

export type UploadGameImageResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

export type RemoveImageResult = { ok: true } | { ok: false; message: string };

export type UploadGiftCardImageResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Shared front half of every upload action: size gate, then a real
 * magic-number decode. Extracted when gift cards gained their own upload
 * so the two paths cannot drift on what counts as an acceptable file —
 * this is the check that stops a renamed .exe or an SVG with a spoofed
 * "image/jpeg" Content-Type, and it must be identical everywhere.
 */
async function readValidatedImage(
  file: unknown,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; message: string }> {
  if (!(file instanceof File)) {
    return { ok: false, message: "No file was uploaded." };
  }
  if (file.size === 0) {
    return { ok: false, message: "The uploaded file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Image must be 10MB or smaller." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    return { ok: false, message: "That file isn't a readable image." };
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    return { ok: false, message: "Only JPEG, PNG, or WebP images are supported." };
  }

  return { ok: true, buffer };
}

/** Bucket/prefix conventions, matching src/lib/storage-image.ts exactly:
 * covers always live in game-images regardless of product type; wallpaper
 * location depends on product type. One function so the upload and the
 * REMOVE below can never disagree about where an object lives — a remove
 * that computed a different path would silently leave the real file
 * behind while nulling the column. */
function gameImageLocation(
  kind: ImageKind,
  slug: string,
  isMembership: boolean,
): { bucket: string; prefix: string; widths: readonly number[] } {
  if (kind === "cover") {
    return { bucket: "game-images", prefix: `covers/${slug}`, widths: COVER_WIDTHS };
  }
  return {
    bucket: isMembership ? "membership-images" : "game-images",
    prefix: isMembership ? `${slug}/header` : `wallpapers/${slug}`,
    widths: WALLPAPER_WIDTHS,
  };
}

/**
 * First FormData action in the app, and the first place any request body
 * reaches sharp — so nothing here is trusted before it's checked:
 *   1. requireAdmin() before anything else, including reading the file.
 *   2. Declared size checked before the bytes are ever read into memory.
 *   3. The bytes themselves are parsed by sharp (real magic-number decode,
 *      not a MIME-header guess) and rejected on throw or on an unsupported
 *      decoded format.
 * Only after all of that does anything reach processCover/processWallpaper.
 */
export async function uploadGameImage(formData: FormData): Promise<UploadGameImageResult> {
  await requireAdmin();

  const gameId = formData.get("gameId");
  const kind = formData.get("kind");

  if (typeof gameId !== "string" || !gameId) {
    return { ok: false, message: "Missing game." };
  }
  if (kind !== "cover" && kind !== "wallpaper") {
    return { ok: false, message: "Invalid image type." };
  }

  const service = createServiceClient();

  // Upload is edit-mode only — a game with no row yet (still being drafted
  // client-side, gameId not yet issued) has nothing to attach an image to.
  const { data: game, error: gameErr } = await service
    .from("games")
    .select("id, slug, product_type, cover_path, wallpaper_path")
    .eq("id", gameId)
    .single();
  if (gameErr || !game) {
    return { ok: false, message: "Save this game before uploading images." };
  }

  // Memberships only ever have a header image (stored via wallpaper_path) —
  // cover_path is documented null for every membership row in the catalog
  // (20260829000002_games_catalog_columns.sql). Keep that invariant true
  // instead of letting an upload silently create an inconsistent row.
  if (kind === "cover" && game.product_type === "membership") {
    return { ok: false, message: "Memberships don't have cover art — only a header image." };
  }

  const validated = await readValidatedImage(formData.get("file"));
  if (!validated.ok) return validated;

  const isMembership = game.product_type === "membership";
  const { bucket, prefix } = gameImageLocation(kind, game.slug, isMembership);

  const derivatives =
    kind === "cover" ? await processCover(validated.buffer) : await processWallpaper(validated.buffer);

  for (const { width, buffer } of derivatives) {
    const { error: uploadErr } = await service.storage
      .from(bucket)
      .upload(`${prefix}-${width}.webp`, buffer, { contentType: "image/webp", upsert: true });
    if (uploadErr) {
      console.error("[uploadGameImage] storage upload", uploadErr);
      return { ok: false, message: "Something went wrong uploading this image." };
    }
  }

  const column = kind === "cover" ? "cover_path" : "wallpaper_path";
  const { error: updateErr } = await service.from("games").update({ [column]: prefix }).eq("id", game.id);
  if (updateErr) {
    console.error("[uploadGameImage] db update", updateErr);
    return { ok: false, message: "Image uploaded, but saving it to the game failed." };
  }

  return { ok: true, path: prefix };
}

/**
 * Removes a game's cover or wallpaper: every derivative object first, then
 * the column that points at them.
 *
 * Order matters and is deliberate. Clearing the column first would leave
 * the objects unreferenced if the storage call then failed — invisible
 * junk nothing will ever clean up. Deleting objects first means the worst
 * case is a column pointing at files that no longer exist, which the
 * render path already survives: getCardImage/getHeaderImage fall through
 * to the placeholder, and a broken <img> src is not a 500.
 *
 * Removing an image that was never set is a success, not an error — the
 * requested end state (no image) already holds, and an admin double-
 * clicking Remove should not see a failure.
 */
export async function removeGameImage(gameId: string, kind: ImageKind): Promise<RemoveImageResult> {
  await requireAdmin();

  if (kind !== "cover" && kind !== "wallpaper") {
    return { ok: false, message: "Invalid image type." };
  }

  const service = createServiceClient();
  const { data: game, error: gameErr } = await service
    .from("games")
    .select("id, slug, product_type, cover_path, wallpaper_path")
    .eq("id", gameId)
    .single();
  if (gameErr || !game) {
    return { ok: false, message: "This game no longer exists — it may have been deleted." };
  }

  const column = kind === "cover" ? "cover_path" : "wallpaper_path";
  const currentPath = kind === "cover" ? game.cover_path : game.wallpaper_path;
  if (!currentPath) return { ok: true };

  const isMembership = game.product_type === "membership";
  const { bucket, widths } = gameImageLocation(kind, game.slug, isMembership);

  // Derived from the STORED path, not a freshly-built one: a row whose
  // slug changed after upload still points at the original objects, and
  // rebuilding from the current slug would miss them entirely.
  const objects = widths.map((width) => `${currentPath}-${width}.webp`);
  const { error: removeErr } = await service.storage.from(bucket).remove(objects);
  if (removeErr) {
    console.error("[removeGameImage] storage remove", removeErr);
    return { ok: false, message: "Something went wrong removing this image." };
  }

  const { error: updateErr } = await service.from("games").update({ [column]: null }).eq("id", game.id);
  if (updateErr) {
    console.error("[removeGameImage] db update", updateErr);
    return { ok: false, message: "Image files were removed, but clearing it from the game failed." };
  }

  return { ok: true };
}

/**
 * Deletes every stored image belonging to a game, without touching the
 * row. Called by deleteGame immediately before the row goes, so a hard
 * delete cannot leave orphaned objects in a bucket nothing references any
 * more.
 *
 * Deliberately best-effort and non-throwing: a storage hiccup must not
 * abort a delete the admin already confirmed, and leftover objects are a
 * tidiness problem, not a correctness one. Returns how many object paths
 * it attempted so a caller (and the tests) can assert it actually ran.
 */
export async function purgeGameImages(gameId: string): Promise<{ attempted: number }> {
  await requireAdmin();

  const service = createServiceClient();
  const { data: game } = await service
    .from("games")
    .select("slug, product_type, cover_path, wallpaper_path")
    .eq("id", gameId)
    .single();
  if (!game) return { attempted: 0 };

  const isMembership = game.product_type === "membership";
  let attempted = 0;

  for (const kind of ["cover", "wallpaper"] as const) {
    const storedPath = kind === "cover" ? game.cover_path : game.wallpaper_path;
    if (!storedPath) continue;
    const { bucket, widths } = gameImageLocation(kind, game.slug, isMembership);
    const objects = widths.map((width) => `${storedPath}-${width}.webp`);
    attempted += objects.length;
    const { error } = await service.storage.from(bucket).remove(objects);
    if (error) console.error("[purgeGameImages]", kind, error);
  }

  return { attempted };
}

/* ------------------------------------------------------------------ */
/* Gift cards                                                          */
/* ------------------------------------------------------------------ */

const GIFT_CARD_BUCKET = "gift-card-images";

/** One stored object per kind, unlike a game's several derivative widths:
 * a gift card renders one card face and one banner, each at a single size.
 * See 20260921000003_gift_card_images.sql for why that difference also
 * means the URL goes straight into the existing column. */
function giftCardObjectPath(kind: GiftCardImageKind, slug: string): string {
  return `${slug}/${kind}.webp`;
}

function giftCardColumn(kind: GiftCardImageKind): "card_image_url" | "header_image_url" {
  return kind === "card" ? "card_image_url" : "header_image_url";
}

/**
 * Upload or replace a gift card's card face / page banner.
 *
 * Same validation front half as uploadGameImage (shared
 * readValidatedImage), same upsert-to-a-fixed-path replace semantics. The
 * card face is resized at the cover widths' larger value and the banner at
 * the wallpaper widths' largest, so the stored object is a sensible size
 * rather than whatever the admin happened to drag in.
 *
 * The resulting PUBLIC URL is written straight into card_image_url /
 * header_image_url, which lib/product-image.ts's getGiftCardImage already
 * treats as an override that wins outright — no new resolution branch.
 */
export async function uploadGiftCardImage(formData: FormData): Promise<UploadGiftCardImageResult> {
  await requireAdmin();

  const productId = formData.get("productId");
  const kind = formData.get("kind");

  if (typeof productId !== "string" || !productId) {
    return { ok: false, message: "Missing gift card." };
  }
  if (kind !== "card" && kind !== "header") {
    return { ok: false, message: "Invalid image type." };
  }

  const service = createServiceClient();
  const { data: product, error: productErr } = await service
    .from("gift_card_products")
    .select("id, slug")
    .eq("id", productId)
    .single();
  if (productErr || !product) {
    return { ok: false, message: "This gift card no longer exists — it may have been deleted." };
  }

  const validated = await readValidatedImage(formData.get("file"));
  if (!validated.ok) return validated;

  const width = kind === "card" ? COVER_WIDTHS[COVER_WIDTHS.length - 1] : WALLPAPER_WIDTHS[WALLPAPER_WIDTHS.length - 1];
  const resized = await sharp(validated.buffer)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const objectPath = giftCardObjectPath(kind, product.slug);
  const { error: uploadErr } = await service.storage
    .from(GIFT_CARD_BUCKET)
    .upload(objectPath, resized, { contentType: "image/webp", upsert: true });
  if (uploadErr) {
    console.error("[uploadGiftCardImage] storage upload", uploadErr);
    return { ok: false, message: "Something went wrong uploading this image." };
  }

  const {
    data: { publicUrl },
  } = service.storage.from(GIFT_CARD_BUCKET).getPublicUrl(objectPath);

  const { error: updateErr } = await service
    .from("gift_card_products")
    .update({ [giftCardColumn(kind)]: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", product.id);
  if (updateErr) {
    console.error("[uploadGiftCardImage] db update", updateErr);
    return { ok: false, message: "Image uploaded, but saving it to the gift card failed." };
  }

  return { ok: true, url: publicUrl };
}

/**
 * Removes a gift card's card face or banner. Objects first, then the
 * column — same ordering and same reasoning as removeGameImage.
 *
 * Clearing the column is what restores the fallback: getGiftCardImage
 * drops back to the per-platform art, and the detail page's banner drops
 * back to the shared gift-cards hero. Neither renders a broken image and
 * neither 500s, which is the property the tests pin down.
 */
export async function removeGiftCardImage(
  productId: string,
  kind: GiftCardImageKind,
): Promise<RemoveImageResult> {
  await requireAdmin();

  if (kind !== "card" && kind !== "header") {
    return { ok: false, message: "Invalid image type." };
  }

  const service = createServiceClient();
  const { data: product, error: productErr } = await service
    .from("gift_card_products")
    .select("id, slug, card_image_url, header_image_url")
    .eq("id", productId)
    .single();
  if (productErr || !product) {
    return { ok: false, message: "This gift card no longer exists — it may have been deleted." };
  }

  const column = giftCardColumn(kind);
  const current = kind === "card" ? product.card_image_url : product.header_image_url;
  if (!current) return { ok: true };

  const { error: removeErr } = await service.storage
    .from(GIFT_CARD_BUCKET)
    .remove([giftCardObjectPath(kind, product.slug)]);
  if (removeErr) {
    console.error("[removeGiftCardImage] storage remove", removeErr);
    return { ok: false, message: "Something went wrong removing this image." };
  }

  const { error: updateErr } = await service
    .from("gift_card_products")
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq("id", product.id);
  if (updateErr) {
    console.error("[removeGiftCardImage] db update", updateErr);
    return { ok: false, message: "Image files were removed, but clearing it from the gift card failed." };
  }

  return { ok: true };
}
