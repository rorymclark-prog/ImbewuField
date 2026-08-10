/**
 * Extract a canvas's data URL and release its backing store immediately.
 *
 * WHY THIS EXISTS. Safari — and iOS Safari with real force — keeps a canvas's pixel buffer alive
 * until garbage collection, and iOS enforces a hard per-page canvas memory budget (~384 MB on the
 * devices this app is actually used on). The sheet pipeline is a parade of full-resolution
 * canvases: the exact page, the label layer, the AI composite, the protect mask, the capped upload
 * copies. Each is used once, converted to a data URL, and dropped — but "dropped" only frees the
 * JS wrapper. The multi-megabyte pixel buffer lingers until GC, and a dozen lingering buffers is
 * enough to blow the iOS budget mid-flow. WebKit then kills and silently reloads the page, which
 * the farmer experiences as the app throwing them back to the start ("Ai button always crashes
 * the app now" / "It goes back to the design screen").
 *
 * Setting a canvas's dimensions to 0 releases the backing store SYNCHRONOUSLY — the documented
 * escape hatch for exactly this WebKit behaviour. This helper pairs the extraction with the
 * release so no call site can do one and forget the other.
 *
 * ONLY for canvases that are finished. A canvas drained here has no pixels left — any later draw
 * or read from it is a bug, which is why the helper exists instead of two lines at each call site:
 * the pattern is greppable, and the name says the canvas is done.
 */
interface DrainableCanvas {
  width: number;
  height: number;
  toDataURL(type?: string, quality?: number): string;
}

export function drainCanvasToDataUrl(canvas: DrainableCanvas, type?: string, quality?: number): string {
  const url = canvas.toDataURL(type, quality);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

/**
 * Release a finished canvas whose pixels left through getImageData rather than toDataURL.
 *
 * The pixel-comparison paths (measureRenderDifference, restoreProtectedPixels) extract raw RGBA
 * bytes and never need a data URL, so drainCanvasToDataUrl would pay for a PNG encode nobody
 * reads. Same contract as the drain: the canvas is DONE — any later draw or read is a bug.
 */
export function releaseCanvas(canvas: Pick<DrainableCanvas, 'width' | 'height'>): void {
  canvas.width = 0;
  canvas.height = 0;
}
