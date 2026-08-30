// Generates public/grain.png — a 128x128 tiling monochrome noise texture
// used by the global grain overlay (see NOVA_DESIGN_SPEC.md #2, applied in
// app/layout.tsx). Re-run this if the texture ever needs regenerating; it's
// not part of the build.
//
// Quantized to 2 colors (pure black/white) so the PNG compresses to well
// under the 3kb budget — full 256-level grayscale noise has too much
// entropy to hit that size at 128x128. At the overlay's actual render
// opacity (0.035) the quantization is invisible.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZE = 128;
const pixels = Buffer.alloc(SIZE * SIZE);
for (let i = 0; i < pixels.length; i++) {
  pixels[i] = Math.random() < 0.5 ? 0 : 255;
}

const outPath = path.join(__dirname, "..", "public", "grain.png");

sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .png({ palette: true, colours: 2, compressionLevel: 9, effort: 10 })
  .toFile(outPath)
  .then((info) => {
    console.log(`wrote ${outPath}`);
    console.log(`size: ${info.size} bytes (${(info.size / 1024).toFixed(2)} kb)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
