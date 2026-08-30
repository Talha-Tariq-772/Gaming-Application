# Path A — GPU point-cloud hero figure

Adds a genuinely 3D figure to the Nova hero: the artwork sampled into ~80k GPU points, given real depth, orbiting with the pointer, dissolving into embers on scroll. No model files, no three.js, no loaders.

Run as two sessions. Session A is offline asset prep and can fail for environment reasons that have nothing to do with the code — don't tangle it with the render work.

---

## Before you start

**Check the artwork's licensing.** The current hero figure reads as Guts from Berserk. On a client storefront that takes real money this is a real liability — confirm with Hashir that it's AI-generated, commissioned, or licensed before this ships. The pipeline below works with any source art, so swapping it later is cheap; shipping it and finding out later is not.

**Two known environment gaps from sessions 4–6**, so nobody rediscovers them:
- No browser in the Claude Code environment. fps, LCP and CLS cannot be measured there. Only ask for chunk size (from `.next/react-loadable-manifest.json`) and have everything else flagged as unmeasured.
- This repo uses `src/components/`, not a top-level `components/`.

---

## Session A — asset prep

```
Write scripts/generate-figure-assets.mjs. It runs once, offline, and its outputs
get committed — it must never run at request time.

Input: the current hero artwork. Outputs, both into public/hero/:

1. figure-color.webp — the figure alpha-cut from its background, 1024px on the
   long edge, quality 80, alpha preserved.
   If the source already has a clean alpha channel, just resize it.
   If it does not, run briaai/RMBG-1.4 via @huggingface/transformers to
   segment the figure out. Do not threshold on luminance — the artwork is
   dark-on-dark and thresholding will eat the figure's shadow side.

2. figure-depth.webp — grayscale depth map, same dimensions, quality 85.
   Generate with Depth-Anything-V2-Small via @huggingface/transformers, run
   locally in this script. Never call a hosted API.
   Normalise so near = white (255), far = black (0), and report the raw
   min/max before normalisation so I can see whether the model actually
   found structure or returned a flat field.

Both models download on first run (~100MB combined). If that download is
blocked or fails, stop and tell me — do not fall back to a synthetic or
flat depth map, because a flat depth map makes the whole point cloud
pointless and it will not be obvious from the code that it happened.

Also write out public/hero/figure-depth-preview.png (depth map at 512px,
no compression) so I can eyeball it. Report both files' byte sizes.
```

Look at the depth preview before moving on. If the figure's sword, arms and torso aren't clearly separated in it, the 3D effect won't read and no amount of shader work fixes that.

---

## Session B — the render pass

```
Read spec/NOVA_DESIGN_SPEC.md section 6, and spec/figure-points.vert.glsl and
spec/figure-points.frag.glsl.

Add the point-cloud figure to the EXISTING NovaCanvas WebGL2 context as a
fourth pass. Do not create a second canvas or a second GL context, and do not
add three.js back — the raw-WebGL2 rewrite got this component to 3.5kB gzip
and that has to hold.

ARCHITECTURE

1. New file src/components/hero/Nova/shaders/figure.ts exporting the two
   shader sources as template strings, copied verbatim from the spec files.

   These are `#version 300 es` (ES 3.00), unlike the existing fog/blit/ember
   shaders which are ES 1.00. Both compile fine in the same WebGL2 context,
   but:
   - `#version 300 es` MUST be the first characters in the string. No leading
     newline, no indentation. A template literal starting with a newline will
     fail to compile.
   - Do NOT run these through withOctaves() or any other prepend helper — it
     would push the #version directive off line 1.

2. Extend webgl-helpers.ts with:
   - loadTexture(gl, url) -> Promise<WebGLTexture>, LINEAR filtering,
     CLAMP_TO_EDGE on both axes, premultiplyAlpha false, flipY false
     (the shader handles the Y flip itself).
   - perspective(fovY, aspect, near, far) -> Float32Array(16)
   - lookAtSimple() or an equivalent — you only need translate + rotateY,
     so hand-roll it rather than pulling in gl-matrix.

