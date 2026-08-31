import sharp from "sharp";

/**
 * Shared resize/webp pipeline behind both the offline catalog seed script
 * (scripts/upload-catalog-images.mjs) and the in-app admin upload action
 * (src/lib/actions/admin-images.ts). One copy of the width/quality
 * conventions the rest of the app already depends on — src/lib/storage-image.ts
 * builds public URLs assuming exactly these derivative widths exist.
 */

const QUALITY = 80;

/** Matches src/lib/storage-image.ts's COVER_WIDTHS. */
export const COVER_WIDTHS = [400, 800] as const;
/** Matches src/lib/storage-image.ts's WALLPAPER_WIDTHS. Also used for
 * membership header derivatives, which share the same three widths. */
export const WALLPAPER_WIDTHS = [640, 1280, 1920] as const;

export interface ProcessedImage {
  width: number;
  buffer: Buffer;
  bytes: number;
}

/** sharp() strips EXIF/ICC/etc metadata by default — only kept when
 * .withMetadata() is explicitly called, which this never does. */
async function toWebp(input: Buffer, width: number): Promise<ProcessedImage> {
  const buffer = await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  return { width, buffer, bytes: buffer.length };
}

export async function processCover(input: Buffer): Promise<ProcessedImage[]> {
  return Promise.all(COVER_WIDTHS.map((width) => toWebp(input, width)));
}

export async function processWallpaper(input: Buffer): Promise<ProcessedImage[]> {
  return Promise.all(WALLPAPER_WIDTHS.map((width) => toWebp(input, width)));
}
