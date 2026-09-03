/**
 * Ember particle layer (Part D fire-effect spec, reworked for realism per
 * user feedback: uniform-dot embers read as a filter, not fire). Positions
 * come from sampleAlphaEdgeUVs (webgl-helpers.ts) — CPU-sampled, weighted
 * toward the figure's alpha EDGES and biased toward its lower half (base) —
 * transformed by the SAME uProjection/uView the figure uses, so embers sit
 * on the figure's actual silhouette and orbit with it instead of drifting
 * across the whole screen independently of where the figure is or which
 * way it's facing.
 *
 * All per-frame motion (rise, curl-noise wander, color-over-lifetime, size,
 * per-particle death point, flicker) is computed here from uTime and each
 * point's own aBase/aRandom attributes — NovaCanvas.tsx only ever updates
 * uTime, uProjection, and uView per frame, same division of labor as the
 * figure shader.
 *
 * Realism levers (each maps to one line item the flat/uniform version was
 * missing):
 * - SIZE: skewed toward small sparks (pow(aRandom.z, exponent) biases the
 *   [0,1] seed toward 0), with a long tail up to larger embers, instead of
 *   one narrow linear range.
 * - LIFETIME: `dieAt` is an independent per-particle hash, not tied to
 *   riseSpeed or phase offset — some particles fade out well before phase
 *   reaches 1.0 (die early, stay low — pos.y is driven by the same raw
 *   `phase`, so an early death also means it never traveled far) while
 *   others ride to dieAt~1.0 (drift far up). Because dieAt is a fixed
 *   per-particle constant rather than randomized every cycle, each point
 *   repeats its own lifespan every loop — still reads as varied overall
 *   because the distribution across ~hundreds of points is wide.
 * - VERTICAL STRETCH: faster (higher riseSpeed) particles get a taller
 *   point size and a vStretch varying that elongates the fragment's alpha
 *   footprint along screen Y — point sprites can't rotate to match an
 *   arbitrary velocity vector, but since rise is always ~vertical here,
 *   stretching along Y alone reads as directional motion blur.
 * - DENSITY: handled upstream in sampleAlphaEdgeUVs' spawn weighting (base
 *   rows weighted higher than upper rows), not in this shader.
 * - FLICKER: brightness modulated by a per-particle hash re-rolled at a
 *   fixed ~12Hz (uTime quantized before hashing) rather than held constant,
 *   so embers visibly flicker independent of their rise/fade envelope.
 */
export const embersVertexShader = `
attribute vec2 aBase;   // UV on the figure's alpha map, edge- and base-weighted
attribute vec4 aRandom; // x: curl seed, y: rise-speed seed, z: size seed, w: phase offset
uniform float uTime;
uniform mat4  uProjection;
uniform mat4  uView;
uniform float uAspect;
uniform float uPointScale;

varying float vAlpha;
varying vec3  vColor;
varying float vStretch;

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

  // Independent per-particle randoms beyond the 4 stored channels, hashed
  // from combinations of them — cheaper than a 5th/6th attribute channel
  // and plenty for seeding a couple of uncorrelated distributions.
  float dieHash  = emberHash(vec2(aRandom.w, aRandom.y) + 7.31);
  float sizeHash = pow(aRandom.z, 2.0); // skews toward 0: many small sparks, few large embers

  // Most particles snuff out well before completing a full rise; a smaller
  // fraction rides close to phase 1.0. pow() skews the distribution toward
  // early death so the crowd thins with height on its own.
  float dieAt = mix(0.28, 1.0, pow(dieHash, 1.7));

  vec3 pos;
  pos.x = (aBase.x - 0.5) * uAspect;
  pos.y = (0.5 - aBase.y);
  pos.z = (aRandom.z - 0.5) * 0.08;

  // Upward drift over the particle's lifetime, plus curl-noise wander that
  // grows with height (embers wander more as they rise and lose momentum
  // near the source). Driven by raw phase, not clamped to dieAt — an
  // early-dying particle's alpha hits 0 before it travels far, which is
  // what makes it read as "died low" rather than "died at the top".
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

  // Per-particle flicker: re-rolled roughly 12 times a second (uTime
  // quantized before hashing) so brightness visibly pulses independent of
  // the slow rise/fade envelope, instead of holding constant all lifetime.
  float flickerSeed = emberHash(aRandom.xy + floor(uTime * 12.0) * 0.017);
  float flicker = 0.6 + 0.4 * flickerSeed;
  vColor = color * flicker;

  float fadeIn  = smoothstep(0.0, 0.05, phase);
  float fadeOut = 1.0 - smoothstep(dieAt - 0.18, dieAt, phase);
  float envelope = fadeIn * fadeOut;
  vAlpha = envelope;

  // Faster-rising particles get a taller silhouette (fake directional
  // motion blur — point sprites can't rotate to a velocity vector, but
  // rise here is always ~vertical, so Y-only stretch reads correctly).
  float stretch = mix(1.0, 3.0, smoothstep(0.14, 0.26, riseSpeed));
  vStretch = stretch;

  vec4 viewPos = uView * vec4(pos, 1.0);
  gl_Position = uProjection * viewPos;
  // Wide small-to-large range (0.4 - 6.5) instead of a narrow uniform band;
  // taller sprites also need a larger footprint so the Y-stretched ellipse
  // isn't clipped by its own point-sprite bounds.
  float size = mix(0.4, 6.5, sizeHash) * (1.0 - phase * 0.3) * mix(1.0, 1.5, smoothstep(0.14, 0.26, riseSpeed));
  gl_PointSize = clamp(uPointScale * size / max(0.001, -viewPos.z), 1.0, 20.0);

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
varying float vStretch;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  uv.y /= vStretch;
  float d = length(uv);
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * core, core * vAlpha);
}
`;
