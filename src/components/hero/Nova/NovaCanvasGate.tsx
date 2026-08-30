"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { canCreateWebGLContext } from "./webgl-support";

/**
 * NOVA_DESIGN_SPEC.md #6, point 6: if reduced motion is set, or WebGL
 * context creation fails, never load the canvas chunk at all — the poster
 * (rendered by NovaHero.tsx, this component's sibling) stays as the only
 * visual. The check runs in a three.js-free effect before the dynamic
 * import is even requested, same reasoning as HeroVisual.tsx's own
 * isEligibleFor3D() gate for the existing hero.
 */
const NovaCanvas = dynamic(() => import("./NovaCanvas"), {
  ssr: false,
  loading: () => null,
});

export default function NovaCanvasGate() {
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!canCreateWebGLContext()) return;
    setShowCanvas(true);
  }, []);

  if (!showCanvas) return null;
  return <NovaCanvas />;
}
