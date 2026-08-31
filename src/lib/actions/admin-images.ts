"use server";

import sharp from "sharp";
import { processCover, processWallpaper } from "@/src/lib/image-processing";
import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Real formats sharp can decode AND that the game-images/membership-images
// buckets accept (20260829000001_storage_buckets.sql's allowed_mime_types).
// Checked against sharp's own parse of the file's magic bytes below, never
// the client-supplied MIME header — that header is attacker-controlled and
// proves nothing about the actual bytes.
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ImageKind = "cover" | "wallpaper";

export type UploadGameImageResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

/**
 * First FormData action in the app, and the first place any request body
 * reaches sharp — so nothing here is trusted before it's checked:
 *   1. requireAdmin() before anything else, including reading the file.
 *   2. Declared size checked before the bytes are ever read into memory.
 *   3. The bytes themselves are parsed by sharp (real magic-number decode,
 *      not a MIME-header guess) and rejected on throw or on an unsupported
 *      decoded format — a renamed .exe or an SVG with a spoofed
 *      "image/jpeg" Content-Type both die here, before resize.
 * Only after all of that does anything reach processCover/processWallpaper.
 */
export async function uploadGameImage(formData: FormData): Promise<UploadGameImageResult> {
  await requireAdmin();

  const gameId = formData.get("gameId");
  const kind = formData.get("kind");
  const file = formData.get("file");

  if (typeof gameId !== "string" || !gameId) {
    return { ok: false, message: "Missing game." };
  }
  if (kind !== "cover" && kind !== "wallpaper") {
    return { ok: false, message: "Invalid image type." };
  }
  if (!(file instanceof File)) {
    return { ok: false, message: "No file was uploaded." };
  }
  if (file.size === 0) {
    return { ok: false, message: "The uploaded file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Image must be 10MB or smaller." };
  }

  const service = createServiceClient();

  // Upload is edit-mode only — a game with no row yet (still being drafted
  // client-side, gameId not yet issued) has nothing to attach an image to.
  // Every persisted row always has a slug (games.slug is NOT NULL), so
  // "game not found" and "game has no slug yet" are the same case here.
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

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let format: string | undefined;
  try {
    format = (await sharp(inputBuffer).metadata()).format;
  } catch {
    return { ok: false, message: "That file isn't a readable image." };
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    return { ok: false, message: "Only JPEG, PNG, or WebP images are supported." };
  }

  // Bucket/prefix conventions match src/lib/storage-image.ts exactly:
  // covers always live in game-images regardless of product type; wallpaper
  // location depends on product type (game-images "wallpapers/{slug}" vs
  // membership-images "{slug}/header"). This is what makes memberships
  // "fall out for free" — no membership-specific branch needed beyond this.
  const isMembership = game.product_type === "membership";
  const bucket = kind === "wallpaper" && isMembership ? "membership-images" : "game-images";
  const prefix =
    kind === "cover" ? `covers/${game.slug}` : isMembership ? `${game.slug}/header` : `wallpapers/${game.slug}`;

  const derivatives = kind === "cover" ? await processCover(inputBuffer) : await processWallpaper(inputBuffer);

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
