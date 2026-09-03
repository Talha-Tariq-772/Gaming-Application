"use client";

import { useEffect, useRef } from "react";
import { detectDeviceTier } from "@/src/lib/deviceTier";
import { dur, gsapEase, gsapTweenEase } from "@/src/lib/motion";
import { fogFragmentShader, fullscreenVertexShader } from "./shaders/fog.frag";
import { embersFragmentShader, embersVertexShader } from "./shaders/embers";
import { blitFragmentShader } from "./shaders/blit";
import { figureFragmentShader, figureVertexShader } from "./shaders/figure";
import {
  buildOrbitView,
  createBuffer,
  createEmberRandomData,
  createProgram,
  FULLSCREEN_TRIANGLE_POSITIONS,
  loadImage,
  perspective,
  sampleAlphaEdgeUVs,
  textureFromImage,
  withOctaves,
} from "./webgl-helpers";

// ---- Rim-glow + ember fire effect: fixed scene constants ----
// (figure.ts's point-cloud-reconstruction predecessor came from
// spec/PATH_A_POINT_CLOUD.md; this file no longer draws a body
// reconstruction, so most of that spec's per-point depth/dissolve-escape
// math doesn't apply here anymore — see figure.ts's own header.)

// figure-color.webp is 683x1024 (portrait — a 408x612 source resized to a
// 1024px long edge, see scripts/generate-figure-assets.mjs). Hardcoded
// rather than read back from the loaded Image because it's a committed,
// fixed-aspect asset, not user content. figure-depth.webp is no longer
// loaded here — the rim/ember passes only ever needed the color texture's
// alpha channel, never real depth; the point-cloud pass that used to need
// it for per-point z displacement is gone (see figure.ts).
const FIGURE_ASPECT = 683 / 1024;
const FIGURE_COLOR_URL = "/hero/figure-color.webp";

const FOV_Y = (30 * Math.PI) / 180;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 10;
// World units back from the origin. The figure occupies roughly
// FIGURE_ASPECT wide x 1.0 tall (see figure.ts's `pos.x`/`pos.y`), so this
// leaves headroom for the orbit without clipping through the near plane.
const CAMERA_DISTANCE = 2.5;

// uPointScale target-size factor: how much larger than the grid's own
// point-to-point spacing a point should render, in screen pixels — enough
// to close the gaps between adjacent grid samples without saturating under
// additive blending. Recomputed on every resize (see resize() below);
// gl_PointSize = uPointScale / -viewSpaceZ, set in figure.vert.glsl.
const POINT_SIZE_FACTOR = 1.3;

// Orbit: pointer maps to +/-6deg yaw. "+/-3 degrees of vertical camera
// offset" is a translation, not a rotation — buildOrbitView only composes
// translate + rotateY (spec point 2: hand-rolled, no gl-matrix, no
// rotateX) — so the 3-degree figure is treated as an angle-equivalent and
// converted to a world-unit vertical offset via CAMERA_DISTANCE *
// tan(3deg), keeping both axes on the same intuitive angular scale even
// though only one is an actual rotation.
const MAX_YAW = (6 * Math.PI) / 180;
const MAX_VERTICAL_OFFSET = CAMERA_DISTANCE * Math.tan((3 * Math.PI) / 180);
const ORBIT_DAMP_DURATION = 0.9; // spec's given value — not one of lib/motion.ts's dur buckets.
const MOBILE_ORBIT_AMPLITUDE = 0.5; // "half amplitude" for deviceorientation, per spec point 9.

// Dissolve: [0, 0.05, 0.1, ... 1.0] — fed to the canvas's own
// IntersectionObserver so uDissolve = 1 - intersectionRatio fires often
// enough to read as continuous.
const INTERSECTION_DISSOLVE_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i * 0.05);

/**
 * Raw WebGL2 — no three.js. The first pass used three.js's
 * RawShaderMaterial/WebGLRenderTarget, but even with named imports (no
 * tree-shaking win — WebGLRenderer's internals are too interconnected)
 * that cost 185.7kb gzip against a 120kb budget, measured from Next's own
 * react-loadable-manifest.json. This component's actual GPU footprint is 3
 * draw calls with no scene graph, materials system, or lights, so raw
 * WebGL2 does the same work directly with no library at all.
 *
 * Rendered only by NovaCanvasGate.tsx via next/dynamic({ ssr: false }),
 * which has already confirmed a WebGL context can be created and motion is
 * allowed before this module is even requested.
 */
