/**
 * Plain GLSL ES 1.00 (no #version pragma) — a WebGL2 context compiles this
 * natively with no compatibility shim, same as NovaCanvas's shaders (see
 * webgl-helpers.ts's file comment). Two full-res textures, a single
 * fullscreen-triangle draw call, no scene graph — raw WebGL2, no three.js.
 */

export const dissolveVertexShader = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * Dissolve, not a linear cross-fade: a cheap value-noise field is compared
 * against uProgress with a soft smoothstep band, so the transition reads as
 * an organic "burning" boundary sweeping across the frame rather than a
 * uniform opacity blend. uCurrent/uNext are each sampled through their own
 * cover-fit UV transform (computed in JS from each texture's real aspect
 * ratio vs. the canvas's — see computeCoverTransform in SliderCanvas.tsx)
 * so differently-shaped source wallpapers all fill the frame without
 * distortion, the same result CSS `object-fit: cover` gives the fallback
 * path.
 */
export const dissolveFragmentShader = `
precision mediump float;
varying vec2 vUv;

uniform sampler2D uCurrent;
uniform sampler2D uNext;
uniform float uProgress;
uniform vec2 uCurrentUvScale;
uniform vec2 uCurrentUvOffset;
uniform vec2 uNextUvScale;
uniform vec2 uNextUvOffset;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 currentUv = vUv * uCurrentUvScale + uCurrentUvOffset;
  vec2 nextUv = vUv * uNextUvScale + uNextUvOffset;
  vec4 current = texture2D(uCurrent, currentUv);
  vec4 next = texture2D(uNext, nextUv);

  float n = noise(vUv * 8.0);
  float edge = 0.12;
  float mask = smoothstep(uProgress - edge, uProgress + edge, n);
  gl_FragColor = mix(next, current, mask);
}
`;
