import { ComponentPropsWithoutRef, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 " +
  "text-sm font-medium uppercase tracking-[0.08em] " +
  "transition-colors duration-(--duration-base) ease-standard " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember focus-visible:ring-offset-2 focus-visible:ring-offset-nova-void " +
  "disabled:cursor-not-allowed disabled:opacity-40";

// bone-on-ember measures 3.88:1 (below the 4.5:1 text floor) and ~4.3:1 is
// the ceiling for any text color against ember's luminance — the fill has
// to change, not the text. Tried a dark-fill/light-text pair first
// (ember-lo + bone, 6.34:1) — passed contrast math but read as dark and
// muddy as an actual button once shipped. void-on-ember-bright (5.78:1)
// is the bright, confident-CTA direction instead; ember-bright-hover on
// hover (6.87:1) so hover strictly increases contrast rather than
// reducing it. See globals.css's --color-nova-ember-bright comment.
const variants: Record<Variant, string> = {
  primary: "bg-nova-ember-bright text-nova-void hover:bg-nova-ember-bright-hover",
  secondary:
    "bg-nova-slab text-nova-bone border border-nova-hairline hover:border-nova-ember/40 hover:bg-nova-hairline",
  ghost: "bg-transparent text-nova-ash hover:text-nova-bone",
};

type ButtonAsButton = { as?: "button" } & ComponentPropsWithoutRef<"button">;
type ButtonAsAnchor = { as: "a" } & ComponentPropsWithoutRef<"a">;

export type ButtonProps = (ButtonAsButton | ButtonAsAnchor) & {
  variant?: Variant;
};

/**
 * Plain presentational component — no "use client", no hooks. Rendered
 * from server components (nav links, hero CTAs) it stays fully
 * server-rendered; rendered from a client component (checkout/cart forms
 * that already need onClick handlers) it's just ordinary code in that
 * client bundle, same as before. forwardRef so callers that want to
 * layer an effect on top (see MagneticButton) can get the underlying
 * DOM node without Button needing to know anything about it.
 */
const Button = forwardRef<HTMLAnchorElement | HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", className = "", ...props }, ref) {
    const classes = `${base} ${variants[variant]} ${className}`;

    if (props.as === "a") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { as: _as, ...anchorProps } = props;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...anchorProps}
        />
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as: _as, ...buttonProps } = props;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...buttonProps}
      />
    );
  }
);

export default Button;