export default function NovaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const config = detectDeviceTier();
    const gl = canvas.getContext("webgl2", {
      antialias: false, // upscaled low-res render already softens edges
      // The real artwork now renders as a plain <img> underneath this
      // canvas (see NovaFigureVisual.tsx) — the canvas itself must be
      // transparent wherever the fog/rim/ember passes don't contribute, or
      // it paints over the image instead of layering fire on top of it.
      // premultipliedAlpha: false so the browser treats this pass's
      // straight (non-premultiplied) fragColor output correctly when
      // compositing over the DOM instead of double-darkening translucent
      // pixels.
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
      depth: false,
      stencil: false,
    });
    // NovaCanvasGate already probed context creation before this module was
    // requested, but a probe on a throwaway canvas isn't a hard guarantee
    // for every subsequent call — bail to the poster rather than throw.
    if (!gl) return;

    // ---- Fog program: fullscreen triangle -> low-res render target ----
    const fogProgram = createProgram(
      gl,
      fullscreenVertexShader,
      withOctaves(fogFragmentShader, config.octaves),
    );
    const fogUniforms = {
      uTime: gl.getUniformLocation(fogProgram, "uTime"),
      uResolution: gl.getUniformLocation(fogProgram, "uResolution"),
      uIntensity: gl.getUniformLocation(fogProgram, "uIntensity"),
    };
    const fogPositionLoc = gl.getAttribLocation(fogProgram, "position");
    const triangleBuffer = createBuffer(gl, FULLSCREEN_TRIANGLE_POSITIONS);
    const fogVao = gl.createVertexArray();
    gl.bindVertexArray(fogVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
    gl.enableVertexAttribArray(fogPositionLoc);
    gl.vertexAttribPointer(fogPositionLoc, 2, gl.FLOAT, false, 0, 0);

    // ---- Blit program: upscale the render target onto the screen ----
    const blitProgram = createProgram(gl, fullscreenVertexShader, blitFragmentShader);
    const blitUniforms = {
      uTexture: gl.getUniformLocation(blitProgram, "uTexture"),
      uResolution: gl.getUniformLocation(blitProgram, "uResolution"),
    };
    const blitPositionLoc = gl.getAttribLocation(blitProgram, "position");
    const blitVao = gl.createVertexArray();
    gl.bindVertexArray(blitVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer); // same 3 vertices, reused
    gl.enableVertexAttribArray(blitPositionLoc);
    gl.vertexAttribPointer(blitPositionLoc, 2, gl.FLOAT, false, 0, 0);

    // ---- Render target: low-res texture the fog pass renders into ----
    const rtTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rtTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rtTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // ---- Ember program: additive, edge-weighted off the figure's own
    // alpha silhouette (see embers.ts) — shares uProjection/uView with the
    // figure program so embers orbit/parallax coherently with it. Base
    // positions (aBase) depend on the figure-color image having loaded
    // (sampleAlphaEdgeUVs reads its pixels), so the buffer is created in
    // the same texture-load .then() below, not here; only the
    // random-attribute buffer (independent of the image) is set up now.
    const emberProgram = createProgram(gl, embersVertexShader, embersFragmentShader);
    const emberUniforms = {
      uTime: gl.getUniformLocation(emberProgram, "uTime"),
      uProjection: gl.getUniformLocation(emberProgram, "uProjection"),
      uView: gl.getUniformLocation(emberProgram, "uView"),
      uAspect: gl.getUniformLocation(emberProgram, "uAspect"),
      uPointScale: gl.getUniformLocation(emberProgram, "uPointScale"),
    };
    const emberBaseLoc = gl.getAttribLocation(emberProgram, "aBase");
    const emberRandomLoc = gl.getAttribLocation(emberProgram, "aRandom");
    const emberRandom = createEmberRandomData(config.emberCount);
    const emberRandomBuffer = createBuffer(gl, emberRandom);
    const emberVao = gl.createVertexArray();
    let emberBaseBuffer: WebGLBuffer | null = null;
    let embersReady = false;

    // ---- Figure program: edge-detected rim glow, additive, full-res ----
    // No vertex buffer, no attributes — the vertex shader derives its grid
    // position from gl_VertexID alone, so this VAO stays empty; it only
    // needs to exist because WebGL2 requires one bound to draw at all.
    const figureProgram = createProgram(gl, figureVertexShader, figureFragmentShader);
    const figureUniforms = {
      uColor: gl.getUniformLocation(figureProgram, "uColor"),
      uGrid: gl.getUniformLocation(figureProgram, "uGrid"),
      uTime: gl.getUniformLocation(figureProgram, "uTime"),
      uDissolve: gl.getUniformLocation(figureProgram, "uDissolve"),
      uProjection: gl.getUniformLocation(figureProgram, "uProjection"),
      uView: gl.getUniformLocation(figureProgram, "uView"),
      uPointScale: gl.getUniformLocation(figureProgram, "uPointScale"),
      uAspect: gl.getUniformLocation(figureProgram, "uAspect"),
    };
    const figureVao = gl.createVertexArray();

    // Sampler texture-unit assignment never changes after this — set once,
    // not in resize() or the render loop.
    gl.useProgram(figureProgram);
    gl.uniform1i(figureUniforms.uColor, 1);
    gl.useProgram(emberProgram);
    gl.uniform1f(emberUniforms.uAspect, FIGURE_ASPECT);

    // The color image loads asynchronously; the figure (rim-glow) pass is
    // skipped entirely until it resolves (renderFrame checks figureReady),
    // and permanently skipped if it fails — fog + embers must never block
    // or flash while this loads. Loaded as a plain HTMLImageElement first
    // (not straight to a texture) because sampleAlphaEdgeUVs needs to read
    // its pixels on the CPU side to build the embers' edge-weighted base
    // positions — the texture itself is then created from that same
    // already-loaded image, no double fetch.
    let figureColorTexture: WebGLTexture | null = null;
    let figureReady = false;
    let figureLoggedFailure = false;
    let texturesCancelled = false;

    loadImage(FIGURE_COLOR_URL)
      .then((colorImage) => {
        if (texturesCancelled) return;
        figureColorTexture = textureFromImage(gl, colorImage);
        figureReady = true;

        const emberBaseUVs = sampleAlphaEdgeUVs(colorImage, config.emberCount);
        emberBaseBuffer = createBuffer(gl, emberBaseUVs);
        gl.bindVertexArray(emberVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, emberBaseBuffer);
        gl.enableVertexAttribArray(emberBaseLoc);
        gl.vertexAttribPointer(emberBaseLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, emberRandomBuffer);
        gl.enableVertexAttribArray(emberRandomLoc);
        gl.vertexAttribPointer(emberRandomLoc, 4, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        embersReady = true;
      })
      .catch((err) => {
        if (!figureLoggedFailure) {
          figureLoggedFailure = true;
          console.error("NovaCanvas: figure texture load failed, skipping figure pass permanently.", err);
        }
      });

    gl.bindVertexArray(null);

    let rtWidth = 1;
    let rtHeight = 1;

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl || !gl) return;
      const width = canvasEl.clientWidth || 1;
      const height = canvasEl.clientHeight || 1;
      const pixelWidth = Math.round(width * config.dpr);
      const pixelHeight = Math.round(height * config.dpr);
      canvasEl.width = pixelWidth;
      canvasEl.height = pixelHeight;

      rtWidth = Math.max(1, Math.round(pixelWidth * config.renderScale));
      rtHeight = Math.max(1, Math.round(pixelHeight * config.renderScale));
      gl.bindTexture(gl.TEXTURE_2D, rtTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rtWidth, rtHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      gl.useProgram(fogProgram);
      gl.uniform2f(fogUniforms.uResolution, rtWidth, rtHeight);
      gl.useProgram(blitProgram);
      gl.uniform2f(blitUniforms.uResolution, pixelWidth, pixelHeight);

      gl.useProgram(figureProgram);
      const canvasAspect = pixelWidth / pixelHeight;
      gl.uniformMatrix4fv(
        figureUniforms.uProjection,
        false,
        perspective(FOV_Y, canvasAspect, CAMERA_NEAR, CAMERA_FAR),
      );
      gl.uniform2f(figureUniforms.uGrid, config.figureGrid[0], config.figureGrid[1]);
      gl.uniform1f(figureUniforms.uAspect, FIGURE_ASPECT);

      // Perspective-correct point size: pixels-per-world-unit at
      // CAMERA_DISTANCE, times the grid's own point spacing (figure spans
      // 1.0 world unit vertically over figureGrid.height rows), times the
      // target-size factor, times CAMERA_DISTANCE again — that last factor
      // exactly cancels the vertex shader's `/ -viewSpaceZ` at the figure's
      // rest depth (-viewSpaceZ == CAMERA_DISTANCE there), so this yields
      // the intended on-screen size at rest regardless of camera distance.
      const visibleWorldHeight = 2 * CAMERA_DISTANCE * Math.tan(FOV_Y / 2);
      const pixelsPerWorldUnit = pixelHeight / visibleWorldHeight;
      const pointSpacingWorld = 1 / config.figureGrid[1];
      const pointScale = pixelsPerWorldUnit * pointSpacingWorld * POINT_SIZE_FACTOR * CAMERA_DISTANCE;
      gl.uniform1f(figureUniforms.uPointScale, pointScale);

      gl.useProgram(emberProgram);
      gl.uniformMatrix4fv(
        emberUniforms.uProjection,
        false,
        perspective(FOV_Y, canvasAspect, CAMERA_NEAR, CAMERA_FAR),
      );
      // Same base scale as the figure's points — embers are roughly the
      // same world-scale phenomenon sitting on the same silhouette: their
      // own size varies per-particle via aRandom.z in the shader instead.
      gl.uniform1f(emberUniforms.uPointScale, pointScale);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `NovaCanvas: uPointScale=${pointScale.toFixed(3)} at canvas height ${pixelHeight}px`,
        );
      }
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // ---- Orbit damping: gsap loaded async from gsap-core.ts, not
    // use-gsap.ts — this component creates no ScrollTrigger (dissolve is
    // driven by the IntersectionObserver below instead), so it doesn't
    // need to pay for that ~35kb plugin at all. ----
    const orbitState = { yaw: 0, offset: 0 };
    const dissolveState = { value: 0 };
    let gsapCancelled = false;
    let gsapCleanup: (() => void) | undefined;

    import("@/src/lib/gsap-core").then(({ gsap }) => {
      if (gsapCancelled) return;

      const yawTo = gsap.quickTo(orbitState, "yaw", {
        duration: ORBIT_DAMP_DURATION,
        ease: gsapTweenEase.out,
      });
      const offsetTo = gsap.quickTo(orbitState, "offset", {
        duration: ORBIT_DAMP_DURATION,
        ease: gsapTweenEase.out,
      });

      const pointerFine =
        typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

      function handlePointerMove(e: PointerEvent) {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        yawTo(nx * MAX_YAW);
        offsetTo(ny * MAX_VERTICAL_OFFSET);
      }

      // iOS 13+ gates DeviceOrientationEvent behind requestPermission(),
      // which itself requires a user gesture — the spec is explicit that
      // this must not be requested on load, and skipping outright (rather
      // than adding a tap-to-enable affordance) is the deliberate choice
      // over building UI for it. Untested on a real device either way — no
      // browser in this environment.
      const orientationGated =
        typeof window !== "undefined" &&
        typeof (
          window.DeviceOrientationEvent as unknown as { requestPermission?: unknown }
        )?.requestPermission === "function";
      const orientationAvailable =
        typeof window !== "undefined" &&
        "DeviceOrientationEvent" in window &&
        !orientationGated;

      let orientationBaseline: { beta: number; gamma: number } | null = null;
      function handleDeviceOrientation(e: DeviceOrientationEvent) {
        if (e.beta === null || e.gamma === null) return;
        if (!orientationBaseline) {
          orientationBaseline = { beta: e.beta, gamma: e.gamma };
        }
        const deltaGamma = e.gamma - orientationBaseline.gamma;
        const deltaBeta = e.beta - orientationBaseline.beta;
        const nx = Math.max(-1, Math.min(1, deltaGamma / 30));
        const ny = Math.max(-1, Math.min(1, deltaBeta / 30));
        yawTo(nx * MAX_YAW * MOBILE_ORBIT_AMPLITUDE);
        offsetTo(ny * MAX_VERTICAL_OFFSET * MOBILE_ORBIT_AMPLITUDE);
      }

      if (pointerFine) {
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
      } else if (orientationAvailable) {
        window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
      }
      // Neither available: orbitState stays at its rest value (0, 0) —
      // the figure sits static, idle drift (baked into figure.vert.glsl,
      // driven by uTime alone) and dissolve still run. Spec point 9.

      gsapCleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("deviceorientation", handleDeviceOrientation);
        gsap.killTweensOf(orbitState);
      };
    });

    let rafId: number | null = null;
    let running = false;
    let firstFrameRendered = false;
    const startTime = performance.now();

    function renderFrame() {
      if (!gl) return;
      const elapsed = (performance.now() - startTime) / 1000;

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, rtWidth, rtHeight);
      gl.disable(gl.BLEND);
      gl.useProgram(fogProgram);
      gl.uniform1f(fogUniforms.uTime, elapsed);
      gl.uniform1f(fogUniforms.uIntensity, 1);
      gl.bindVertexArray(fogVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!canvas) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rtTexture);
      gl.uniform1i(blitUniforms.uTexture, 0);
      gl.bindVertexArray(blitVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive, composites over the blit

      // Shared by figure + embers so they orbit/parallax identically —
      // computed once per frame rather than twice.
      const viewMatrix = buildOrbitView(CAMERA_DISTANCE, orbitState.yaw, orbitState.offset);

      // Figure BEFORE embers — embers must read as floating in front of it.
      if (figureReady && figureColorTexture) {
        gl.useProgram(figureProgram);
        gl.uniform1f(figureUniforms.uTime, elapsed);
        gl.uniform1f(figureUniforms.uDissolve, dissolveState.value);
        gl.uniformMatrix4fv(figureUniforms.uView, false, viewMatrix);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, figureColorTexture);
        gl.bindVertexArray(figureVao);
        gl.drawArrays(gl.POINTS, 0, config.figurePointCount);
      }

      if (embersReady) {
        gl.useProgram(emberProgram);
        gl.uniform1f(emberUniforms.uTime, elapsed);
        gl.uniformMatrix4fv(emberUniforms.uView, false, viewMatrix);
        gl.bindVertexArray(emberVao);
        gl.drawArrays(gl.POINTS, 0, config.emberCount);
      }

      if (!firstFrameRendered) {
        firstFrameRendered = true;
        // Cross-fade in on the first real frame, not on mount — mounting
        // the canvas and having something worth looking at in it aren't
        // the same moment.
        requestAnimationFrame(() => {
          if (!canvas) return;
          canvas.style.transitionDuration = `${dur.slow}s`;
          canvas.style.transitionTimingFunction = gsapEase.out;
          canvas.style.opacity = "1";
        });
      }
    }

    function loop() {
      if (!running) return;
      renderFrame();
      rafId = requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Single source of truth for "is the hero actually in view" — the
    // visibilitychange handler below needs to read this without waiting
    // for the observer to re-fire (it only fires on intersection-ratio
    // changes, not on tab visibility changes).
    let isIntersecting = false;

    // Same observer instance drives both start/stop AND uDissolve — no
    // second observer, no ScrollTrigger, no Lenis dependency. A dense
    // threshold array (every 5%) makes intersectionRatio fire often enough
    // to read as continuous scrubbing rather than 21 visible steps; the
    // browser's own compositor does the actual interpolation between
    // fires, same as native scroll-linked CSS.
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting && !document.hidden) start();
        else stop();

        // 1 - ratio: fully in view (ratio 1) -> uDissolve 0; fully
        // scrolled past (ratio 0) -> uDissolve 1. Identical on every
        // device — no 768px gate, no viewport-resize scroll jank.
        dissolveState.value = 1 - entry.intersectionRatio;
      },
      { threshold: INTERSECTION_DISSOLVE_THRESHOLDS },
    );
    intersectionObserver.observe(canvas);

    function handleVisibilityChange() {
      if (document.hidden) stop();
      else if (isIntersecting) start();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      texturesCancelled = true;
      gsapCancelled = true;
      gsapCleanup?.();

      gl.deleteProgram(fogProgram);
      gl.deleteProgram(blitProgram);
      gl.deleteProgram(emberProgram);
      gl.deleteProgram(figureProgram);
      gl.deleteBuffer(triangleBuffer);
      if (emberBaseBuffer) gl.deleteBuffer(emberBaseBuffer);
      gl.deleteBuffer(emberRandomBuffer);
      gl.deleteVertexArray(fogVao);
      gl.deleteVertexArray(blitVao);
      gl.deleteVertexArray(emberVao);
      gl.deleteVertexArray(figureVao);
      gl.deleteTexture(rtTexture);
      if (figureColorTexture) gl.deleteTexture(figureColorTexture);
      gl.deleteFramebuffer(framebuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-0 transition-opacity"
    />
  );
}
