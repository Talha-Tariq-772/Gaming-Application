/**
 * Cheap, synchronous WebGL2-creation probe. A throwaway canvas that's
 * never attached to the DOM is enough to know if getContext() succeeds —
 * the whole point is finding this out before paying to download
 * NovaCanvas.tsx's chunk at all.
 *
 * Specifically WebGL2, not WebGL1 — NovaCanvas.tsx uses
 * createVertexArray(), a WebGL2-only API (WebGL1 only has it behind the
 * OES_vertex_array_object extension, which this doesn't check for). A
 * WebGL1-only device would pass a "webgl" probe but then fail inside
 * NovaCanvas — better to know that here and keep the poster.
 */
export function canCreateWebGLContext(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
