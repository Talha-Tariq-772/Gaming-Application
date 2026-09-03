"use client";

import Image from "next/image";
import { useRef } from "react";
import { useFigureParallax } from "@/src/lib/use-figure-parallax";

/**
 * The actual rendered figure — split out from NovaFigureVisual.tsx (a
 * Server Component) purely because refs/effects (the parallax hook) need
 * a client boundary. NovaFigureVisual picks WHICH image server-side and
 * passes `src` down as a prop; this component never decides that itself,
 * so there's no client-side re-pick that could disagree with the
 * server-rendered markup after hydration.
 *
 * Only ever renders ONE <Image> — the one whose src it was given — never
 * both figures at once, gated or hidden or otherwise.
 */
export default function NovaFigureStage({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageLayerRef = useRef<HTMLDivElement>(null);

  useFigureParallax(containerRef, imageLayerRef);

  return (
    // Same container contract HeroVisualV2 established (Session 8): w-full
    // is the driving dimension against the bounded row from HomeHero.tsx,
    // md:max-h-full is the real ceiling if that width-derived square would
    // ever exceed the row's available height. This box's own dimensions
    // never depend on which figure is chosen — object-contain fits either
    // image's native aspect ratio inside the SAME fixed square, so the two
    // figures (0.667 and 0.759 aspect — see NovaFigureVisual.tsx) reserve
    // identical space and can't cause a CLS difference between them.
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-full overflow-hidden bg-nova-void md:max-h-full"
    >
      <div ref={imageLayerRef} className="absolute inset-0">
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
