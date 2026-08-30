"use client";

import { forwardRef, useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { dur, gsapTweenEase, MAGNETIC_MAX_DISPLACEMENT } from "@/src/lib/motion";
import { chamferClipPath } from "./Chamfer";

const CHAMFER_SIZE = 10;
const HOVER_CAPABLE = "(hover: hover) and (pointer: fine)";
/** Fraction of cursor-offset-from-center to pull toward, before clamping
 * to MAGNETIC_MAX_DISPLACEMENT — same role as useMagneticHover's STRENGTH,
 * kept separate rather than shared so nova's tuning can move independently
 * of the existing MagneticButton's. */
const PULL_STRENGTH = 0.4;

type Variant = "primary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-nova-ember text-on-accent hover:bg-nova-ember-lo",
  ghost: "border border-nova-hairline bg-transparent text-nova-bone hover:border-nova-ember/40",
};

const BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 px-6 py-3 " +
  "text-sm font-medium uppercase tracking-[0.08em] " +
  "transition-colors duration-(--duration-base) ease-standard " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember focus-visible:ring-offset-2 focus-visible:ring-offset-nova-void " +
  "disabled:cursor-not-allowed disabled:opacity-40";

/**
 * NOVA_DESIGN_SPEC.md #4 (chamfer, ember/hairline variants) + #5 (magnetic
 * hover, max 8px). Reuses the pointer-tracking approach already
 * established in use-magnetic-hover.ts (gated behind reduced-motion and
 * hover-capable/pointer-fine, gsap-core dynamic-imported only on first
 * real pointerenter) rather than that shared hook itself, so nova's easing
 * can move independently of MagneticButton's without touching a hook
 * other, unrelated components still depend on. The one real behavioral
 * difference: this clamps displacement to +/-8px, which the existing hook
 * doesn't.
 */
type ButtonAsButton = { as?: "button"; variant?: Variant } & ComponentPropsWithoutRef<"button">;
type ButtonAsAnchor = { as: "a"; variant?: Variant } & ComponentPropsWithoutRef<"a">;

const NovaButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonAsButton | ButtonAsAnchor>(
  function NovaButton({ as = "button", variant = "primary", className, style, ...rest }, forwardedRef) {
    // Generic HTMLElement, not the HTMLButtonElement | HTMLAnchorElement
    // union `as` implies — addEventListener's overload resolution can't
    // narrow a listener's event type against a union of two different
    // element types, only a single concrete one (this is also why
    // use-magnetic-hover.ts's own ref is typed HTMLElement, not more
    // specific). Nothing in this effect needs button/anchor-specific
    // members, so the generic type costs nothing.
    const innerRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (prefersReducedMotion()) return;
      if (typeof window === "undefined" || !window.matchMedia(HOVER_CAPABLE).matches) {
        return;
      }

      const el = innerRef.current;
      if (!el) return;

      let cancelled = false;
      let xTo: ((value: number) => void) | undefined;
      let yTo: ((value: number) => void) | undefined;

      function clamp(value: number): number {
        return Math.max(-MAGNETIC_MAX_DISPLACEMENT, Math.min(MAGNETIC_MAX_DISPLACEMENT, value));
      }

      function handleMove(e: MouseEvent) {
        if (!xTo || !yTo || !el) return;
        const rect = el.getBoundingClientRect();
        xTo(clamp((e.clientX - (rect.left + rect.width / 2)) * PULL_STRENGTH));
        yTo(clamp((e.clientY - (rect.top + rect.height / 2)) * PULL_STRENGTH));
      }

      function handleLeave() {
        xTo?.(0);
        yTo?.(0);
      }

      function activate() {
        import("@/src/lib/gsap-core").then(({ gsap }) => {
          if (cancelled || !el) return;
          xTo = gsap.quickTo(el, "x", { duration: dur.fast, ease: gsapTweenEase.out });
          yTo = gsap.quickTo(el, "y", { duration: dur.fast, ease: gsapTweenEase.out });
          el.addEventListener("mousemove", handleMove);
          el.addEventListener("mouseleave", handleLeave);
        });
      }

      el.addEventListener("pointerenter", activate, { once: true });

      return () => {
        cancelled = true;
        el.removeEventListener("pointerenter", activate);
        el.removeEventListener("mousemove", handleMove);
        el.removeEventListener("mouseleave", handleLeave);
      };
    }, []);

    const mergedStyle = { ...chamferClipPath(CHAMFER_SIZE), ...style };
    const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className ?? ""}`;

    function setRefs(node: HTMLButtonElement | HTMLAnchorElement | null) {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }

    if (as === "a") {
      const anchorProps = rest as ComponentPropsWithoutRef<"a">;
      return (
        <a ref={setRefs as (n: HTMLAnchorElement | null) => void} className={classes} style={mergedStyle} {...anchorProps} />
      );
    }

    const buttonProps = rest as ComponentPropsWithoutRef<"button">;
    return (
      <button
        ref={setRefs as (n: HTMLButtonElement | null) => void}
        type={buttonProps.type ?? "button"}
        className={classes}
        style={mergedStyle}
        {...buttonProps}
      />
    );
  },
);

export default NovaButton;
