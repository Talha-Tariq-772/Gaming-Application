/**
 * JS-side mirror of the motion tokens in globals.css (--duration-*,
 * --ease-standard). GSAP needs numeric seconds and a plain easing
 * string, so these can't be read from the CSS custom properties directly
 * — keep them in sync with globals.css by hand.
 */
export const DURATION_FAST = 0.15;
export const DURATION_BASE = 0.3;
export const DURATION_SLOW = 0.6;

export const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";

/** Vertical offset (px) for fade-up/fade-in-y reveals. Transform-only. */
export const FADE_UP_Y = 24;

/** Stagger gap (s) between siblings in a staggered reveal. */
export const STAGGER_GAP = 0.08;
