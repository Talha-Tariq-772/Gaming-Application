// Generates public/nova-hero-poster.webp — the LCP poster for NovaHero.tsx
// (NOVA_DESIGN_SPEC.md #6). A static approximation of the fog shader's own
// resting look (same colors: vd/fog/ember, straight from hero-fog.frag.glsl),
// so the poster-to-canvas cross-fade doesn't visibly jump. Built from an SVG
// gradient rather than a photo — there's no art-directed hero photograph for
// this project, and a plausible procedural stand-in for a shader background
// is more honest than a stock/AI image pretending to be one. Swap this for a
// real exported frame (or a designer's poster) whenever one exists; nothing
// else needs to change — see HERO_POSTER_SRC in NovaHero.tsx.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDTH = 1920;
const HEIGHT = 1080;

// Same RGB values as hero-fog.frag.glsl's vd/fog/ember vec3 constants.
const VD = "#08060a";
const FOG = "#211610";
const EMBER = "#c1440e";

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${VD}" />
      <stop offset="100%" stop-color="${FOG}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="100%" r="75%">
      <stop offset="0%" stop-color="${EMBER}" stop-opacity="0.16" />
      <stop offset="100%" stop-color="${EMBER}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="35%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="${VD}" stop-opacity="0.75" />
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#base)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)" />
</svg>
`;

const outPath = path.join(__dirname, "..", "public", "nova-hero-poster.webp");

sharp(Buffer.from(svg))
  .webp({ quality: 70 })
  .toFile(outPath)
  .then((info) => {
    console.log(`wrote ${outPath}`);
    console.log(`size: ${info.size} bytes (${(info.size / 1024).toFixed(2)} kb)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
