#version 300 es
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
