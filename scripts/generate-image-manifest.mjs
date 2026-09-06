// Build-time manifest generator — run as "prebuild" (and before "dev", see
// package.json) so lib/generated/product-images.ts and the derivatives in
// public/products/{card,header} always reflect whatever's actually in
// assets/product-images/{card,header}, with no manual bookkeeping when art
// is added or removed.
//
// Two jobs:
//  1. Resize + webp-encode each raw source (assets/product-images/) into
//     public/products/{card,header}/{slug}.webp — reusing the exact same
//     pipeline scripts/upload-catalog-images.mjs uses for the Storage
//     upload path (src/lib/image-processing.ts's processCover/
//     processWallpaper), so local-manifest art and Storage-hosted art are
//     visually consistent and neither ships raw multi-MB camera-quality
//     JPEGs to the browser. Raw sources stay out of public/ entirely —
//     next/image runs `unoptimized` here (Cloudflare Pages has no image
//     optimizer), so whatever's in public/ is served byte-for-byte as-is.
//  2. Emit lib/generated/product-images.ts, keyed by slugified filename
//     stem — a soft hint the resolver (lib/product-image.ts) falls
//     through on a miss, never a hard requirement, so plain filename
//     slugging (not an explicit map like upload-catalog-images.mjs's
//     GAME_MAP) is the right tradeoff here: drop a correctly-named file in
//     either folder and it's picked up with no code change.
//
// Card and header source art for the same game MUST share a filename stem
// (e.g. card/gta-vi.jpeg + header/gta-vi.jpeg) — that stem, slugified, is
// the manifest key, and is expected to equal the game's `slug` column,
// though this script has no DB dependency and never checks that directly.
//
// Run with --experimental-strip-types (see package.json) — Node 22.6+,
// needed because image-processing.ts is imported directly, same reason
// upload-catalog-images.mjs requires the flag.
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { processCover, processWallpaper } from "../src/lib/image-processing.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SOURCE_CARD_DIR = path.join(ROOT, "assets", "product-images", "card");
const SOURCE_HEADER_DIR = path.join(ROOT, "assets", "product-images", "header");
const OUT_CARD_DIR = path.join(ROOT, "public", "products", "card");
const OUT_HEADER_DIR = path.join(ROOT, "public", "products", "header");
const OUT_FILE = path.join(ROOT, "lib", "generated", "product-images.ts");

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif)$/i;

function slugify(basename) {
  return basename
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function listImageFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return entries.filter((e) => e.isFile() && IMAGE_EXT_RE.test(e.name)).map((e) => e.name);
}

async function mtimeMs(filePath) {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Resizes + webp-encodes one source into outDir/{key}.webp, skipping the
 * (relatively expensive, sharp-driven) encode when an up-to-date derivative
 * already exists — repeat `npm run dev` boots shouldn't re-process 31
 * multi-MB source files every time nothing changed.
 */
async function buildDerivative(sourcePath, outDir, key, process) {
  const outPath = path.join(outDir, `${key}.webp`);
  const [sourceMs, outMs] = await Promise.all([mtimeMs(sourcePath), mtimeMs(outPath)]);
  if (outMs === null || sourceMs === null || sourceMs > outMs) {
    const variants = await process(await readFile(sourcePath));
    const largest = variants[variants.length - 1]; // COVER_WIDTHS/WALLPAPER_WIDTHS are ascending
    await writeFile(outPath, largest.buffer);
  }
  const { width, height } = await sharp(outPath).metadata();
  return { path: outPath, width: width ?? null, height: height ?? null };
}

async function buildEntries(sourceDir, outDir, publicPrefix, process) {
  const files = await listImageFiles(sourceDir);
  await mkdir(outDir, { recursive: true });
  const entries = new Map();

  for (const file of files) {
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length);
    const key = slugify(base);
    if (!key) continue;
    if (entries.has(key)) {
      throw new Error(
        `generate-image-manifest: "${file}" and an earlier file in ${sourceDir} both slugify to "${key}" — rename one.`,
      );
    }
    const derivative = await buildDerivative(path.join(sourceDir, file), outDir, key, process);
    entries.set(key, {
      path: `/${publicPrefix}/${key}.webp`,
      width: derivative.width,
      height: derivative.height,
    });
  }

  // Prune anything in outDir that isn't a current derivative's canonical
  // `{key}.webp` — a renamed/removed source's stale derivative, but also
  // (the case that actually happened) a raw, non-.webp file dropped
  // straight into public/ instead of assets/product-images/: it shares a
  // valid key with the real derivative, so a key-only check would wrongly
  // treat it as accounted for and leave it sitting there unreferenced,
  // never regenerated from the actual source, indistinguishable at a
  // glance from the file the manifest is really pointing at.
  const currentFiles = await listImageFiles(outDir);
  for (const file of currentFiles) {
    const key = file.slice(0, -path.extname(file).length);
    const isCanonical = file === `${key}.webp` && entries.has(key);
    if (!isCanonical) await unlink(path.join(outDir, file));
  }

  return entries;
}

