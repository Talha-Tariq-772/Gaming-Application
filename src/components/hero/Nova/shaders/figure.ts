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

  vec4  tex   = texture(uColor, uv);
  float depth = texture(uDepth, uv).r;
  vec3  rnd   = hash31(id);

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

  float alpha = tex.a < 0.4 ? 0.0 : tex.a * (1.0 - stagger);
  vAlpha = alpha;
  vTint  = mix(tex.rgb, vec3(0.757, 0.267, 0.055), stagger * 0.9);

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

out vec4 fragColor;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;

  float falloff = 1.0 - smoothstep(0.06, 0.25, d);
  fragColor = vec4(vTint * falloff, vAlpha * falloff);
}
`;
