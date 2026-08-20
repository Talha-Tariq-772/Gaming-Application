import Button from "@/components/Button";
import HeroVisual from "@/src/components/home/HeroVisual";
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
 */
export default function HomeHero() {
  return (
    <section className="mx-auto grid max-w-page gap-12 px-4 py-32 md:grid-cols-2 md:items-center md:px-8 md:py-48">
      <div className="flex flex-col items-start justify-center gap-8">
        <span
          className="hero-reveal text-xs font-semibold uppercase tracking-[0.2em] text-accent"
          style={{ animationDelay: "0s" }}
        >
          Now live
        </span>
        <h1 className="w-full text-display-lg font-display font-extrabold text-text">
          Play what&rsquo;s
          <br />
          next.
        </h1>
        <p
          className="hero-reveal w-full max-w-lg text-lg text-text-muted"
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
      <HeroVisual />
    </section>
  );
}
