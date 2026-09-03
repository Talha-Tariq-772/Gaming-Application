/**
 * Verbatim copy of spec/hero-fog.frag.glsl. Kept as a plain .ts string
 * export rather than a .glsl file with a custom loader — Next's webpack
 * config and vitest's own bundler would each need their own raw-text
 * loader configured to import a literal .glsl file, and this way both
 * already handle it for free as an ordinary TS module. OCTAVES is
 * supplied at compile time via ShaderMaterial's `defines`, not hardcoded
 * here — see NovaCanvas.tsx.
 */
export const fogFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uIntensity;

#ifndef OCTAVES
#define OCTAVES 5
#endif

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < OCTAVES; i++) {
    v += amp * vnoise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  // WebGL's gl_FragCoord.y increases UPWARD from the viewport's bottom-left
  // (unlike CSS/canvas 2D), so uv.y is 0 at the screen's bottom and 1 at
  // its top. Flipped here once so every position-based term below (ground
  // glow, heat shimmer) can be written the intuitive way — uv.y near 1 =
  // near the bottom / the figure's base — without each one re-deriving it.
  uv.y = 1.0 - uv.y;
  vec2 p  = uv * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime * 0.045;

  vec2 q = vec2(
    fbm(p * 1.4 + vec2(0.0, t)),
    fbm(p * 1.4 + vec2(5.2, 1.3 - t))
  );
  float f = fbm(p * 1.9 + q * 0.85 + vec2(t * 0.5, -t));

  // This pass used to paint a full-bleed opaque atmospheric background
  // (ambient haze + top glow + vignette + grain, alpha always 1.0) — that
  // was fine as the WHOLE hero when nothing but this canvas existed (the
  // old /dev/nova-hero route), but the homepage now renders the real
  // artwork as a plain, sharp <img> underneath this canvas (see
  // NovaFigureVisual.tsx) and only wants two ACCENT effects layered
  // OVER it: ground glow beneath the figure, and heat shimmer near its
  // base. Everywhere else must stay fully transparent (alpha 0) so the
  // real image shows through untouched, so col/alpha here only ever
  // accumulate from those two accents, never a full-frame base tint.
  vec3 ember = vec3(0.757, 0.267, 0.055);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Ground glow: soft warm radial falloff centered at the figure's base
  // (screen-center-x, near the bottom). The figure sits horizontally
  // centered in world space at rest (no orbit offset), which maps to
  // uv.x ~= 0.5 in this fullscreen pass. f modulates it slightly so it
  // isn't perfectly static.
  vec2 groundCenter = vec2(0.5, 1.05);
  float groundDist = length((uv - groundCenter) * vec2(1.6, 1.0));
  float groundGlow = smoothstep(0.85, 0.0, groundDist) * (0.65 + 0.35 * f);
  col += ember * groundGlow * 0.9 * uIntensity;
  alpha += groundGlow * 0.75 * uIntensity;

  // Heat shimmer: a fast-flickering warm haze band low in frame, much
  // higher spatial + time frequency than the ground glow's slow fbm so it
  // reads as a distinct, faster-moving layer. This pass never samples the
  // figure's own texture (it's a plain fullscreen pass behind a real
  // <img>), so this can only ever be an additive warm overlay, never a
  // refraction/distortion of the actual artwork's pixels.
  float shimmerT = uTime * 0.9;
  float shimmerNoise = fbm(vec2(p.x * 6.0 + shimmerT, p.y * 2.5 - shimmerT * 1.3));
  float shimmerBand = smoothstep(0.5, 0.8, uv.y) * smoothstep(1.05, 0.78, uv.y);
  float shimmer = shimmerBand * (shimmerNoise * 0.5 + 0.5);
  col += ember * shimmer * 0.5 * uIntensity;
  alpha += shimmer * 0.35 * uIntensity;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
}
`;

/**
 * Fullscreen-triangle vertex shader — 3 vertices whose clip-space (x, y)
 * positions extend past [-1,1] on two of them, so the interpolated
 * triangle still fully covers the viewport with one fewer vertex than a
 * quad and no diagonal seam. `position` is a plain vec2 attribute holding
 * those raw clip-space coordinates directly (set up in webgl-helpers.ts'
 * FULLSCREEN_TRIANGLE_POSITIONS); this shader just passes them through.
 */
export const fullscreenVertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;
