import { describe, expect, it } from "vitest";
import NovaCard from "./NovaCard";
import { dur, cssEase } from "@/src/lib/motion";

describe("NovaCard", () => {
  it("renders its final (no-hover) visual state immediately — nothing to animate in", () => {
    // The card's resting appearance (border/surface/chamfer) is present on
    // first render already; hover is a CSS-only :hover transition, not a
    // load-time animation, so there's no "before motion runs" state at all.
    const element = NovaCard({ children: "content" });
    expect(element.props.style.clipPath).toContain("14px");
  });

  it("disables the hover transition under prefers-reduced-motion via CSS, not JS", () => {
    // No useEffect/matchMedia branch exists to test here — the escape
    // hatch is the motion-reduce: variant baked into the className itself.
    const element = NovaCard({ children: "content" });
    expect(element.props.className).toContain("motion-reduce:transition-none");
    expect(element.props.className).toContain("motion-reduce:hover:scale-100");
  });

  it("uses NOVA_DESIGN_SPEC.md #4's border-ignite-to-ember hover treatment", () => {
    const element = NovaCard({ children: "content" });
    expect(element.props.className).toContain("hover:border-nova-ember/40");
    expect(element.props.className).toContain("hover:scale-[1.015]");
  });

  it("sources its transition timing from lib/motion.ts, not a hardcoded value", () => {
    const element = NovaCard({ children: "content" });
    expect(element.props.style.transitionDuration).toBe(`${dur.hover}s`);
    expect(element.props.style.transitionTimingFunction).toBe(cssEase.out);
  });
});
