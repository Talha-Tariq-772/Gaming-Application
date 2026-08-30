// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/tests/helpers/dom";
import Reveal from "./Reveal";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  constructor(public callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

/**
 * Exercised at the mobile/IntersectionObserver code path (innerWidth below
 * SCROLLTRIGGER_MIN_WIDTH), which is fully synchronous — the desktop path
 * dynamic-imports use-gsap.ts and creates a real ScrollTrigger, neither of
 * which is needed to prove reduced-motion is respected: the effect returns
 * before reaching either code path when it is.
 */
describe("Reveal", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders children in their final state immediately under prefers-reduced-motion, with no observer set up", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": true });
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <Reveal>
          <p>One</p>
          <p>Two</p>
        </Reveal>,
      );
    });

    expect(container.textContent).toBe("OneTwo");
    expect(MockIntersectionObserver.instances.length).toBe(0);
    container.querySelectorAll("p").forEach((p) => {
      expect(p.className).not.toContain("nova-reveal-init");
    });

    root.unmount();
  });

  it("sets up the reveal (IntersectionObserver + init class on every child) when motion is allowed", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": false });
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <Reveal>
          <p>One</p>
          <p>Two</p>
        </Reveal>,
      );
    });

    expect(MockIntersectionObserver.instances.length).toBe(1);
    expect(MockIntersectionObserver.instances[0].observe).toHaveBeenCalledTimes(2);
    container.querySelectorAll("p").forEach((p) => {
      expect(p.className).toContain("nova-reveal-init");
    });

    root.unmount();
  });
});
