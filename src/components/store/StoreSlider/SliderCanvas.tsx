"use client";

import { useEffect, useRef } from "react";
import {
  createBuffer,
  createProgram,
  FULLSCREEN_TRIANGLE_POSITIONS,
} from "@/src/components/hero/Nova/webgl-helpers";
import { dissolveFragmentShader, dissolveVertexShader } from "./shaders";

const TRANSITION_MS = 900;

interface TextureEntry {
  texture: WebGLTexture;
  /** naturalWidth / naturalHeight — needed for the cover-fit UV transform. */
  aspect: number;
}

/**
 * Not webgl-helpers.ts's loadTexture(): that one doesn't return the image's
 * natural size (needed for cover-fit UV math below) or expose a way to set
 * fetchPriority on the underlying Image (needed for the LCP slide). Same
 * upload steps otherwise — flip Y true here since this shader's UV origin
 * is the standard top-left, unlike NovaCanvas's figure shader which flips
 * in the vertex stage instead.
 */
function loadSlideTexture(gl: WebGL2RenderingContext, url: string, eager: boolean): Promise<TextureEntry> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Must be set before `src` — Supabase Storage's public endpoint returns
    // Access-Control-Allow-Origin: *, but the browser only honors that on
    // the request it was present for. Setting this after `src` leaves the
    // fetch already in flight as a no-cors/tainted load, and texImage2D
    // below throws a SecurityError on the resulting canvas.
    image.crossOrigin = "anonymous";
    if (eager) image.fetchPriority = "high";
    image.onload = () => {
      const texture = gl.createTexture();
      if (!texture) {
        reject(new Error("Failed to create texture"));
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      resolve({ texture, aspect: image.naturalWidth / image.naturalHeight });
    };
    image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    image.src = url;
  });
}

function computeCoverTransform(
  canvasAspect: number,
  texAspect: number,
): { scale: [number, number]; offset: [number, number] } {
  if (canvasAspect > texAspect) {
    const scaleY = texAspect / canvasAspect;
    return { scale: [1, scaleY], offset: [0, (1 - scaleY) / 2] };
  }
  const scaleX = canvasAspect / texAspect;
  return { scale: [scaleX, 1], offset: [(1 - scaleX) / 2, 0] };
}

/**
 * Renders one slide at a time, dissolving to the next whenever `activeIndex`
 * changes. Deliberately takes `activeIndex` as a plain prop read through a
 * ref inside the render loop, rather than as an effect dependency — this
 * keeps the same GL context/program/textures alive across every slide
 * change instead of tearing everything down and reloading textures on each
 * advance.
 */
export default function SliderCanvas({
  urls,
  activeIndex,
  onError,
}: {
  /** One URL per slide, largest derivative — index-aligned with StoreSlider's slide list. */
  urls: string[];
  activeIndex: number;
  /** Called once, at most, the first time any slide's texture fails to
   * load — signals the parent to swap to the CSS crossfade path instead of
   * leaving this canvas rendering nothing (or a stale slide) forever. */
  onError?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
      depth: false,
      stencil: false,
    });
    if (!gl) return;

    const program = createProgram(gl, dissolveVertexShader, dissolveFragmentShader);
    const uniforms = {
      uCurrent: gl.getUniformLocation(program, "uCurrent"),
      uNext: gl.getUniformLocation(program, "uNext"),
      uProgress: gl.getUniformLocation(program, "uProgress"),
      uCurrentUvScale: gl.getUniformLocation(program, "uCurrentUvScale"),
      uCurrentUvOffset: gl.getUniformLocation(program, "uCurrentUvOffset"),
      uNextUvScale: gl.getUniformLocation(program, "uNextUvScale"),
      uNextUvOffset: gl.getUniformLocation(program, "uNextUvOffset"),
    };
    const positionLoc = gl.getAttribLocation(program, "position");
    const buffer = createBuffer(gl, FULLSCREEN_TRIANGLE_POSITIONS);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.useProgram(program);
    gl.uniform1i(uniforms.uCurrent, 0);
    gl.uniform1i(uniforms.uNext, 1);

    const textures = new Map<number, TextureEntry>();
    const pending = new Set<number>();
    let cancelled = false;
    let errored = false;

    // First slide loads eager/high-priority (it's the LCP element on first
    // paint, before this canvas even exists — see StoreSlider.tsx's
    // fallback <img>). Second slide prefetches. The rest load only once
    // `activeIndex` actually reaches them, inside render() below.
    function loadIndex(index: number, eager: boolean) {
      if (textures.has(index) || pending.has(index) || !urls[index]) return;
      pending.add(index);
      loadSlideTexture(gl!, urls[index], eager)
        .then((entry) => {
          if (cancelled) return;
          textures.set(index, entry);
          pending.delete(index);
        })
        .catch((err) => {
          pending.delete(index);
          console.error("StoreSlider: texture load failed", err);
          // A Storage hiccup shouldn't leave the slider as a black box with
          // text floating on it — hand off to the CSS crossfade path
          // instead. Once per mount: the parent unmounts this component
          // when it switches, so there's nothing left to guard afterward.
          if (!errored && !cancelled) {
            errored = true;
            onErrorRef.current?.();
          }
        });
    }

    loadIndex(0, true);
    if (urls.length > 1) loadIndex(1, false);

    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let fromIndex = activeIndexRef.current;
    let toIndex = activeIndexRef.current;
    let transitionStart: number | null = null;
    let rafId = 0;

    function render(time: number) {
      rafId = requestAnimationFrame(render);
      if (!gl || !canvas) return;

      const wantIndex = activeIndexRef.current;
      if (wantIndex !== toIndex) {
        fromIndex = toIndex;
        toIndex = wantIndex;
        transitionStart = time;
        loadIndex(wantIndex, false);
        // Stay one slide ahead of wherever the visitor currently is, so
        // the *next* advance never stalls on a cold fetch either.
        loadIndex((wantIndex + 1) % urls.length, false);
      }

      const currentEntry = textures.get(fromIndex);
      if (!currentEntry) return; // nothing loaded yet — draw nothing rather than garbage
      const nextEntry = textures.get(toIndex) ?? currentEntry;

      const progress =
        fromIndex === toIndex || transitionStart === null
          ? 0
          : Math.min(1, (time - transitionStart) / TRANSITION_MS);

      const canvasAspect = canvas.width / canvas.height;
      const cur = computeCoverTransform(canvasAspect, currentEntry.aspect);
      const nxt = computeCoverTransform(canvasAspect, nextEntry.aspect);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentEntry.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, nextEntry.texture);

      gl.useProgram(program);
      gl.uniform1f(uniforms.uProgress, progress);
      gl.uniform2f(uniforms.uCurrentUvScale, cur.scale[0], cur.scale[1]);
      gl.uniform2f(uniforms.uCurrentUvOffset, cur.offset[0], cur.offset[1]);
      gl.uniform2f(uniforms.uNextUvScale, nxt.scale[0], nxt.scale[1]);
      gl.uniform2f(uniforms.uNextUvOffset, nxt.offset[0], nxt.offset[1]);

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      textures.forEach((entry) => gl.deleteTexture(entry.texture));
    };
    // Intentionally just `urls` — activeIndex changes are read via the ref
    // above, not re-run through this whole GL setup.
  }, [urls]);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
