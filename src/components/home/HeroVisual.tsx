"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { prefersReducedMotion, SCROLLTRIGGER_MIN_WIDTH } from "@/src/lib/motion-guards";

const POSTER_URL =
  "https://placehold.co/960x960/1c1c21/00e6d8.png?text=Nova";

const HARDWARE_CONCURRENCY_MIN = 4;

/**
 * The poster <img> below is the real content on first paint — always
 * server-rendered, always visible immediately, `priority` since it's
 * above the fold on both breakpoints. Two mobile-LCP interventions were
 * A/B tested against this (pushing the visual fully below the fold;
 * dropping priority so it's discovered later) — both measured WORSE than
 * this baseline on mobile Lighthouse (lower score, higher LCP and TBT),
 * because neither addressed the actual bottleneck: main-thread
 * contention during hydration, confirmed by LCP staying ~2.9s even when
 * the headline itself was made the LCP candidate. Left as-is. The 3D
 * scene is pure enhancement on top of it, subject to three independent
 * skip conditions before it's even requested: reduced motion, viewport <
 * 768px (mobile), and hardwareConcurrency <= 4 (weak/unknown-GPU
 * devices). Checked once on mount via a small, three.js-free effect —
 * nothing 3D-related is ever fetched for a visitor who fails any of
 * these checks.
 */
function isEligibleFor3D(): boolean {
  if (prefersReducedMotion()) return false;
  if (window.innerWidth < SCROLLTRIGGER_MIN_WIDTH) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= HARDWARE_CONCURRENCY_MIN) return false;
  return true;
}

const Hero3DScene = dynamic(() => import("./Hero3DScene"), {
  ssr: false,
  loading: () => null,
});

export default function HeroVisual() {
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    setShow3D(isEligibleFor3D());
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-1">
      <Image
        src={POSTER_URL}
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
        priority
      />
      {show3D && (
        <div className="absolute inset-0">
          <Hero3DScene />
        </div>
      )}
    </div>
  );
}