3. In NovaCanvas.tsx, add the figure program. Key points:

   - NO vertex buffer and NO attributes. The shader derives its grid position
     from gl_VertexID. Bind a VAO with nothing in it and call
     gl.drawArrays(gl.POINTS, 0, pointCount).
   - Point count from deviceTier: 80,000 desktop (uGrid 320x250),
     40,000 mobile (uGrid 200x200). Add pointCount and grid to the existing
     DeviceTierConfig rather than creating a parallel config object.
   - Vertex texture fetch: WebGL2 guarantees at least 16 vertex texture
     units, so sampling in the vertex shader is safe here. It would not have
     been on WebGL1 — this is part of why the gate probes for webgl2.
   - Blending: additive (SRC_ALPHA, ONE), depth test OFF. This is deliberate.
     Additive is order-independent, so the point cloud needs no depth sorting
     and no depth buffer, which means the existing context options
     (depth: false, stencil: false) stay exactly as they are. Do not turn on
     depth testing.

4. Draw order inside renderFrame, after the existing passes:
     fog -> low-res FBO
     blit -> screen
     figure -> screen   (additive, full res)
     embers -> screen   (additive, full res)
   The figure goes BEFORE the embers so embers read as floating in front of it.

5. Textures load asynchronously. Until both resolve, skip the figure pass
   entirely and keep rendering fog + embers — the hero must never block or
   flash on texture load. If either texture fails to load, log once and
   permanently skip the figure pass; fog and embers carry on.

6. Uniforms per frame: uTime, uDissolve, uView. uProjection, uGrid, uAspect,
   uPointScale, uDepthScale only change on resize. Keep the existing
   discipline of one uniform write per frame per changing value and zero
   per-frame JS touching vertex data.
   uAspect = figure texture width / height. uDepthScale start at 0.35.

MOTION

7. Orbit: pointer X/Y maps to +/- 6 degrees Y-rotation and +/- 3 degrees of
   vertical camera offset. Damp it — GSAP quickTo into a ref, 0.9s, the
   `out` easing from lib/motion.ts. Never map pointer position 1:1.
   The rAF loop reads the damped ref; the pointer handler only writes to it.

8. Dissolve: uDissolve 0 -> 1 driven by ScrollTrigger scrub over the hero's
   own height, reaching 1 as the hero fully exits. Use the existing
   ScrollTrigger setup from lib/use-gsap; do not create a second Lenis or
   ScrollTrigger instance.

9. Mobile has no pointer — drive the orbit from deviceorientation at half
   amplitude, behind a feature check. If unavailable, the figure sits static
   and only the idle drift and dissolve run. Do not request iOS motion
   permission on load; if you want it, it has to be behind a user gesture,
   and I'd rather just skip it.

FALLBACK

10. NovaCanvasGate already handles reduced-motion and the webgl2 probe. Nothing
    changes there — if the gate says no, the static poster stays and this
    chunk is never requested. Verify that's still true after your changes
    rather than assuming it.

11. The poster stays the LCP element. The figure must not become the thing
    the page waits on.

BUDGETS

12. Measurable here — report actuals:
    - NovaCanvas chunk, gzipped, from .next/react-loadable-manifest.json on a
      clean rebuild. Target <= 15kB (it is 3.5kB now).
    - public/hero/ asset total. Target <= 250kB.
    - next build exit code and eslint clean across the touched files.

13. NOT measurable here — state plainly that they were not measured rather
    than estimating: 60fps desktop, >=45fps at 4x CPU throttle, LCP, CLS.

If a measurable budget is missed, say which and what you'd cut. Don't ship
over budget quietly.

WIRING

14. Keep this on /dev/nova-hero. Do not swap the live homepage hero. I want to
    look at it first.
```

---

## What to check when you look at it

- Does the figure have real depth, or does it look like a flat sheet of dots? If flat, the depth map is the problem, not the shader — go back to Session A.
- Does the dissolve read as embers rising, or as the figure smearing? If it smears, the `escape` vector's upward bias needs raising above 0.35.
- On a real mid-range Android: does the hero still feel instant? The poster should be up long before the points are.

Once it looks right, wiring it into the homepage is a one-line swap — but do that as its own commit so it's trivially revertible.
