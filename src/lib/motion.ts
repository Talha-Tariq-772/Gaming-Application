/**
 * Motion constants for the nova primitives (src/components/ui/nova/) —
 * NOVA_DESIGN_SPEC.md #5. Deliberately separate from motion-tokens.ts,
 * which the rest of the app still uses: that file's values (150/300/600ms,
 * a snappy material-standard curve) are tuned for the existing UI's fast,
 * SaaS-like feel. Nova's motion is explicitly heavier and slower — a
 * different design language, not a replacement — so the two coexist
 * rather than one overwriting the other mid-migration.
 *
 * No nova component may hardcode an easing curve or duration — import
 * from here.
 */

/** Raw cubic-bezier control points, as given in the spec. */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.83, 0, 0.17, 1],
} as const;

export const dur = {
  fast: 0.4,
  base: 0.8,
  slow: 1.2,
  epic: 1.8,
  /** Not in the spec's own `dur` code block, but its prose repeatedly
   * gives this exact figure for hover/interaction transitions (card
   * hover "0.6s", page transition "0.6s out / 0.6s in") — doesn't match
   * fast/base, so pulled out as its own named bucket rather than forcing
   * a mismatch or hardcoding 0.6 at each call site. */
  hover: 0.6,
} as const;

/**
 * GSAP's `ease` tween option accepts CSS-style cubic-bezier() strings
 * natively (no CustomEase plugin needed) — this is the form actually
 * passed to gsap.to/quickTo, derived from `ease` above so there's exactly
 * one source of truth for each curve.
 */
export const gsapEase = {
  out: `cubic-bezier(${ease.out.join(", ")})`,
  inOut: `cubic-bezier(${ease.inOut.join(", ")})`,
} as const;

/** Same curves as a plain CSS `transition-timing-function` value, for
 * components that animate via CSS transitions rather than GSAP (e.g.
 * NovaCard — see its own file for why that one stays CSS-only). */
export const cssEase = gsapEase;

/**
 * The actual, working GSAP-tween-`ease`-option form of `ease.out` above.
 *
 * `gsapEase.out`/`cssEase.out` (the CSS cubic-bezier() string) do NOT work
 * as a GSAP tween's `ease` option — verified locally: `gsap.parseEase(
 * "cubic-bezier(...)")` returns `undefined`, since GSAP's built-in ease
 * parser doesn't understand CSS's cubic-bezier() syntax at all (that's a
 * CustomEase-plugin feature). A tween given an ease that resolves to
 * `undefined` doesn't throw — it silently falls back to GSAP's default
 * (power1.out, much softer) — so `ease: gsapEase.out` passed to
 * `gsap.to`/`gsap.quickTo` was a silent wrong-curve bug, not just
 * wrong-looking motion.
 *
 * `[0.16, 1, 0.30, 1]` (`ease.out`) is the standard cubic-bezier
 * approximation of ease-out-expo, and GSAP ships that curve natively as
 * `"expo.out"` — no CustomEase plugin, no hand-rolled bezier solver, just
 * the string GSAP already understands. `gsapEase`/`cssEase` remain exactly
 * correct for actual CSS (`transition-timing-function`,
 * `style.transitionTimingFunction`) — only the GSAP-tween path needs this.
 */
export const gsapTweenEase = {
  out: "expo.out",
} as const;

/** Default stagger (s) between siblings in Reveal — distinct from the
 * spec's 0.018s *char*-split figure (for splitting heading text into
 * per-character spans), which no component here implements. This is for
 * staggering whole elements/children, a coarser effect. */
export const DEFAULT_STAGGER = 0.06;

/** Vertical offset (px) for Reveal's y: 40 -> 0. */
export const REVEAL_Y = 40;

/** Max magnetic-hover displacement (px), per axis — NovaButton. */
export const MAGNETIC_MAX_DISPLACEMENT = 8;
