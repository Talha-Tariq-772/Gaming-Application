// Generates public/game-header-placeholder.png — the fallback HeaderImage
// renders when a game has neither a local products/header manifest entry
// nor a wallpaperPath in Supabase. Same chamfer-free vignette treatment as
// generate-game-placeholder.mjs's cover placeholder, just at the header's
// 16:9 ratio instead of the card's 3:4 — see that script for why PNG (not
// SVG/WebP) and why an empty frame rather than an icon.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDTH = 1280;
const HEIGHT = 720; // 16:9, matches HeaderImage

const CRYPT = "#141013";
const VOID = "#08060a";
const HAIRLINE = "#2a2124";
const SMOKE = "#8d857c";

const INSET = 64;
const frameX = INSET;
const frameY = INSET;
const frameW = WIDTH - INSET * 2;
const frameH = HEIGHT - INSET * 2;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="40%" stop-color="${CRYPT}" stop-opacity="0" />
      <stop offset="100%" stop-color="${VOID}" stop-opacity="0.6" />
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CRYPT}" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)" />
  <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="none" stroke="${HAIRLINE}" stroke-width="2" />
  <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="none" stroke="${SMOKE}" stroke-width="1" stroke-opacity="0.25" />
</svg>
`;

const outPath = path.join(__dirname, "..", "public", "game-header-placeholder.png");

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outPath)
  .then((info) => {
    console.log(`wrote ${outPath}`);
    console.log(`size: ${info.size} bytes (${(info.size / 1024).toFixed(2)} kb)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