async function main() {
  const cardEntries = await buildEntries(SOURCE_CARD_DIR, OUT_CARD_DIR, "products/card", processCover);
  const headerEntries = await buildEntries(SOURCE_HEADER_DIR, OUT_HEADER_DIR, "products/header", processWallpaper);

  const keys = [...new Set([...cardEntries.keys(), ...headerEntries.keys()])].sort();

  const pathLines = keys.map((key) => {
    const card = cardEntries.get(key);
    const header = headerEntries.get(key);
    const parts = [];
    if (card) parts.push(`card: ${JSON.stringify(card.path)}`);
    if (header) parts.push(`header: ${JSON.stringify(header.path)}`);
    return `  ${JSON.stringify(key)}: { ${parts.join(", ")} },`;
  });

  const dimensionLines = keys.map((key) => {
    const card = cardEntries.get(key);
    const header = headerEntries.get(key);
    const parts = [];
    if (card) parts.push(`cardWidth: ${card.width}`, `cardHeight: ${card.height}`);
    if (header) parts.push(`headerWidth: ${header.width}`, `headerHeight: ${header.height}`);
    return `  ${JSON.stringify(key)}: { ${parts.join(", ")} },`;
  });

  const banner = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/generate-image-manifest.mjs from
// assets/product-images/{card,header} (source) into
// public/products/{card,header} (resized .webp derivatives actually
// served). Re-run \`npm run generate-image-manifest\` (also wired into
// "prebuild" and "predev") after adding/removing/replacing art.
`;

  const output = `${banner}
export const PRODUCT_IMAGES: Record<string, { card?: string; header?: string }> = {
${pathLines.join("\n")}
};

/** True pixel dimensions of the generated derivative per manifest key —
 * source images are not all the same resolution (some are provided at 2x,
 * a few are undersized outliers), so components need the real numbers
 * rather than assuming a fixed canonical size, to avoid Next/Image
 * aspect-ratio warnings. */
export const PRODUCT_IMAGE_DIMENSIONS: Record<
  string,
  { cardWidth?: number; cardHeight?: number; headerWidth?: number; headerHeight?: number }
> = {
${dimensionLines.join("\n")}
};
`;

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, output, "utf8");

  console.log(
    `generate-image-manifest: wrote ${keys.length} entries (${cardEntries.size} card, ${headerEntries.size} header) to lib/generated/product-images.ts`,
  );

  const cardOnly = keys.filter((k) => cardEntries.has(k) && !headerEntries.has(k));
  const headerOnly = keys.filter((k) => headerEntries.has(k) && !cardEntries.has(k));
  if (cardOnly.length > 0) console.warn(`  card only (no header art): ${cardOnly.join(", ")}`);
  if (headerOnly.length > 0) console.warn(`  header only (no card art): ${headerOnly.join(", ")}`);
}

main().catch((err) => {
  console.error("generate-image-manifest: FAILED");
  console.error(err);
  process.exit(1);
});
