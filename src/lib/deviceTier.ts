/**
 * One-shot device tier detection for the nova WebGL hero
 * (src/components/hero/Nova/) — NOVA_DESIGN_SPEC.md #6. Exported so any
 * other component that wants the same mobile/desktop split (e.g. a future
 * WebGL surface elsewhere) can reuse it instead of re-deriving its own.
 *
 * GPU-tier detection from a renderer string is inherently a heuristic, not
 * a precise classifier — WEBGL_debug_renderer_info is masked entirely by
 * some browsers' fingerprinting protections (notably Firefox by default),
 * so this always has hardwareConcurrency + devicePixelRatio to fall back
 * on when the renderer string isn't available. Runs client-side only.
 */

export type DeviceTierName = "mobile" | "desktop";

export interface DeviceTierConfig {
  tier: DeviceTierName;
  /** Already clamped — pass straight to WebGLRenderer.setPixelRatio(). */
  dpr: number;
  /** Offscreen render-target scale, relative to the canvas's CSS size. */
  renderScale: number;
  /** Fragment shader OCTAVES #define. */
  octaves: number;
  /** THREE.Points count for the ember layer. */
  emberCount: number;
  /** Point-cloud figure: total gl.POINTS drawn (figureGrid.x * figureGrid.y). */
  figurePointCount: number;
  /** Point-cloud figure: uGrid uniform — sample grid the vertex shader
   * derives from gl_VertexID. 231x346 / 163x245, not the spec's 320x250 /
   * 200x200 — figure-color.webp/figure-depth.webp are 683x1024 (portrait,
   * from a 408x612 source), so the grid is corrected to that aspect ratio
   * per spec/PATH_A_POINT_CLOUD.md's Session-B amendments rather than the
   * landscape numbers the spec was written against. */
  figureGrid: readonly [number, number];
}

const DESKTOP_CONFIG: DeviceTierConfig = {
  tier: "desktop",
  dpr: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5),
  renderScale: 0.6,
  octaves: 5,
  emberCount: 1200,
  figurePointCount: 231 * 346,
  figureGrid: [231, 346],
};

const MOBILE_CONFIG: DeviceTierConfig = {
  tier: "mobile",
  dpr: 1,
  renderScale: 0.5,
  octaves: 3,
  emberCount: 400,
  figurePointCount: 163 * 245,
  figureGrid: [163, 245],
};

const HARDWARE_CONCURRENCY_MIN = 4;

/** Known mobile/integrated-GPU renderer-string substrings, lowercased. Not
 * exhaustive — a false "desktop" classification just means a mobile-class
 * GPU gets the heavier config, which the DPR/core-count signals below
 * partially guard against anyway. */
const MOBILE_RENDERER_HINTS = ["mali", "adreno", "powervr", "apple gpu", "videocore", "immortalis"];

function getRendererString(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === "string" ? renderer.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function detectDeviceTier(): DeviceTierConfig {
  if (typeof window === "undefined") return DESKTOP_CONFIG;

  let mobileSignals = 0;

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= HARDWARE_CONCURRENCY_MIN) mobileSignals++;

  if (window.devicePixelRatio >= 2 && window.innerWidth < 900) mobileSignals++;

  const renderer = getRendererString();
  if (renderer && MOBILE_RENDERER_HINTS.some((hint) => renderer.includes(hint))) {
    mobileSignals++;
  }

  return mobileSignals >= 2 ? MOBILE_CONFIG : DESKTOP_CONFIG;
}
