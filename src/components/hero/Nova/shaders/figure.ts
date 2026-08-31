/**
 * Point-cloud figure shaders — spec/figure-points.vert.glsl and
 * spec/figure-points.frag.glsl, copied verbatim (see spec/PATH_A_POINT_CLOUD.md,
 * Session B). `#version 300 es` (ES 3.00), unlike the fog/blit/ember shaders
 * (ES 1.00, no #version pragma) — both compile fine in the same WebGL2
 * context, but the version pragma MUST be the first characters of the
 * source, so:
 *
 * - Do NOT add a leading newline/indentation to either template string.
 * - Do NOT run these through withOctaves() or any other prepend helper —
 *   that would push `#version 300 es` off line 1 and fail to compile.
 */
export const figureVertexShader = `#version 300 es
precision highp float;

uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2  uGrid;
uniform float uTime;
uniform float uDissolve;
uniform mat4  uProjection;
uniform mat4  uView;
uniform float uPointScale;
uniform float uDepthScale;
uniform float uAspect;

out float vAlpha;
out vec3  vTint;
out float vRim;

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
  vec3  rnd   = hash31(id);

  // Part D, layer 3 (heat shimmer): displace the UV used to sample the
  // figure's color/depth by a scrolling noise field before either lookup
  // — amplitude zero near the top, strongest at the bottom (uv.y is 0 at
  // the figure's top edge, 1 at its base, since pos.y = 0.5 - uv.y). This
  // is what makes the glow read as heat distorting the figure rather than
  // paint sitting on top of it; the grid position (uv itself) below stays
  // un-shimmered so points don't jitter across the silhouette's outline.
  float shimmerAmt = 0.003 * smoothstep(0.3, 1.0, uv.y);
  vec2 shimmer = vec2(
    sin(uv.y * 40.0 + uTime * 2.0),
    cos(uv.x * 40.0 + uTime * 1.7)
  ) * shimmerAmt;
  vec2 sampleUV = uv + shimmer;

  vec4  tex   = texture(uColor, sampleUV);
  float depth = texture(uDepth, sampleUV).r;

  vec3 pos;
  pos.x = (uv.x - 0.5) * uAspect;
  pos.y = (0.5 - uv.y);
  pos.z = (depth - 0.5) * uDepthScale;

  float t = uTime * 0.35;
  pos.x += sin(t + rnd.x * 6.2831) * 0.004;
  pos.y += cos(t * 0.8 + rnd.y * 6.2831) * 0.004;
  pos.z += sin(t * 0.6 + rnd.z * 6.2831) * 0.006;

  float stagger = clamp((uDissolve - rnd.x * 0.45) / 0.55, 0.0, 1.0);
  vec3 escape = normalize(vec3(rnd.x - 0.5, 0.35 + rnd.y * 0.5, rnd.z - 0.5));
  pos += escape * stagger * (0.25 + rnd.z * 0.5);

  // Part D, layer 2 (rim glow): edge-detect via the alpha GRADIENT at a
  // small UV step (no Sobel needed — the alpha channel is already a near-
  // binary silhouette mask, so a 4-neighbor central difference finds its
  // boundary reliably). Weighted toward the lower two-thirds (heat rises,
  // so the top stays subtler) and pulsed with a slow per-point-phased sine
  // so the glow visibly breathes rather than sitting static.
  float rimStep = 1.5 / uGrid.y;
  float aL = texture(uColor, uv - vec2(rimStep, 0.0)).a;
  float aR = texture(uColor, uv + vec2(rimStep, 0.0)).a;
  float aT = texture(uColor, uv - vec2(0.0, rimStep)).a;
  float aB = texture(uColor, uv + vec2(0.0, rimStep)).a;
  float edge = length(vec2(aR - aL, aB - aT));
  float verticalWeight = smoothstep(0.2, 0.55, uv.y);
  float pulse = 0.7 + 0.3 * sin(uTime * 0.8 + rnd.x * 6.2831);
  vRim = clamp(edge * 3.0, 0.0, 1.0) * verticalWeight * pulse;

  float alpha = tex.a < 0.4 ? 0.0 : tex.a * (1.0 - stagger);
  vAlpha = alpha;

  // Part D, art direction: tint the figure itself warm where the glow is
  // strongest (up to 25%, driven by rim intensity), on top of the existing
  // dissolve-escape tint (which still wins as a piece fully dissolves).
  vec3 ember = vec3(0.757, 0.267, 0.055);
  vec3 glowTint = mix(tex.rgb, ember, clamp(vRim * 0.6, 0.0, 0.25));
  vTint = mix(glowTint, ember, stagger * 0.9);

  vec4 viewPos = uView * vec4(pos, 1.0);
  gl_Position  = uProjection * viewPos;
  gl_PointSize = clamp(uPointScale / max(0.001, -viewPos.z) * (1.0 + stagger * 0.6), 1.0, 12.0);

  if (alpha <= 0.001) {
    gl_Position  = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
}
`;

export const figureFragmentShader = `#version 300 es
precision mediump float;

in float vAlpha;
in vec3  vTint;
in float vRim;

out vec4 fragColor;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;

  float falloff = 1.0 - smoothstep(0.06, 0.25, d);
  // Rim glow is additive on top of the point's own color/alpha, not a
  // replacement — it brightens the silhouette's edge points without
  // adding new geometry (this pass already draws one point per grid cell).
  vec3 ember = vec3(0.757, 0.267, 0.055);
  fragColor = vec4(vTint * falloff + ember * vRim * falloff * 0.5, (vAlpha + vRim * 0.4) * falloff);
}
`;
