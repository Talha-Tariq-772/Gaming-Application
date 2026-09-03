/**
 * Rim-glow pass — NOT a point-cloud reconstruction of the figure. Original
 * version of this file drew one point per grid cell across the WHOLE
 * silhouette (~80k points, sampling the figure's own color), which
 * visually replaced the sharp static image with a pointillized/"dissolve"
 * look — wrong for the homepage hero, where the real image (rendered as a
 * normal <img>, see NovaFigureVisual.tsx) needs to stay untouched, sharp
 * pixels, with fire sitting AROUND it, not reconstructing it.
 *
 * Same grid-sampling trick as before (gl_VertexID -> uv, no vertex
 * buffer), but every point's SIZE and ALPHA are now driven entirely by
 * `rim` — the same alpha-gradient edge-detection used here previously,
 * just no longer gated behind texture alpha itself. Solid interior
 * regions have ~zero local alpha gradient (alpha doesn't change locally
 * within a filled silhouette), so `rim` is naturally ~0 there and those
 * points render at zero size — no separate "is this an interior point"
 * check needed, the edge-detection math already excludes the interior on
 * its own. Only the ~1-2-grid-cell-wide boundary band survives, styled as
 * a warm glow (pure ember-family color, no sampling of the source image's
 * own RGB) rather than a reconstruction of the artwork.
 *
 * `#version 300 es` (ES 3.00), unlike the fog/blit/ember shaders (ES 1.00,
 * no #version pragma) — both compile fine in the same WebGL2 context, but
 * the version pragma MUST be the first characters of the source:
 * - Do NOT add a leading newline/indentation to either template string.
 * - Do NOT run these through withOctaves() or any other prepend helper —
 *   that would push `#version 300 es` off line 1 and fail to compile.
 */
export const figureVertexShader = `#version 300 es
precision highp float;

uniform sampler2D uColor;
uniform vec2  uGrid;
uniform float uTime;
uniform float uDissolve;
uniform mat4  uProjection;
uniform mat4  uView;
uniform float uPointScale;
uniform float uAspect;

out float vRim;
out vec3  vColor;

vec3 hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

void main() {
  float id = float(gl_VertexID);
  float gx = mod(id, uGrid.x);
  float gy = floor(id / uGrid.x);
  vec2 uv = (vec2(gx, gy) + 0.5) / uGrid;
  vec3 rnd = hash31(id);

  // Flat plane matching the real (flat, 2D) <img> underneath — no depth
  // sampling, no per-point z displacement. The glow hugs the image's own
  // plane rather than bulging off it.
  vec3 pos;
  pos.x = (uv.x - 0.5) * uAspect;
  pos.y = (0.5 - uv.y);
  pos.z = 0.0;

  // Small in-plane jitter only, for an organic (non-static) outline —
  // no scroll-driven "escape" motion; that belonged to the old full-body
  // reconstruction's dissolve and doesn't make sense for an ambient glow.
  float t = uTime * 0.35;
  pos.x += sin(t + rnd.x * 6.2831) * 0.003;
  pos.y += cos(t * 0.8 + rnd.y * 6.2831) * 0.003;

  // Edge-detect via the alpha GRADIENT at a small UV step (no Sobel
  // needed — the alpha channel is already a near-binary silhouette mask,
  // so a 4-neighbor central difference finds its boundary reliably).
  // Weighted toward the lower two-thirds (heat rises, so the top stays
  // subtler) and pulsed with a slow per-point-phased sine so the glow
  // visibly breathes rather than sitting static.
  float rimStep = 1.5 / uGrid.y;
  float aL = texture(uColor, uv - vec2(rimStep, 0.0)).a;
  float aR = texture(uColor, uv + vec2(rimStep, 0.0)).a;
  float aT = texture(uColor, uv - vec2(0.0, rimStep)).a;
  float aB = texture(uColor, uv + vec2(0.0, rimStep)).a;
  float edge = length(vec2(aR - aL, aB - aT));
  float verticalWeight = smoothstep(0.2, 0.55, uv.y);
  float pulse = 0.7 + 0.3 * sin(uTime * 0.8 + rnd.x * 6.2831);
  float rim = clamp(edge * 3.0, 0.0, 1.0) * verticalWeight * pulse * (1.0 - uDissolve);
  vRim = rim;

  // Warm color family, slight per-point hue/brightness variation rather
  // than one flat flat tone.
  vec3 emberBright = vec3(1.0, 0.541, 0.239);
  vec3 ember = vec3(0.757, 0.267, 0.055);
  vColor = mix(ember, emberBright, rnd.z * 0.6);

  vec4 viewPos = uView * vec4(pos, 1.0);
  gl_Position  = uProjection * viewPos;
  gl_PointSize = clamp(uPointScale / max(0.001, -viewPos.z) * (0.5 + rim), 1.0, 7.0);

  if (rim <= 0.04) {
    gl_Position  = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
}
`;

export const figureFragmentShader = `#version 300 es
precision mediump float;

in float vRim;
in vec3  vColor;

out vec4 fragColor;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;

  float falloff = 1.0 - smoothstep(0.06, 0.25, d);
  fragColor = vec4(vColor * falloff, vRim * falloff);
}
`;
