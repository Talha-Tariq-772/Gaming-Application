import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * NOVA_DESIGN_SPEC.md #3 "Label / meta" role — Barlow 500, uppercase,
 * 11px, letter-spacing 0.18em. Font family comes from the inherited
 * --font-ui (see globals.css); no client JS, nothing to animate.
 *
 * Defaults to ember: every page-header kicker this replaces (news,
 * community, faq, guides, the homepage hero) already used
 * text-nova-ember-text for this exact role before this component existed.
 * `tone="muted"` opts into ash instead for a quieter label (e.g. a
 * section sub-heading like "Latest News") — pass `className` only to
 * override something other than color, since a second `text-*` utility
 * isn't guaranteed to win the cascade over this one.
 */
export default function Eyebrow({
  tone = "ember",
  className,
  children,
  ...rest
}: {
  tone?: "ember" | "muted";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"span">, "className" | "children">) {
  const toneClass = tone === "muted" ? "text-nova-ash" : "text-nova-ember-text";
  return (
    <span
      className={`font-medium uppercase ${toneClass} ${className ?? ""}`}
      style={{ fontSize: "11px", letterSpacing: "0.18em" }}
      {...rest}
    >
      {children}
    </span>
  );
}
