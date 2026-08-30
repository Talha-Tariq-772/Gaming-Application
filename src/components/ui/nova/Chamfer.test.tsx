import { describe, expect, it } from "vitest";
import Chamfer, { chamferClipPath } from "./Chamfer";

describe("Chamfer", () => {
  it("has no animation to disable under reduced motion — static clip-path only", () => {
    // No "use client", no hooks, no transition/animation classes: there is
    // nothing here for prefers-reduced-motion to turn off. Calling the
    // function directly (no renderer needed) proves that — if it needed a
    // browser environment to run, it wouldn't be side-effect-free like this.
    const element = Chamfer({ size: 20, children: "content" });
    expect(element.props.style).toEqual(chamferClipPath(20));
    expect(element.props.style.clipPath).not.toMatch(/transition|animation/i);
  });

  it("defaults size to 14px, matching NOVA_DESIGN_SPEC.md #4", () => {
    const element = Chamfer({ children: "content" });
    expect(element.props.style.clipPath).toContain("14px");
  });

  it("scales the clip-path polygon with a custom size", () => {
    const clip = chamferClipPath(24);
    expect(clip.clipPath).toBe(
      "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)",
    );
  });
});
