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

/** A true, in-frame label to burn onto the produced map. All coords are OUTPUT px. */
export interface ProducerLabel {
  cx: number; cy: number; // leader start — the element's TRUE position
  ax: number; ay: number; // pill anchor (top-left-ish, already clamped in-frame)
  lx: number;             // leader END x — the pill's INNER edge (so it meets the pill cleanly)
  text: string;           // e.g. "🥬 Veg bed ×6"
}

export type LabelStyle = 'ink' | 'storybook' | 'blueprint' | 'folk' | 'clean';

export interface CompositeInputs {
  /** Model output — the whole scene beautified, elements illustrated in place. */
  modelImage: ImageInput;
  /** Original satellite crop — the ground truth used OUTSIDE the boundary. */
  satelliteImage: ImageInput;
  /** Boundary polygon in OUTPUT-pixel coordinates: [x0,y0,x1,y1,...]. Clips the
   *  model to the plot interior (erasing sprawl) and is stroked crisp on top. */
  boundaryPx?: number[];
  /** True labels burned in-frame — hybrid-c: the model illustrates the element
   *  bodies, we guarantee identity + position with these. */
  labels?: ProducerLabel[];
  /** Crisp boundary stroke colour (default tan). */
  boundaryColor?: string;
  /** Label pill/type styling, matched to the chosen art style. */
  labelStyle?: LabelStyle;
  /** Output canvas size (the composite/bg rect × pixelRatio). */
  width: number;
  height: number;
}

const LABEL_STYLES: Record<LabelStyle, { pill: string; stroke: string; text: string; font: string }> = {
  ink:       { pill: '#FBF6EC', stroke: '#3A2E1A', text: '#20190F', font: 'Georgia, serif' },
  storybook: { pill: '#FBF6EC', stroke: '#1F4D2B', text: '#20190F', font: 'system-ui, sans-serif' },
  blueprint: { pill: '#EEF3F5', stroke: '#3E5A68', text: '#1A2A33', font: 'system-ui, sans-serif' },
  folk:      { pill: '#FFF3D6', stroke: '#8A2A14', text: '#20190F', font: 'system-ui, sans-serif' },
  clean:     { pill: '#FBF6EC', stroke: '#1F4D2B', text: '#20190F', font: 'system-ui, sans-serif' },
};

/** Burn the true labels onto the produced map: leader line + anchor dot + pill. */
function burnLabels(ctx: CanvasRenderingContext2D, labels: ProducerLabel[], style: LabelStyle): void {
  const s = LABEL_STYLES[style] ?? LABEL_STYLES.clean;
  const fs = 26, padX = 14, h = fs + 14;
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fs}px ${s.font}`;
  for (const l of labels) {
    // Leader — dark under-stroke + light over-stroke reads on any background.
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(l.lx, l.ay);
    ctx.strokeStyle = 'rgba(20,16,10,0.35)'; ctx.lineWidth = 5; ctx.setLineDash([]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(l.lx, l.ay);
    ctx.strokeStyle = '#FBF6EC'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke();
    ctx.setLineDash([]);
    // Anchor dot at the true position.
    ctx.beginPath(); ctx.arc(l.cx, l.cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FBF6EC'; ctx.fill(); ctx.strokeStyle = s.stroke; ctx.lineWidth = 2; ctx.stroke();
    // Pill.
    const w = padX * 2 + ctx.measureText(l.text).width;
    const x = l.ax, y = l.ay - h / 2, r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = s.pill; ctx.shadowColor = 'rgba(20,16,10,0.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = s.stroke; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = s.text; ctx.fillText(l.text, x + padX, l.ay + 1);
  }
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

/**
 * Safety net against the model "blanking" a sparse plot to white. Redraw the
 * model onto its own canvas and turn near-pure-white pixels transparent, so the
 * real satellite drawn underneath shows through anywhere the model left blank.
 * A good rich illustration has almost no pure-white, so this is a no-op there;
 * it only rescues the failure case (a plot painted plain white). Conservative
 * threshold (>248 on all channels) leaves cream/beige paper backgrounds intact.
 */
function knockOutNearWhite(src: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const cx = c.getContext('2d');
  if (!cx) return c;
  cx.drawImage(src, 0, 0, width, height);
  try {
    const img = cx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248) d[i + 3] = 0;
    }
    cx.putImageData(img, 0, 0);
  } catch {
    // Tainted canvas (should not happen — inputs are same-origin data URLs).
    // Fall back to the untouched model rather than throwing.
  }
  return c;
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
  const [model, satellite] = await Promise.all([
    loadImage(inp.modelImage),
    loadImage(inp.satelliteImage),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('composite: 2D context unavailable');

  const hasBoundary = Array.isArray(boundaryPx) && boundaryPx.length >= 6;
  // The model, minus any pure-white blanking — so the satellite shows through
  // instead of a blank plot (see knockOutNearWhite).
  const modelLayer = knockOutNearWhite(model, width, height);

  if (hasBoundary) {
    // 1. Original satellite fills everything (truth outside the plot, and the
    //    fallback anywhere the model blanked to white inside).
    ctx.drawImage(satellite, 0, 0, width, height);
    // 2. Beautified scene (elements illustrated by the model), clipped to the
    //    boundary interior — anything the model sprawled outside is erased.
    ctx.save();
    traceBoundary(ctx, boundaryPx!);
    ctx.clip();
    ctx.drawImage(modelLayer, 0, 0, width, height);
    ctx.restore();
    // 3. Crisp boundary — the single highest-contrast line on the map.
    traceBoundary(ctx, boundaryPx!);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,16,10,0.5)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = inp.boundaryColor ?? '#C2A878'; ctx.lineWidth = 4; ctx.stroke();
  } else {
    // No boundary traced — satellite as the base first (so a model that returns a
    // partial/transparent/blank frame can never leave the map blank), then the model.
    ctx.drawImage(satellite, 0, 0, width, height);
    ctx.drawImage(modelLayer, 0, 0, width, height);
  }

  // 4. True labels burned in-frame — hybrid-c identity + position guarantee.
  if (inp.labels && inp.labels.length) burnLabels(ctx, inp.labels, inp.labelStyle ?? 'clean');

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
