/**
 * Passthrough fullscreen-triangle shader that samples the low-res fog
 * render target and draws it upscaled to the full-resolution screen — the
 * resolution-scaling technique from NOVA_DESIGN_SPEC.md #6 ("render to an
 * offscreen buffer at 0.6x/0.5x... upscaled"). This is a single texture
 * sample, not a chain of effects — not what "no EffectComposer" is ruling
 * out (that's about avoiding EffectComposer's multi-pass *effects*
 * machinery); this is the one pass the scale-down/scale-up technique
 * itself requires to exist at all.
 */
export const blitFragmentShader = `
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  gl_FragColor = texture2D(uTexture, uv);
}
`;
