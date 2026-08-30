// Run-once, offline catalog image prep + upload for Session 1 (Supabase
// Storage + catalog schema). Run manually —
// `node scripts/upload-catalog-images.mjs` — never at request time.
//
// Reads SUPABASE_SERVICE_ROLE_KEY from .env.local directly, which bypasses
// every RLS policy on the game-images/membership-images buckets (see
// 20260829000001_storage_buckets.sql). This key never ships to the
// client — this script only ever runs from a developer/CI shell.
//
// Idempotent: every upload uses upsert:true and overwrites by object path,
// so re-running (e.g. after swapping a source asset) is always safe.
//
// FAILS LOUDLY (prints every mismatch, uploads nothing, exits 1) if:
//   - a source file the map below points at is missing on disk, or
//   - a file actually present in public/products or public/membership is
//     NOT in the map.
// The map is explicit and NOT name-derived on purpose: several cover/
// wallpaper pairs don't share a stem at all (gta-vi's wallpaper source is
// "Grand VI Wallpaper.jpeg", not anything starting with "GTA"), several
// pairs differ only in casing ("Hogwarts legacy.jpeg" vs "Hogwarts Legacy
// Wallpaper.jpeg"), and fuzzy name matching across a list like that would
// silently mis-assign art to the wrong game.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

