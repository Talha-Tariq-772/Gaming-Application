/**
 * Minimal raw-WebGL2 helpers for NovaCanvas.tsx — replaces the three.js
 * usage from the first pass. Measured at ~185.7kb gzip against a 120kb
 * budget (NOVA_DESIGN_SPEC.md #6); named imports didn't help (WebGLRenderer
 * is too internally interconnected across three.js's module graph for
 * tree-shaking to strip the ~90% actually unused here — this component
 * never touches a scene graph, materials system, or lights). The actual
 * GPU work is 3 draw calls, which raw WebGL2 does directly with no
 * abstraction layer.
 *
 * The fog/blit/ember shader sources (shaders/*.ts) are untouched from the
 * three.js pass — they're plain GLSL ES 1.00 (no #version pragma), which a
 * WebGL2 context compiles natively without any compatibility shim.
 */

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

/** Prepends an OCTAVES #define — the fog shader's own
 * `#ifndef OCTAVES / #define OCTAVES 5 / #endif` guard means whatever's
 * defined first wins, so this is the same mechanism three.js's
 * `defines` option provided, just done by hand. */
export function withOctaves(fragmentSource: string, octaves: number): string {
  return `#define OCTAVES ${octaves}\n${fragmentSource}`;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  // Shaders are flagged for deletion once detached from the program (which
  // happens implicitly when the program itself is deleted) — no need to
  // hold onto these references for cleanup.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(gl);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

/** Clip-space positions for one triangle covering the whole viewport —
 * extends past [-1, 1] on two vertices, so it's one fewer vertex than a
 * quad and has no diagonal seam. */
export const FULLSCREEN_TRIANGLE_POSITIONS = new Float32Array([-1, -1, 3, -1, -1, 3]);

export function createBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Failed to create buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

export function createEmberAttributeData(count: number): { positions: Float32Array; random: Float32Array } {
  const positions = new Float32Array(count * 2);
  const random = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 2 + 0] = Math.random() * 2 - 1;
    positions[i * 2 + 1] = Math.random() * 2 - 1;
    random[i * 3 + 0] = Math.random();
    random[i * 3 + 1] = Math.random();
    random[i * 3 + 2] = Math.random();
  }
  return { positions, random };
}

/**
 * Loads an image into a WebGLTexture — LINEAR filtering, CLAMP_TO_EDGE on
 * both axes, alpha not premultiplied, no Y flip (figure.ts's vertex shader
 * does `pos.y = 0.5 - uv.y` itself, so the raw texture-space V stays
 * un-flipped here).
 */
export function loadTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const texture = gl.createTexture();
      if (!texture) {
        reject(new Error("Failed to create texture"));
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      resolve(texture);
    };
    image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    image.src = url;
  });
}

/** Standard right-handed perspective projection (WebGL NDC z in [-1, 1]) —
 * the one matrix this needs that translate/rotateY genuinely can't build by
 * hand, so it's the one place this reaches for the textbook formula
 * (equivalent to gl-matrix's mat4.perspective) rather than composing it. */
export function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0,                     0,
    0,          f, 0,                     0,
    0,          0, (far + near) * nf,    -1,
    0,          0, 2 * far * near * nf,   0,
  ]);
}

function translationMat4(x: number, y: number, z: number): Float32Array {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function rotateYMat4(radians: number): Float32Array {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  // prettier-ignore
  return new Float32Array([
     c, 0, s, 0,
     0, 1, 0, 0,
    -s, 0, c, 0,
     0, 0, 0, 1,
  ]);
}

/** out = a * b (both column-major Float32Array(16), GL convention). */
function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * Hand-rolled orbit-camera view matrix — translate + rotateY composed by
 * hand rather than a general lookAt (no gl-matrix dependency, per
 * spec/PATH_A_POINT_CLOUD.md Session B point 2). Order matters: lift the
 * scene by -verticalOffset, then yaw it by -orbitYaw around Y, then push it
 * -distance away along Z — i.e. the camera sits at `distance` back from the
 * origin, orbiting horizontally and shifting vertically as its inputs move.
 */
export function buildOrbitView(distance: number, orbitYaw: number, verticalOffset: number): Float32Array {
  const push = translationMat4(0, 0, -distance);
  const yaw = rotateYMat4(-orbitYaw);
  const lift = translationMat4(0, -verticalOffset, 0);
  return multiplyMat4(push, multiplyMat4(yaw, lift));
}
