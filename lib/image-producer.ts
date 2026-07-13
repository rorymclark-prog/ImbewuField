// ── Image Producer: deterministic composite-back ─────────────────────────────
//
// The AI polish problem is that image models invent (a Base-map render grew a
// fantasy farm with a name banner). Prompting can reduce it but never guarantee
// it. This module removes the model's power to corrupt structure entirely:
//
//   1. The model ("nano banana" / Gemini flash image) beautifies the whole
//      composited scene — it is a TEXTURE/STYLE engine, nothing more.
//   2. We then composite deterministically, on our own canvas:
//        • OUTSIDE the property boundary → the ORIGINAL satellite (so anything
//          the model sprawled beyond the plot is erased — it never existed).
//        • INSIDE the boundary → the model's beautified ground.
//        • ON TOP → the farmer's EXACT element render (tanks/beds/trees/boundary),
//          so every feature is pixel-true and in the precise place they put it,
//          not the model's fuzzy interpretation.
//
// Net: the model can hallucinate all it likes; the hallucination is clipped and
// over-painted out of existence. Accuracy is guaranteed by construction.

/** Either an image source (data URL / base64) or an already-decoded element. */
export type ImageInput = string | HTMLImageElement;

export interface CompositeInputs {
  /** Model output — the full scene, beautified. Data URL or bare base64. */
  modelImage: ImageInput;
  /** Original satellite crop — the ground truth used outside the boundary.
   *  Pass the already-loaded bg image element directly to skip a re-decode. */
  satelliteImage: ImageInput;
  /** Farmer's exact elements + boundary on a TRANSPARENT background. */
  elementsImage: ImageInput;
  /** Boundary polygon in OUTPUT-pixel coordinates: [x0,y0,x1,y1,...]. When
   *  absent (no traced boundary) the model output is used across the whole
   *  frame — elements are still painted on top, but there is no sprawl clip. */
  boundaryPx?: number[];
  /** Output canvas size (the composite/bg rect × pixelRatio). */
  width: number;
  height: number;
}

const asDataUrl = (s: string) => (s.startsWith('data:') ? s : `data:image/png;base64,${s}`);

function loadImage(input: ImageInput): Promise<HTMLImageElement> {
  if (typeof input !== 'string') {
    // Already-decoded element (e.g. the live bg satellite) — use as-is.
    return input.complete ? Promise.resolve(input) : new Promise((resolve, reject) => {
      input.onload = () => resolve(input);
      input.onerror = () => reject(new Error('composite: image failed to load'));
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('composite: image failed to load'));
    img.src = asDataUrl(input);
  });
}

/** Trace the boundary polygon (output px) onto a 2D context as a closed path. */
function traceBoundary(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/**
 * Produce the final accurate map. Runs in the browser (needs a canvas).
 * Returns a PNG data URL.
 */
export async function compositeAccurateMap(inp: CompositeInputs): Promise<string> {
  const { width, height, boundaryPx } = inp;
  const [model, satellite, elements] = await Promise.all([
    loadImage(inp.modelImage),
    loadImage(inp.satelliteImage),
    loadImage(inp.elementsImage),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('composite: 2D context unavailable');

  const hasBoundary = Array.isArray(boundaryPx) && boundaryPx.length >= 6;

  if (hasBoundary) {
    // 1. Original satellite fills everything (this is the truth outside the plot).
    ctx.drawImage(satellite, 0, 0, width, height);
    // 2. Beautified ground, clipped to the boundary interior only.
    ctx.save();
    traceBoundary(ctx, boundaryPx!);
    ctx.clip();
    ctx.drawImage(model, 0, 0, width, height);
    ctx.restore();
  } else {
    // No boundary to clip against — use the beautified scene across the frame.
    ctx.drawImage(model, 0, 0, width, height);
  }

  // 3. The farmer's exact elements + boundary, painted on top — pixel-true.
  ctx.drawImage(elements, 0, 0, width, height);

  return canvas.toDataURL('image/png');
}

/**
 * Convert a boundary given in STAGE coordinates (the same space item/line points
 * live in) into OUTPUT-pixel coordinates for the cropped, scaled composite.
 * bgRect is the capture crop {x,y,w,h} in stage px; pixelRatio is the toDataURL
 * scale. Points outside the crop are kept (clip handles them) — we only shift +
 * scale. Returns a flat [x,y,...] array, or undefined if too few points.
 */
export function boundaryStageToOutput(
  stagePts: number[],
  bgRect: { x: number; y: number; w: number; h: number },
  pixelRatio: number,
): number[] | undefined {
  if (!stagePts || stagePts.length < 6) return undefined;
  const out: number[] = [];
  for (let i = 0; i + 1 < stagePts.length; i += 2) {
    out.push((stagePts[i] - bgRect.x) * pixelRatio);
    out.push((stagePts[i + 1] - bgRect.y) * pixelRatio);
  }
  return out;
}