config({ path: path.join(ROOT, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "upload-catalog-images: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PRODUCTS_DIR = path.join(ROOT, "public", "products");
const MEMBERSHIP_DIR = path.join(ROOT, "public", "membership");

const QUALITY = 80;
const COVER_WIDTHS = [400, 800];
const WALLPAPER_WIDTHS = [640, 1280, 1920];
const HEADER_WIDTHS = [640, 1280, 1920];

// slug -> { cover, wallpaper } source filenames, matching
// public.games.cover_path / wallpaper_path prefixes ("covers/{slug}",
// "wallpapers/{slug}") set in 20260829000004_seed_catalog.sql.
const GAME_MAP = {
  "assassins-creed-valhalla": {
    cover: "Assassins Creed Valhalla.jpeg",
    wallpaper: "Assassins Creed Valhalla Wallpaper.jpeg",
  },
  "battlefield-6": {
    cover: "Battlefield 6.jpeg",
    wallpaper: "Battlefield 6 Wallpaper.jpeg",
  },
  "black-myth-wukong": {
    cover: "Black Myth Wukong.jpeg",
    wallpaper: "Black Myth Wukong Wallpaper.jpeg",
  },
  "cod-black-ops-6": {
    cover: "COD Black Ops 6.jpeg",
    wallpaper: "COD Black Ops 6 wallpaper.jpeg",
  },
  "cod-modern-warfare-2": {
    cover: "COD Modern Warfare II.jpeg",
    wallpaper: "COD Modern Warfare II Wallpaper.jpeg",
  },
  "dead-island-2": {
    cover: "Dead Island 2.jpeg",
    wallpaper: "Dead Island 2 Wallpaper.jpeg",
  },
  "dragon-ball-sparking-zero": {
    cover: "Dragon Ball Sparking Zero.jpeg",
    wallpaper: "Dragon Ball Sparking Zero Wallpaper.jpeg",
  },
  "fc-26": {
    cover: "FC26.jpeg",
    wallpaper: "FC 26 Wallpaper.jpeg",
  },
  "fc-27": {
    cover: "FC 27.jpeg",
    wallpaper: "FC 27 Wallpaper.jpeg",
  },
  "ghost-of-yotei": {
    cover: "Ghost of Yotei.jpeg",
    wallpaper: "Ghost of Yotei Wallpaper.jpeg",
  },
  "gta-vi": {
    cover: "GTA VI.jpeg",
    wallpaper: "Grand VI Wallpaper.jpeg",
  },
  "hogwarts-legacy": {
    cover: "Hogwarts legacy.jpeg",
    wallpaper: "Hogwarts Legacy Wallpaper.jpeg",
  },
  "need-for-speed-unbound": {
    cover: "Need for Speed Unbound.jpeg",
    wallpaper: "Need for speed unbound Wallpaper.jpeg",
  },
  "remnant-2": {
    cover: "Remnant II.jpeg",
    wallpaper: "Remnant II Wallpaper.jpeg",
  },
  "silent-hill-2": {
    cover: "Silent Hill 2.jpeg",
    wallpaper: "silent hill 2 game wallpaper.jpeg",
  },
  "spider-man-2": {
    cover: "Spider-Man 2.jpeg",
    wallpaper: "Spider-Man 2 Wallpaper.jpeg",
  },
};

// Each membership has its own header source. Uploaded to
// "{slug}/header-{width}.webp", matching wallpaper_path = "{slug}/header"
// in 20260829000004_seed_catalog.sql.
const MEMBERSHIP_MAP = {
  "playstation-plus": "PlayStation Plus.jpeg",
  "ps-plus-extra-premium": "PS+ Extra & Premium.jpeg",
  "xbox-game-pass-ultimate": "Xbox Game Pass Ultimate.jpeg",
};

// A fourth, generic membership-section header, not tied to any one game
// row — uploaded to the bucket root as "header-{width}.webp".
const SHARED_HEADER_FILE = "header.jpeg";

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function validateMapping(label, dir, actualFiles, mappedFiles) {
  const actualSet = new Set(actualFiles);
  const mappedSet = new Set(mappedFiles);
  const errors = [];

  for (const file of mappedFiles) {
    if (!actualSet.has(file)) {
      errors.push(`${label}: mapped source file missing on disk: "${path.join(dir, file)}"`);
    }
  }
  for (const file of actualFiles) {
    if (!mappedSet.has(file)) {
      errors.push(
        `${label}: file present but not in the map (refusing to fuzzy-match or silently skip): "${path.join(dir, file)}"`,
      );
    }
  }
  return errors;
}

/** sharp() strips EXIF/ICC/etc metadata by default — only kept when
 * .withMetadata() is explicitly called, which we never do — so this also
 * satisfies "strip metadata" with no extra step. */
async function toWebp(sourcePath, width) {
  return sharp(sourcePath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

async function upload(bucket, objectPath, buffer) {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) {
    throw new Error(`upload failed for ${bucket}/${objectPath}: ${error.message}`);
  }
}

async function main() {
  const productFiles = await listFiles(PRODUCTS_DIR);
  const membershipFiles = await listFiles(MEMBERSHIP_DIR);

  const mappedProductFiles = Object.values(GAME_MAP).flatMap((v) => [v.cover, v.wallpaper]);
  const mappedMembershipFiles = [...Object.values(MEMBERSHIP_MAP), SHARED_HEADER_FILE];

  const errors = [
    ...validateMapping("public/products", PRODUCTS_DIR, productFiles, mappedProductFiles),
    ...validateMapping("public/membership", MEMBERSHIP_DIR, membershipFiles, mappedMembershipFiles),
  ];

  if (errors.length > 0) {
    console.error("upload-catalog-images: refusing to run — mapping mismatch:\n");
    for (const err of errors) console.error(`  - ${err}`);
    console.error("\nFix the map in this script (or the files on disk) and re-run. Nothing was uploaded.");
    process.exit(1);
  }

  let bytesBefore = 0;
  let bytesAfter = 0;
  const report = [];

  for (const [slug, { cover, wallpaper }] of Object.entries(GAME_MAP)) {
    const coverPath = path.join(PRODUCTS_DIR, cover);
    const wallpaperPath = path.join(PRODUCTS_DIR, wallpaper);

    bytesBefore += (await fs.stat(coverPath)).size;
    bytesBefore += (await fs.stat(wallpaperPath)).size;

    let itemBytesAfter = 0;
    for (const width of COVER_WIDTHS) {
      const buffer = await toWebp(coverPath, width);
      await upload("game-images", `covers/${slug}-${width}.webp`, buffer);
      itemBytesAfter += buffer.length;
    }
    for (const width of WALLPAPER_WIDTHS) {
      const buffer = await toWebp(wallpaperPath, width);
      await upload("game-images", `wallpapers/${slug}-${width}.webp`, buffer);
      itemBytesAfter += buffer.length;
    }

    bytesAfter += itemBytesAfter;
    report.push(
      `  ${slug}: ${COVER_WIDTHS.length + WALLPAPER_WIDTHS.length} images, ${(itemBytesAfter / 1024).toFixed(1)} kb`,
    );
    console.log(`done: ${slug}`);
  }

  for (const [slug, file] of Object.entries(MEMBERSHIP_MAP)) {
    const sourcePath = path.join(MEMBERSHIP_DIR, file);
    bytesBefore += (await fs.stat(sourcePath)).size;

    let itemBytesAfter = 0;
    for (const width of HEADER_WIDTHS) {
      const buffer = await toWebp(sourcePath, width);
      await upload("membership-images", `${slug}/header-${width}.webp`, buffer);
      itemBytesAfter += buffer.length;
    }

    bytesAfter += itemBytesAfter;
    report.push(`  ${slug}: ${HEADER_WIDTHS.length} images, ${(itemBytesAfter / 1024).toFixed(1)} kb`);
    console.log(`done: ${slug}`);
  }

  {
    const sourcePath = path.join(MEMBERSHIP_DIR, SHARED_HEADER_FILE);
    bytesBefore += (await fs.stat(sourcePath)).size;

    let sharedBytesAfter = 0;
    for (const width of HEADER_WIDTHS) {
      const buffer = await toWebp(sourcePath, width);
      await upload("membership-images", `header-${width}.webp`, buffer);
      sharedBytesAfter += buffer.length;
    }
    bytesAfter += sharedBytesAfter;
    report.push(`  (shared) header: ${HEADER_WIDTHS.length} images, ${(sharedBytesAfter / 1024).toFixed(1)} kb`);
    console.log("done: shared membership header");
  }

  console.log("\nPer-item output:");
  console.log(report.join("\n"));

  const reduction = (1 - bytesAfter / bytesBefore) * 100;
  console.log("\nTotals:");
  console.log(`  before: ${bytesBefore} bytes (${(bytesBefore / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  after:  ${bytesAfter} bytes (${(bytesAfter / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  reduction: ${reduction.toFixed(1)}%`);
}

main().catch((err) => {
  console.error("upload-catalog-images: FAILED");
  console.error(err);
  process.exit(1);
});
