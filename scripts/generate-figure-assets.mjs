// Offline asset-prep for the Path A GPU point-cloud hero figure
// (spec/PATH_A_POINT_CLOUD.md, Session A). Run manually —
// `node scripts/generate-figure-assets.mjs` — and commit its outputs.
// Both models run entirely locally via @huggingface/transformers (no
// hosted API calls), but the first run downloads ~100MB of weights, so
// this must never run at request time.
//
// LICENSING: as of this run, the source below (public/hero-test/hero-1.png)
// is a placeholder whose own in-repo comment (HeroVisualV2.tsx) states it is
// "sourced from Pinterest, not rights-cleared" and visually reads as a
// specific copyrighted character (Guts, Berserk). Proceeding on this source
// was an explicit, acknowledged call by whoever ran this script — see the
// session notes — not a determination that it's cleared. Swap SOURCE_PATH
// for the real, licensing-cleared artwork before this ships; nothing else
// here needs to change.
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AutoModel, AutoProcessor, RawImage, pipeline } from "@huggingface/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SOURCE_PATH = path.join(ROOT, "public", "hero-test", "hero-1.png");

const OUT_DIR = path.join(ROOT, "public", "hero");
const COLOR_OUT = path.join(OUT_DIR, "figure-color.webp");
const DEPTH_OUT = path.join(OUT_DIR, "figure-depth.webp");

// Deliberately NOT under public/ — only figure-color.webp and
// figure-depth.webp ship. Anything under public/ is web-servable regardless
// of .gitignore, so the eyeball-only preview lives outside the served tree.
const PREVIEW_DIR = path.join(ROOT, "scripts", ".out");
const DEPTH_PREVIEW_OUT = path.join(PREVIEW_DIR, "figure-depth-preview.png");

const LONG_EDGE = 1024;
const PREVIEW_LONG_EDGE = 512;

const SEGMENTATION_MODEL = "briaai/RMBG-1.4";
const DEPTH_MODEL = "onnx-community/depth-anything-v2-small";

class ModelDownloadError extends Error {}

function longEdgeDims(width, height, longEdge) {
  if (width >= height) {
    return { width: longEdge, height: Math.round((height / width) * longEdge) };
  }
  return { width: Math.round((width / height) * longEdge), height: longEdge };
}

// A "clean" alpha channel means the source is already a cutout (some
// pixels transparent, some opaque) — not just an RGBA file whose alpha
// happens to be uniformly 255 (fully opaque), which is not a cutout at all.
async function hasCleanAlpha(sourcePath, meta) {
  if (!meta.hasAlpha) return false;
  const { channels } = await sharp(sourcePath).stats();
  const alpha = channels[channels.length - 1];
  return alpha.min !== alpha.max;
}

// Segments the figure from its background using briaai/RMBG-1.4, run
// locally. Follows Hugging Face's own reference implementation
// (transformers.js-examples/remove-background-web/main.js) verbatim for the
// model-loading and mask-application steps. NOTE: this branch is not
// exercised by this project's current source image (hero-1.png already
// ships a clean alpha cutout, so getCutout() below takes the resize-only
// path) — it has not been run end-to-end here. RMBG-1.4's license
// (bria-rmbg-1.4) restricts the *model* to non-commercial use; that
// restriction is on using the model, not necessarily on images it has
// processed, but it's worth a legal read before this branch is ever
// actually exercised on a commercial asset.
async function segmentForeground(sourcePath) {
  let model, processor;
  try {
    model = await AutoModel.from_pretrained(SEGMENTATION_MODEL, {
      config: { model_type: "custom" },
    });
    processor = await AutoProcessor.from_pretrained(SEGMENTATION_MODEL, {
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: "ImageFeatureExtractor",
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      },
    });
  } catch (err) {
    throw new ModelDownloadError(
      `Failed to load segmentation model "${SEGMENTATION_MODEL}": ${err.message}`,
    );
  }

  const image = await RawImage.read(sourcePath);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
    image.width,
    image.height,
  );
  image.putAlpha(mask);
  return image;
}

