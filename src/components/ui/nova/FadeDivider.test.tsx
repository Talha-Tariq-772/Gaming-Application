import { describe, expect, it } from "vitest";
import FadeDivider from "./FadeDivider";

describe("FadeDivider", () => {
  it("has no animation to disable under reduced motion — a static gradient line", () => {
    const element = FadeDivider({});
    expect(element.props.style.background).toContain("linear-gradient");
    expect(element.props.className).not.toMatch(/transition|animation/i);
  });

  it("is hidden from assistive tech (decorative)", () => {
    const element = FadeDivider({});
    expect(element.props["aria-hidden"]).toBe("true");
  });
});
