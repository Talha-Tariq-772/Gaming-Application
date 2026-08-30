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
  vec2 p  = uv * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime * 0.045;

  vec2 q = vec2(
    fbm(p * 1.4 + vec2(0.0, t)),
    fbm(p * 1.4 + vec2(5.2, 1.3 - t))
  );
  float f = fbm(p * 1.9 + q * 0.85 + vec2(t * 0.5, -t));

  vec3 vd   = vec3(0.031, 0.024, 0.039);
  vec3 fog  = vec3(0.129, 0.086, 0.063);
  vec3 col  = mix(vd, fog, smoothstep(0.28, 0.88, f) * uIntensity);

  float glow = smoothstep(0.9, 0.0, uv.y) * f;
  col += vec3(0.757, 0.267, 0.055) * glow * 0.16 * uIntensity;

  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 1.75;

  float g = hash(gl_FragCoord.xy + fract(uTime)) - 0.5;
  col += g * 0.035;

  gl_FragColor = vec4(col, 1.0);
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
