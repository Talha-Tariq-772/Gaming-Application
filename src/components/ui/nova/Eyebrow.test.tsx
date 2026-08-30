import { describe, expect, it } from "vitest";
import Eyebrow from "./Eyebrow";
import { collectText } from "@/tests/helpers/react-tree";

describe("Eyebrow", () => {
  it("has no animation to disable under reduced motion — static label only", () => {
    const element = Eyebrow({ children: "Now live" });
    expect(collectText(element)).toEqual(["Now live"]);
    expect(element.props.className).not.toMatch(/transition|animation/i);
  });

  it("applies the spec's 11px / 0.18em tracking", () => {
    const element = Eyebrow({ children: "Now live" });
    expect(element.props.style).toEqual({ fontSize: "11px", letterSpacing: "0.18em" });
    expect(element.props.className).toContain("uppercase");
  });
});