// Returns a sharp() instance of the figure cut from its background, at the
// source's native resolution, with alpha preserved.
async function getCutout() {
  const meta = await sharp(SOURCE_PATH).metadata();
  console.log(
    `Source: ${path.relative(ROOT, SOURCE_PATH)} (${meta.width}x${meta.height}, hasAlpha=${meta.hasAlpha})`,
  );

  if (await hasCleanAlpha(SOURCE_PATH, meta)) {
    console.log("Source already has a clean alpha cutout — resizing directly, no segmentation.");
    return { sharp: sharp(SOURCE_PATH), width: meta.width, height: meta.height };
  }

  console.log(`No usable alpha channel — segmenting with ${SEGMENTATION_MODEL}...`);
  const cutout = await segmentForeground(SOURCE_PATH);
  return { sharp: cutout.toSharp(), width: cutout.width, height: cutout.height };
}

// Runs Depth-Anything-V2-Small on the ORIGINAL (uncut) source image — full
// scene context, closest to how the model was trained — and returns the
// depth map at the source's native resolution plus the model's raw
// pre-normalization min/max.
async function estimateDepth() {
  let depthEstimator;
  try {
    depthEstimator = await pipeline("depth-estimation", DEPTH_MODEL);
  } catch (err) {
    throw new ModelDownloadError(`Failed to load depth model "${DEPTH_MODEL}": ${err.message}`);
  }

  const image = await RawImage.read(SOURCE_PATH);
  const { predicted_depth, depth } = await depthEstimator(image);

  // Depth-Anything is a relative/disparity model: LARGER raw values mean
  // NEARER to the camera. The pipeline already normalizes min->0, max->255
  // with no inversion, so `depth` (near=255/white, far=0/black) matches
  // the spec's convention directly.
  const rawMin = predicted_depth.min().item();
  const rawMax = predicted_depth.max().item();

  return { depthSharp: depth.toSharp(), rawMin, rawMax };
}

async function reportFile(label, filePath) {
  const { size } = await fs.stat(filePath);
  console.log(`${label}: ${path.relative(ROOT, filePath)} — ${size} bytes (${(size / 1024).toFixed(2)} kb)`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  const cutout = await getCutout();
  const { width: outWidth, height: outHeight } = longEdgeDims(
    cutout.width,
    cutout.height,
    LONG_EDGE,
  );

  await cutout.sharp
    .resize(outWidth, outHeight, { fit: "fill" })
    .webp({ quality: 80 })
    .toFile(COLOR_OUT);

  const { depthSharp, rawMin, rawMax } = await estimateDepth();
  console.log(`Depth raw range before normalization: min=${rawMin.toFixed(4)}, max=${rawMax.toFixed(4)}`);
  if (rawMax - rawMin < 1e-6) {
    throw new Error(
      "Depth model returned a flat field (max - min is ~0) — refusing to write a pointless flat depth map. Stopping.",
    );
  }

  await depthSharp
    .clone()
    .resize(outWidth, outHeight, { fit: "fill" })
    .webp({ quality: 85 })
    .toFile(DEPTH_OUT);

  const { width: previewWidth, height: previewHeight } = longEdgeDims(
    cutout.width,
    cutout.height,
    PREVIEW_LONG_EDGE,
  );
  await depthSharp
    .clone()
    .resize(previewWidth, previewHeight, { fit: "fill" })
    .png({ compressionLevel: 0 })
    .toFile(DEPTH_PREVIEW_OUT);

  console.log("");
  await reportFile("Color", COLOR_OUT);
  await reportFile("Depth", DEPTH_OUT);
  await reportFile("Depth preview", DEPTH_PREVIEW_OUT);
}

main().catch((err) => {
  if (err instanceof ModelDownloadError) {
    console.error(`\nSTOPPED: ${err.message}`);
    console.error(
      "A model failed to download or load. Not falling back to a synthetic/flat asset — that would make the point cloud pointless without it being obvious from the code. Fix network/access to the model and re-run.",
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
