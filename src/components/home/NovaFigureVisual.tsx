import NovaFigureStage from "./NovaFigureStage";

/**
 * The homepage hero figure — real artwork, not a placeholder.
 *
 * The WebGL fire/ember canvas (NovaCanvasGate -> NovaCanvas, Part D) has
 * been pulled from this path — the hero is a plain static image now. The
 * canvas component, its shaders, and the source assets are untouched in
 * the tree; this file just no longer imports or mounts them.
 *
 * TWO figures rotate here, restoring the behavior HeroVisualV2 had before
 * commit 777f4e6 ("Wire the Part D fire effect into the live homepage
 * hero") replaced its HERO_VARIANT toggle with a single static image:
 *
 * - FIGURE_BACK ("/hero/figure-color.webp", 683x1024): the detailed
 *   back-view figure, sword over the shoulder. Confirmed byte-for-byte
 *   the same source as HeroVisualV2's old public/hero-test/hero-1.png
 *   (408x612 — the number NovaCanvas.tsx's own comment says the point-
 *   cloud textures were generated from).
 * - FIGURE_CROUCH ("/hero/figure-alt.webp", 435x573): the dark crouched
 *   samurai holding two swords. Same illustration as HeroVisualV2's old
 *   public/hero-test/hero-2.png, converted from PNG to WebP and moved
 *   from hero-test/ (gitignored — see .gitignore's "local experimentation
 *   only" comment, never shipped to any deployed build) into hero/ (not
 *   gitignored) so this rotation actually ships. hero-test/hero-2.png
 *   itself is untouched on disk, still gitignored, no longer referenced
 *   by anything live.
 *
 * figure-depth.webp (the file sitting next to figure-color.webp in
 * public/hero/) is NOT a third figure and never was — it's an ML-
 * generated (Depth-Anything-V2) grayscale depth map, near=white/far=black,
 * built by scripts/generate-figure-assets.mjs specifically as shader input
 * for the old point-cloud reconstruction pass (figure.ts's predecessor,
 * see spec/PATH_A_POINT_CLOUD.md). NovaCanvas.tsx's own comment confirms
 * it: "figure-depth.webp is no longer loaded here — the rim/ember passes
 * only ever needed the color texture's alpha channel." Composited as an
 * image it reads as a washed-out grayscale silhouette, not art — it stays
 * in public/hero/ as figure-color.webp's generated-alongside companion,
 * unused by this component on purpose.
 *
 * The pick happens HERE, in a Server Component, not in NovaFigureStage.tsx
 * (the "use client" half) — `Math.random()` in a client component would
 * only run after hydration, disagreeing with whatever the server already
 * sent down and popping the figure right after paint; done server-side,
 * the browser only ever receives, and only ever requests, the one chosen
 * image. app/(storefront)/(home)/page.tsx is marked `force-dynamic` (see
 * that file) specifically so this pick is re-evaluated per request rather
 * than baked in once at build time.
 *
 * Both figures share the exact same reserved box regardless of their own
 * (different) native aspect ratios — see NovaFigureStage.tsx's container
 * comment. Whichever renders gets the same pointer parallax
 * (useFigureParallax, inside NovaFigureStage.tsx) — the hook targets
 * whatever `src` it was handed, not a specific figure.
 */
const FIGURE_BACK = "/hero/figure-color.webp";
const FIGURE_CROUCH = "/hero/figure-alt.webp";

function pickFigureSrc(): string {
  return Math.random() < 0.5 ? FIGURE_BACK : FIGURE_CROUCH;
}

export default function NovaFigureVisual() {
  return <NovaFigureStage src={pickFigureSrc()} />;
}
