// GENERATED FILE — do not edit by hand.
// Produced by scripts/generate-image-manifest.mjs from
// assets/product-images/{card,header} (source) into
// public/products/{card,header} (resized .webp derivatives actually
// served). Re-run `npm run generate-image-manifest` (also wired into
// "prebuild" and "predev") after adding/removing/replacing art.

export const PRODUCT_IMAGES: Record<string, { card?: string; header?: string }> = {
  "assassins-creed-valhalla": { card: "/products/card/assassins-creed-valhalla.webp", header: "/products/header/assassins-creed-valhalla.webp" },
  "battlefield-6": { card: "/products/card/battlefield-6.webp", header: "/products/header/battlefield-6.webp" },
  "black-myth-wukong": { card: "/products/card/black-myth-wukong.webp", header: "/products/header/black-myth-wukong.webp" },
  "cod-black-ops-6": { card: "/products/card/cod-black-ops-6.webp", header: "/products/header/cod-black-ops-6.webp" },
  "cod-modern-warfare-2": { card: "/products/card/cod-modern-warfare-2.webp", header: "/products/header/cod-modern-warfare-2.webp" },
  "dead-island-2": { card: "/products/card/dead-island-2.webp", header: "/products/header/dead-island-2.webp" },
  "dragon-ball-sparking-zero": { card: "/products/card/dragon-ball-sparking-zero.webp", header: "/products/header/dragon-ball-sparking-zero.webp" },
  "fc-26": { card: "/products/card/fc-26.webp", header: "/products/header/fc-26.webp" },
  "fc-27": { card: "/products/card/fc-27.webp" },
  "ghost-of-yotei": { card: "/products/card/ghost-of-yotei.webp", header: "/products/header/ghost-of-yotei.webp" },
  "gta-vi": { card: "/products/card/gta-vi.webp", header: "/products/header/gta-vi.webp" },
  "hogwarts-legacy": { card: "/products/card/hogwarts-legacy.webp", header: "/products/header/hogwarts-legacy.webp" },
  "need-for-speed-unbound": { card: "/products/card/need-for-speed-unbound.webp", header: "/products/header/need-for-speed-unbound.webp" },
  "remnant-2": { card: "/products/card/remnant-2.webp", header: "/products/header/remnant-2.webp" },
  "silent-hill-2": { card: "/products/card/silent-hill-2.webp", header: "/products/header/silent-hill-2.webp" },
  "spider-man-2": { card: "/products/card/spider-man-2.webp", header: "/products/header/spider-man-2.webp" },
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
  "assassins-creed-valhalla": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "battlefield-6": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "black-myth-wukong": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "cod-black-ops-6": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "cod-modern-warfare-2": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "dead-island-2": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "dragon-ball-sparking-zero": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "fc-26": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "fc-27": { cardWidth: 800, cardHeight: 1071 },
  "ghost-of-yotei": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "gta-vi": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "hogwarts-legacy": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "need-for-speed-unbound": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "remnant-2": { cardWidth: 736, cardHeight: 1104, headerWidth: 1920, headerHeight: 787 },
  "silent-hill-2": { cardWidth: 800, cardHeight: 1071, headerWidth: 1920, headerHeight: 787 },
  "spider-man-2": { cardWidth: 736, cardHeight: 1308, headerWidth: 735, headerHeight: 414 },
};
