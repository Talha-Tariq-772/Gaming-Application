/**
 * Ember particle layer (Part D fire-effect spec). Rewritten from the
 * original screen-space-random version: positions now come from
 * sampleAlphaEdgeUVs (webgl-helpers.ts) — CPU-sampled, weighted toward the
 * figure's alpha EDGES — transformed by the SAME uProjection/uView the
 * figure uses, so embers sit on the figure's actual silhouette and orbit
 * with it instead of drifting across the whole screen independently of
 * where the figure is or which way it's facing.
 *
 * All per-frame motion (rise, curl-noise wander, color-over-lifetime) is
 * computed here from uTime and each point's own aBase/aRandom attributes —
 * NovaCanvas.tsx only ever updates uTime, uProjection, and uView per
 * frame, same division of labor as the figure shader.
 */
export const embersVertexShader = `
attribute vec2 aBase;   // UV on the figure's alpha map, edge-weighted
attribute vec4 aRandom; // x: curl seed, y: rise-speed seed, z: size seed, w: phase offset
uniform float uTime;
uniform mat4  uProjection;
uniform mat4  uView;
uniform float uAspect;
uniform float uPointScale;

varying float vAlpha;
varying vec3  vColor;

float emberHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Perpendicular gradient of a scalar hash field — a cheap, visually
// convincing curl-noise stand-in (divergence-free-ish swirl) without a
// full simplex/curl-noise implementation. See NOVA fire-effect notes.
vec2 curl(vec2 p) {
  float e = 0.06;
  float n1 = emberHash(p + vec2(0.0, e));
  float n2 = emberHash(p - vec2(0.0, e));
  float n3 = emberHash(p + vec2(e, 0.0));
  float n4 = emberHash(p - vec2(e, 0.0));
  return vec2((n1 - n2), -(n3 - n4)) / (2.0 * e);
}

void main() {
  float riseSpeed = 0.10 + aRandom.y * 0.16;
  float phase = fract(uTime * riseSpeed + aRandom.w);

  vec3 pos;
  pos.x = (aBase.x - 0.5) * uAspect;
  pos.y = (0.5 - aBase.y);
  pos.z = (aRandom.z - 0.5) * 0.08;

  // Upward drift over the particle's lifetime, plus curl-noise wander that
  // grows with height (embers wander more as they rise and lose momentum
  // near the source).
  vec2 wander = curl(vec2(aRandom.x * 12.0, phase * 2.4 + uTime * 0.15));
  pos.y += phase * 0.65;
  pos.x += wander.x * 0.05 * phase;
  pos.z += wander.y * 0.05 * phase;

  // Color over lifetime: bright orange -> ember -> deep red -> fade.
  vec3 cBright = vec3(1.0, 0.541, 0.239);   // #FF8A3D
  vec3 cEmber  = vec3(0.757, 0.267, 0.055); // #C1440E
  vec3 cDeep   = vec3(0.28, 0.05, 0.03);    // deep red, cooling
  vec3 color = mix(cBright, cEmber, smoothstep(0.0, 0.35, phase));
  color = mix(color, cDeep, smoothstep(0.45, 0.85, phase));
  vColor = color;

  float envelope = smoothstep(0.0, 0.08, phase) * smoothstep(1.0, 0.72, phase);
  vAlpha = envelope;

  vec4 viewPos = uView * vec4(pos, 1.0);
  gl_Position = uProjection * viewPos;
  float size = mix(1.0, 3.2, aRandom.z) * (1.0 - phase * 0.35);
  gl_PointSize = clamp(uPointScale * size / max(0.001, -viewPos.z), 1.0, 14.0);

  if (envelope <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
}
`;

export const embersFragmentShader = `
precision highp float;
varying float vAlpha;
varying vec3  vColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * core, core * vAlpha);
}
`;
