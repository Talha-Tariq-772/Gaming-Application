import Image from "next/image";
import NovaCanvasGate from "@/src/components/hero/Nova/NovaCanvasGate";

/**
 * The homepage hero figure — real artwork, not a placeholder.
 *
 * The static image below IS figure-color.webp itself, not a separate
 * "poster" of the same subject: confirmed byte-for-byte (well, pixel-
 * dimension-for-pixel-dimension) that public/hero-test/hero-1.png — the
 * placeholder HeroVisualV2 previously cycled through — is exactly the
 * 408x612 source figure-color.webp/figure-depth.webp were generated from
 * (`file` reports hero-1.png as 408x612 PNG; NovaCanvas.tsx's own comment
 * says the point-cloud textures are "a 408x612 source resized to a 1024px
 * long edge" — same number, not a coincidence). Using figure-color.webp
 * directly rather than keeping hero-1.png as a separate asset means the
 * alpha mask the fire effect samples (sampleAlphaEdgeUVs) and the image a
 * reduced-motion/no-WebGL visitor actually sees are pixel-identical.
 *
 * hero-2.png (HeroVisualV2's other cycled placeholder, 435x573) is a
 * DIFFERENT, unrelated illustration — different pose, different aspect
 * ratio, never matched figure-color.webp. Dropped along with the rest of
 * HeroVisualV2's cycling/localStorage code, which was explicitly "local
 * dev/testing only" and sourced from Pinterest (gitignored, not rights-
 * cleared, never shipped) — HeroVisual.tsx (the R3F variant) and
 * HeroVisualV2.tsx are both left in place, just no longer wired into
 * HomeHero, in case they're wanted again for comparison.
 *
 * No CSS motion of its own (no Ken Burns, no particle layer, no pointer
 * parallax) — NovaCanvasGate's WebGL canvas already drives its own
 * pointer-orbit and particle system once it's eligible; layering
 * HeroVisualV2's independent CSS transforms on top of that would move the
 * static image and the WebGL point-cloud out of sync with each other.
 * This image is what a reduced-motion or no-WebGL visitor sees,
 * unanimated, and it's the LCP candidate either way — `priority`, never
 * opacity-animated, same reasoning as every other hero visual in this
 * codebase.
 */
export default function NovaFigureVisual() {
  return (
    // Same container contract HeroVisualV2 established (Session 8): w-full
    // is the driving dimension against the bounded row from HomeHero.tsx,
    // md:max-h-full is the real ceiling if that width-derived square would
    // ever exceed the row's available height. Reused verbatim rather than
    // re-derived, so this doesn't reopen the CLS bug that sizing fixed.
    <div className="relative aspect-square w-full max-w-full overflow-hidden bg-nova-void md:max-h-full">
      <Image
        src="/hero/figure-color.webp"
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-contain"
        priority
      />
      <NovaCanvasGate />
    </div>
  );
}
