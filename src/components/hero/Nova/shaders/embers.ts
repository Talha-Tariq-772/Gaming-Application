/**
 * Ember particle layer (NOVA_DESIGN_SPEC.md #6). Positions are computed
 * entirely here, from uTime and each point's own aRandom attribute — the
 * JS side (NovaCanvas.tsx) only ever updates the single uTime uniform per
 * frame, never touches the position/aRandom buffers after creation.
 */
export const embersVertexShader = `
attribute vec2 position;
attribute vec3 aRandom; // x: horizontal drift phase, y: rise speed, z: size seed
uniform float uTime;

varying float vAlpha;

void main() {
  float speed = 0.05 + aRandom.y * 0.12;
  // Wraps forever in [-1, 1] — a looping rise, not a one-shot animation.
  float y = fract(position.y + uTime * speed) * 2.0 - 1.0;
  float drift = sin(uTime * 0.6 + aRandom.x * 6.2831853) * 0.05;

  // Fades in/out at the top and bottom of the loop so wraparound is
  // invisible rather than a hard pop.
  vAlpha = smoothstep(-1.0, -0.75, y) * smoothstep(1.0, 0.8, y);

  gl_Position = vec4(position.x + drift, y, 0.0, 1.0);
  gl_PointSize = 2.0 + aRandom.z * 4.0;
}
`;

export const embersFragmentShader = `
precision highp float;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float core = smoothstep(0.5, 0.0, d);
  // Same ember tint as the fog shader's own glow term.
  vec3 emberColor = vec3(0.757, 0.267, 0.055);
  gl_FragColor = vec4(emberColor * core, core * vAlpha);
}
`;
