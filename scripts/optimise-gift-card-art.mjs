// One-time optimisation pass for the 5 per-platform gift-card art files.
// Run manually — `node --experimental-strip-types scripts/optimise-gift-card-art.mjs`
// — never at request time.
//
// Art is per-PLATFORM, not per-denomination (psn-10-us and psn-25-us share
// psn.jpeg) — that's why this keys off a fixed platform list, not a
// directory scan. Source JPEGs (~2.5-3MB each) are kept in the repo as the
// editable originals but are never served directly; only the optimised
// WebP output under optimised/ is referenced by lib/product-image.ts.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "public", "products", "gift-cards");
const OUT_DIR = path.join(SOURCE_DIR, "optimised");

// output basename -> source filename, exactly as it exists on disk (Steam's
// source file is capitalized; the output name is not, matching
// lib/product-image.ts's lowercased lookup).
const SOURCES = {
  psn: "psn.jpeg",
  xbox: "xbox.jpeg",
  steam: "Steam.jpeg",
  "google-play": "google-play.jpeg",
  apple: "apple.jpeg",
};

const TARGET_BYTES = 150 * 1024;
// Quality 80 is the starting point (the requested value); some source
// photos (busier backgrounds — steam, xbox here) don't clear the 150KB
// target at that quality, so this steps down rather than shipping an
// oversized file or just logging a warning and leaving it. 55 was the
// actual floor needed (steam.jpeg, measured) before artifacts would start
// mattering at card display size; if a future asset needs to go lower than
// that, the OVER TARGET flag below will say so rather than silently
// degrading further.
const QUALITY_STEPS = [80, 75, 70, 65, 60, 55];

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const [name, sourceFile] of Object.entries(SOURCES)) {
    const srcPath = path.join(SOURCE_DIR, sourceFile);
    const outPath = path.join(OUT_DIR, `${name}.webp`);

    const before = (await fs.stat(srcPath)).size;
    const resized = sharp(srcPath).resize(900, 1200, { fit: "cover" });

    let after = Infinity;
    let usedQuality = QUALITY_STEPS[0];
    for (const quality of QUALITY_STEPS) {
      const buffer = await resized.clone().webp({ quality }).toBuffer();
      after = buffer.length;
      usedQuality = quality;
      if (after <= TARGET_BYTES) {
        await fs.writeFile(outPath, buffer);
        break;
      }
      if (quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
        // Every step tried and still over target — write the smallest
        // (lowest-quality) result anyway rather than nothing, and flag it.
        await fs.writeFile(outPath, buffer);
      }
    }

    const flag = after > TARGET_BYTES ? "  *** OVER 150KB TARGET EVEN AT FLOOR QUALITY ***" : "";
    const qualityNote = usedQuality !== QUALITY_STEPS[0] ? ` (quality ${usedQuality})` : "";
    console.log(`${name}: ${kb(before)} -> ${kb(after)}${qualityNote}${flag}`);
  }
}

main();
