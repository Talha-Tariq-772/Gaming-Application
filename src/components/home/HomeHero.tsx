import Button from "@/components/Button";
import HeroVisual from "@/src/components/home/HeroVisual";
import HeroVisualV2 from "@/src/components/home/HeroVisualV2";
import MagneticButton from "@/src/components/motion/MagneticButton";

/**
 * Pure CSS reveal (.hero-reveal, defined in globals.css) — no gsap, no JS
 * at all for the text side. The headline is deliberately NOT animated:
 * it's this page's LCP element, and even a fast gsap-driven opacity
 * reveal measurably delayed LCP in testing (both from the
 * opacity-animated-elements-aren't-LCP-eligible-until-opaque rule, and
 * from gsap-core's parse/exec cost sitting in the critical path since
 * this was the only static importer of it on this route). Reduced motion
 * is handled by the CSS itself — see globals.css.
 *
 * HeroVisual (the 3D moment) is a separate client component with its own
 * eligibility gating and lazy-loaded scene — see HeroVisual.tsx.
 *
 * HERO_VARIANT: local-only toggle for comparing HeroVisual (existing,
 * tested, R3F) against HeroVisualV2 (placeholder-image CSS/GSAP variant —
 * see HeroVisualV2.tsx). Currently "v2" for local review of the Ken Burns/
 * rim-light/particle treatment — its placeholder image lives in
 * public/hero-test/, which is gitignored and won't exist in any deployed
 * build, so flip this back to "v1" (or swap in the real asset — see the
 * PLACEHOLDER comment in HeroVisualV2.tsx) before deploying.
 */
const HERO_VARIANT: "v1" | "v2" = "v2";

export default function HomeHero() {
  return (
    <section className="mx-auto grid max-w-page gap-12 px-4 py-32 md:grid-cols-2 md:items-center md:px-8 md:py-48">
      <div className="flex flex-col items-start justify-center gap-8">
        <span
          className="hero-reveal text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember"
          style={{ animationDelay: "0s" }}
        >
          Now live
        </span>
        <h1 className="w-full text-display-lg font-display font-extrabold text-nova-bone">
          Play what&rsquo;s
          <br />
          next.
        </h1>
        <p
          className="hero-reveal w-full max-w-lg text-lg text-nova-ash"
          style={{ animationDelay: "0.1s" }}
        >
          A curated, cinematic storefront for the games worth your time. No
          noise, no clutter — just what&rsquo;s worth playing.
        </p>
        <div
          className="hero-reveal mt-4 flex items-center gap-6"
          style={{ animationDelay: "0.18s" }}
        >
          <MagneticButton as="a" href="/styleguide" variant="primary">
            View Styleguide
          </MagneticButton>
          <Button as="a" href="#" variant="ghost">
            Browse Store
          </Button>
        </div>
      </div>
      {HERO_VARIANT === "v2" ? <HeroVisualV2 /> : <HeroVisual />}
    </section>
  );
}
