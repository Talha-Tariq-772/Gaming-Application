// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/tests/helpers/dom";
import NovaButton from "./NovaButton";

/**
 * These test the synchronous part of the effect — whether the
 * pointer-tracking listener gets attached at all — rather than the actual
 * GSAP tween that only runs after a real pointerenter plus a dynamic
 * import resolving. That setup decision (listener attached or not) is
 * exactly where reduced-motion is respected; the async animation
 * machinery downstream of it doesn't need to run for this to be a
 * meaningful assertion.
 */
describe("NovaButton", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders its final state immediately and attaches no pointer-tracking listener under prefers-reduced-motion", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": true });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

    const root = createRoot(container);
    act(() => {
      root.render(<NovaButton>Click me</NovaButton>);
    });

    expect(container.querySelector("button")?.textContent).toBe("Click me");
    expect(addSpy).not.toHaveBeenCalledWith("pointerenter", expect.anything(), expect.anything());

    addSpy.mockRestore();
    root.unmount();
  });

  it("attaches the magnetic-hover pointerenter listener when motion is allowed", () => {
    stubMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(hover: hover) and (pointer: fine)": true,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

    const root = createRoot(container);
    act(() => {
      root.render(<NovaButton>Click me</NovaButton>);
    });

    expect(addSpy).toHaveBeenCalledWith("pointerenter", expect.any(Function), { once: true });

    addSpy.mockRestore();
    root.unmount();
  });

  it("skips the listener on touch/coarse-pointer devices even with motion allowed", () => {
    stubMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(hover: hover) and (pointer: fine)": false,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

    const root = createRoot(container);
    act(() => {
      root.render(<NovaButton>Click me</NovaButton>);
    });

    expect(addSpy).not.toHaveBeenCalledWith("pointerenter", expect.anything(), expect.anything());

    addSpy.mockRestore();
    root.unmount();
  });
});
