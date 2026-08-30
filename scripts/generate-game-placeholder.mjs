// Generates public/game-cover-placeholder.png — the fallback rendered
// wherever a game's cover_image_url is null/empty (the `games` table
// column has no NOT NULL constraint, see supabase/migrations/
// 20260818000002_games.sql, and Game.coverImageUrl is typed as a required
// `string`, so src/lib/catalog.ts's mapGameRow and
// src/lib/use-games-by-ids.ts's copy of it both fall back to this path
// rather than an empty string, which crashed next/image's preload).
//
// PNG, not SVG or WebP — this asset is consumed in three different
// rendering contexts (next/image, a plain browser <img>, and Satori inside
// next/og's ImageResponse for games/[slug]/opengraph-image.tsx), and PNG is
// the one format all three reliably decode; Satori's <img> support for SVG
// sources is inconsistent across next/og versions.
//
// Just an empty chamfered frame on the card background color — deliberately
// not an icon or illustration, so it reads as "no cover art yet" rather
// than as content. Same chamfer geometry as NOVA_DESIGN_SPEC.md #4's
// clip-path (14px at this asset's own scale).
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDTH = 640;
const HEIGHT = 853; // 3:4, matches GameCard/LibraryCard's aspect-3/4

// Same values as app/globals.css's --color-nova-* tokens.
const CRYPT = "#141013";
const VOID = "#08060a";
const HAIRLINE = "#2a2124";
const SMOKE = "#8d857c";

const CHAMFER = 28;
const INSET = 64;
const frameX = INSET;
const frameY = INSET;
const frameW = WIDTH - INSET * 2;
const frameH = HEIGHT - INSET * 2;

const chamferPoints = [
  [frameX + CHAMFER, frameY],
  [frameX + frameW, frameY],
  [frameX + frameW, frameY + frameH - CHAMFER],
  [frameX + frameW - CHAMFER, frameY + frameH],
  [frameX, frameY + frameH],
  [frameX, frameY + CHAMFER],
].map(([x, y]) => `${x},${y}`).join(" ");

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
  <polygon points="${chamferPoints}" fill="none" stroke="${HAIRLINE}" stroke-width="2" />
  <polygon points="${chamferPoints}" fill="none" stroke="${SMOKE}" stroke-width="1" stroke-opacity="0.25" />
</svg>
`;

const outPath = path.join(__dirname, "..", "public", "game-cover-placeholder.png");

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
