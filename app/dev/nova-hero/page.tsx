import type { Metadata } from "next";
import NovaHero from "@/src/components/hero/Nova/NovaHero";

/**
 * Dev-only preview route for NovaHero.tsx (NOVA_DESIGN_SPEC.md #6) — not
 * wired into the real homepage. Session 4 built the component; swapping it
 * in for HomeHero/HeroVisual is a separate, deliberate decision once it's
 * actually been reviewed in a browser, same reasoning as HeroVisualV2's
 * own HERO_VARIANT toggle in an earlier session. This route also exists so
 * `next build` has a reachable page to code-split NovaCanvas's dynamic
 * import into a real, measurable chunk — with nothing importing NovaHero,
 * the build wouldn't generate one at all.
 */
export const metadata: Metadata = {
  title: "Nova Hero Preview",
  robots: { index: false, follow: false },
};

export default function NovaHeroPreviewPage() {
  return <NovaHero />;
}
