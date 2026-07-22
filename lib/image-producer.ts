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
  text: string;           // e.g. "🥬 VEG BED ×6"
  /** 'header' = a CAPS group title ("SOUTHERN TREES") standing over its members; rendered
   *  bolder so the hierarchy reads. Absent/undefined = 'item' — back-compat for callers
   *  (FacilitatorCanvas) that emit plain one-pill-per-element labels. */
  kind?: 'header' | 'item';
  /** false = draw the pill ONLY (no leader line, no anchor dot). Members listed under a header
   *  don't get a leader of their own: the header's single leader speaks for the whole group.
   *  Suppressing them is also what preserves the layout's no-crossing-leaders guarantee — see
   *  producerLabels in components/design/DesignGlossy.tsx. Absent/undefined = true. */
  leader?: boolean;
}

export type LabelStyle = 'ink' | 'storybook' | 'blueprint' | 'reference' | 'folk' | 'clean';

export interface CompositeInputs {
  /** Model output — the whole scene beautified, elements illustrated in place. */
  modelImage: ImageInput;
  /** Original satellite crop — the ground truth used OUTSIDE the boundary. */
  satelliteImage: ImageInput;
  /** Boundary polygon in OUTPUT-pixel coordinates: [x0,y0,x1,y1,...]. Clips the
   *  model to the plot interior (erasing sprawl) and is stroked crisp on top. */
  boundaryPx?: number[];
  /** Exact transparent overlay (e.g. the sector-wedge sticker) drawn UNCLIPPED
   *  over the model — pixel-true content the AI never gets to repaint. */
  overlayImage?: ImageInput;
  /** True labels burned in-frame — hybrid-c: the model illustrates the element
   *  bodies, we guarantee identity + position with these. */
  labels?: ProducerLabel[];
  /** Crisp boundary stroke colour (default tan). */
  boundaryColor?: string;
  /** Label pill/type styling, matched to the chosen art style. */
  labelStyle?: LabelStyle;
  /** Optional deterministic treatment for factual satellite context outside the boundary. */
  contextTreatment?: 'original' | 'precision_atlas';
  /** Output canvas size (the composite/bg rect × pixelRatio). */
  width: number;
  height: number;
}

/**
 * Bring factual satellite context into the Precision Atlas palette without generating anything.
 * Geometry remains byte-for-byte aligned; only colour and contrast are changed.
 */
export function precisionAtlasContextPixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  if (pixels.length % 4 !== 0) throw new Error('context treatment: expected RGBA pixels');
  const out = new Uint8ClampedArray(pixels.length);
  const saturation = 0.82;
  const contrast = 0.96;
  const forestMix = 0.1;
  const warmMix = 0.025;
  const forest = [54, 78, 57] as const;
  const parchment = [226, 218, 194] as const;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const channels = [r, g, b];
    for (let channel = 0; channel < 3; channel++) {
      const desaturated = luma + (channels[channel] - luma) * saturation;
      const lifted = (desaturated - 128) * contrast + 134;
      out[i + channel] = Math.round(
        lifted * (1 - forestMix - warmMix)
        + forest[channel] * forestMix
        + parchment[channel] * warmMix,
      );
    }
    out[i + 3] = pixels[i + 3];
  }
  return out;
}

/**
 * Geometry Lock owns framing and cartographic chrome; free-form model chrome is rollback-only —
 * EXCEPT for a style that can only exist as model chrome. Satellite Overlay's legend swatches are
 * the same pictorial icons it draws on the map, which the deterministic legend (coloured dots)
 * cannot render, so that style has to win over both toggles.
 *
 * `alwaysModelChrome` stays a plain boolean so this module never imports the style union.
 */
export function shouldUseModelChrome(
  modelChrome: boolean,
  geometryLock: boolean,
  alwaysModelChrome = false,
): boolean {
  return alwaysModelChrome || (modelChrome && !geometryLock);
}

const LABEL_STYLES: Record<LabelStyle, { pill: string; stroke: string; text: string; font: string }> = {
  ink:       { pill: '#FBF6EC', stroke: '#3A2E1A', text: '#20190F', font: 'Georgia, serif' },
  storybook: { pill: '#FBF6EC', stroke: '#1F4D2B', text: '#20190F', font: 'system-ui, sans-serif' },
  blueprint: { pill: '#EEF3F5', stroke: '#3E5A68', text: '#1A2A33', font: 'system-ui, sans-serif' },
  reference: { pill: '#F5F0DF', stroke: '#24362E', text: '#F5F0DF', font: '"Arial Narrow", "Avenir Next Condensed", "Roboto Condensed", sans-serif' },
  folk:      { pill: '#FFF3D6', stroke: '#8A2A14', text: '#20190F', font: 'system-ui, sans-serif' },
  clean:     { pill: '#FBF6EC', stroke: '#1F4D2B', text: '#20190F', font: 'system-ui, sans-serif' },
};

/** Match the benchmark's compact map lettering without covering the artwork with UI capsules. */
function burnReferenceLabels(ctx: CanvasRenderingContext2D, labels: ProducerLabel[]): void {
  const width = ctx.canvas.width;
  const fs = Math.max(17, Math.round(width * 0.0105));
  ctx.textBaseline = 'middle';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  for (const label of labels) {
    const isHeader = label.kind === 'header';
    const weight = isHeader ? 800 : 650;
    ctx.font = `${weight} ${fs}px ${LABEL_STYLES.reference.font}`;
    const textWidth = ctx.measureText(label.text).width;
    const onLeft = label.ax < width / 2;
    const textX = onLeft ? Math.max(20, width * 0.012) : Math.min(width - 20, width * 0.988);
    const align: CanvasTextAlign = onLeft ? 'left' : 'right';
    const leaderEndX = onLeft
      ? textX + textWidth + fs * 0.35
      : textX - textWidth - fs * 0.35;

    if (label.leader !== false) {
      const elbowX = onLeft
        ? Math.min(label.cx - fs * 0.6, leaderEndX + width * 0.018)
        : Math.max(label.cx + fs * 0.6, leaderEndX - width * 0.018);
      ctx.beginPath();
      ctx.moveTo(label.cx, label.cy);
      ctx.lineTo(elbowX, label.cy);
      ctx.lineTo(leaderEndX, label.ay);
      ctx.strokeStyle = 'rgba(14,20,16,0.78)';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(label.cx, label.cy);
      ctx.lineTo(elbowX, label.cy);
      ctx.lineTo(leaderEndX, label.ay);
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(label.cx, label.cy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#24362E';
      ctx.fill();
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    ctx.textAlign = align;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(14,20,16,0.9)';
    ctx.lineWidth = Math.max(3.5, fs * 0.22);
    ctx.strokeText(label.text, textX, label.ay + 1);
    ctx.fillStyle = '#F5F0DF';
    ctx.fillText(label.text, textX, label.ay + 1);
    ctx.restore();
  }
}

/** Burn the true labels onto the produced map: leader line + anchor dot + pill. */
function burnLabels(ctx: CanvasRenderingContext2D, labels: ProducerLabel[], style: LabelStyle): void {
  if (style === 'reference') {
    burnReferenceLabels(ctx, labels);
    return;
  }
  const s = LABEL_STYLES[style] ?? LABEL_STYLES.clean;
  const fs = style === 'blueprint' ? 28 : 26;
  const padX = style === 'blueprint' ? 16 : 14;
  const h = fs + (style === 'blueprint' ? 16 : 14);
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    // Headers are group titles standing over their members — heavier weight + a firmer pill edge
    // so the hierarchy reads at a glance. Set per-label because measureText below depends on it.
    const isHeader = l.kind === 'header';
    ctx.font = `${isHeader ? 800 : 600} ${fs}px ${s.font}`;
    if (l.leader !== false) {
      // Leader — dark under-stroke + light over-stroke reads on any background.
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(l.lx, l.ay);
      ctx.strokeStyle = 'rgba(20,16,10,0.55)'; ctx.lineWidth = style === 'blueprint' ? 7 : 5; ctx.setLineDash([]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(l.lx, l.ay);
      ctx.strokeStyle = '#FBF6EC'; ctx.lineWidth = style === 'blueprint' ? 3 : 2; ctx.setLineDash([8, 6]); ctx.stroke();
      ctx.setLineDash([]);
      // Anchor dot at the true position.
      ctx.beginPath(); ctx.arc(l.cx, l.cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FBF6EC'; ctx.fill(); ctx.strokeStyle = s.stroke; ctx.lineWidth = 2; ctx.stroke();
    }
    // Pill.
    const w = padX * 2 + ctx.measureText(l.text).width;
    const x = l.ax, y = l.ay - h / 2, r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = s.pill; ctx.shadowColor = 'rgba(20,16,10,0.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = s.stroke; ctx.lineWidth = isHeader ? 2.5 : 1.5; ctx.stroke();
    if (style === 'blueprint') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(l.text, x + padX, l.ay + 1);
    }
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
 * Merge a model output with its original source pixels using an RGBA mask.
 *
 * Mask alpha = 0 means "keep the model pixel"; alpha = 255 means "restore the
 * original source pixel". Partial alpha blends proportionally so anti-aliased
 * edges stay soft.
 */
export function blendProtectedPixels(
  sourcePixels: Uint8ClampedArray,
  modelPixels: Uint8ClampedArray,
  maskPixels: Uint8ClampedArray,
): Uint8ClampedArray {
  if (sourcePixels.length !== modelPixels.length || modelPixels.length !== maskPixels.length) {
    throw new Error('restore: image buffers must have the same size');
  }

  const out = new Uint8ClampedArray(modelPixels.length);
  for (let i = 0; i < modelPixels.length; i += 4) {
    const alpha = Math.max(0, Math.min(1, (maskPixels[i + 3] ?? 0) / 255));
    if (alpha <= 0) {
      out[i] = modelPixels[i];
      out[i + 1] = modelPixels[i + 1];
      out[i + 2] = modelPixels[i + 2];
      out[i + 3] = modelPixels[i + 3];
      continue;
    }
    if (alpha >= 1) {
      out[i] = sourcePixels[i];
      out[i + 1] = sourcePixels[i + 1];
      out[i + 2] = sourcePixels[i + 2];
      out[i + 3] = sourcePixels[i + 3];
      continue;
    }
    out[i] = Math.round(sourcePixels[i] * alpha + modelPixels[i] * (1 - alpha));
    out[i + 1] = Math.round(sourcePixels[i + 1] * alpha + modelPixels[i + 1] * (1 - alpha));
    out[i + 2] = Math.round(sourcePixels[i + 2] * alpha + modelPixels[i + 2] * (1 - alpha));
    out[i + 3] = Math.round(sourcePixels[i + 3] * alpha + modelPixels[i + 3] * (1 - alpha));
  }
  return out;
}

/**
 * Fraction of the mask the model is actually allowed to repaint (alpha < 255).
 *
 * Geometry Lock always leaves at least the plot interior editable, so a fully opaque mask is
 * degenerate: it means "restore every pixel", which silently throws the whole render away and
 * hands the farmer back the untouched satellite composite. Callers use this to tell a real
 * mask apart from a broken one instead of failing invisibly.
 */
export function maskEditableFraction(maskPixels: Uint8ClampedArray): number {
  let editable = 0;
  let total = 0;
  for (let i = 0; i < maskPixels.length; i += 4) {
    total += 1;
    if ((maskPixels[i + 3] ?? 0) < 255) editable += 1;
  }
  return total === 0 ? 0 : editable / total;
}

/**
 * Count fully protected pixels that do not exactly match the source.
 *
 * Geometry Lock is a hard contract, so opaque mask pixels are compared byte-for-byte rather
 * than with a visual tolerance. Partially transparent edge pixels are intentionally excluded:
 * they are feathered blends, not locked source pixels.
 */
export function countProtectedPixelMismatches(
  sourcePixels: Uint8ClampedArray,
  outputPixels: Uint8ClampedArray,
  maskPixels: Uint8ClampedArray,
): number {
  if (sourcePixels.length !== outputPixels.length || outputPixels.length !== maskPixels.length) {
    throw new Error('restore verification: image buffers must have the same size');
  }

  let mismatches = 0;
  for (let i = 0; i < outputPixels.length; i += 4) {
    if ((maskPixels[i + 3] ?? 0) < 255) continue;
    if (
      sourcePixels[i] !== outputPixels[i]
      || sourcePixels[i + 1] !== outputPixels[i + 1]
      || sourcePixels[i + 2] !== outputPixels[i + 2]
      || sourcePixels[i + 3] !== outputPixels[i + 3]
    ) {
      mismatches += 1;
    }
  }
  return mismatches;
}

/** Restore source pixels wherever the mask is opaque, then return a PNG data URL. */
export async function restoreProtectedPixels(
  sourceImage: ImageInput,
  modelImage: ImageInput,
  maskImage: ImageInput,
): Promise<string> {
  const [source, model, mask] = await Promise.all([
    loadImage(sourceImage),
    loadImage(modelImage),
    loadImage(maskImage),
  ]);

  const width = model.naturalWidth || model.width;
  const height = model.naturalHeight || model.height;
  const drawToCanvas = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('restore: 2D context unavailable');
    ctx.drawImage(img, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  };

  const sourcePixels = drawToCanvas(source);
  const modelPixels = drawToCanvas(model);
  const maskPixels = drawToCanvas(mask);

  // A fully opaque mask restores every pixel, which silently discards the render and returns the
  // raw satellite composite — the exact "the map didn't change" failure seen in production
  // (job …_w0c6b5: 100% protected, 0 editable pixels). No legitimate mask looks like this, so
  // treat it as "no usable mask" and keep the model artwork rather than shipping a dead render.
  const usableMask = maskEditableFraction(maskPixels) > 0;
  const blended = usableMask
    ? blendProtectedPixels(sourcePixels, modelPixels, maskPixels)
    : new Uint8ClampedArray(modelPixels);
  if (usableMask) {
    const mismatches = countProtectedPixelMismatches(sourcePixels, blended, maskPixels);
    if (mismatches > 0) {
      throw new Error(`restore verification failed for ${mismatches} protected pixel${mismatches === 1 ? '' : 's'}`);
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('restore: 2D context unavailable');
  const imageData = outCtx.createImageData(width, height);
  imageData.data.set(blended);
  outCtx.putImageData(imageData, 0, 0);
  return outCanvas.toDataURL('image/png');
}

/**
 * Detect a FAILED render: the model "blanking" the plot to white/cream/paper
 * instead of painting it. Returns the fraction of pixels inside the boundary
 * (or the whole frame if none) that are near-white. Callers treat > ~0.6 as a
 * failed render and retry / fall back — this replaces the per-pixel white
 * knockout, which shredded styles that legitimately use white.
 * Runs on a small downscale (fast) and never throws.
 */
export async function estimateBlankFraction(
  image: ImageInput,
  frameW: number,
  frameH: number,
  boundaryPx?: number[],
): Promise<number> {
  try {
    const img = await loadImage(image);
    const w = 200;
    const h = Math.max(1, Math.round((frameH / Math.max(1, frameW)) * w));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    if (!cx) return 0;
    cx.drawImage(img, 0, 0, w, h);
    const d = cx.getImageData(0, 0, w, h).data;
    // Boundary scaled into the small canvas' coordinate space.
    const pts = boundaryPx && boundaryPx.length >= 6
      ? boundaryPx.map((v, i) => (i % 2 === 0 ? (v / frameW) * w : (v / frameH) * h))
      : null;
    const inPoly = (x: number, y: number): boolean => {
      if (!pts) return true;
      let inside = false;
      for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
        const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    let total = 0, blank = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inPoly(x + 0.5, y + 0.5)) continue;
        total++;
        const i = (y * w + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // Blanked-plot signature: BRIGHT and NEAR-GREY. Catches pure white,
        // light grey AND warm cream/"paper" tones (the field-tested failures),
        // while painted land (saturated greens/earth) stays untouched.
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 216 && chroma < 30) blank++;
      }
    }
    return total ? blank / total : 0;
  } catch {
    return 0; // Never block a produce on the detector itself.
  }
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
  const [model, satellite, overlay] = await Promise.all([
    loadImage(inp.modelImage),
    loadImage(inp.satelliteImage),
    inp.overlayImage ? loadImage(inp.overlayImage) : Promise.resolve(null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('composite: 2D context unavailable');

  const hasBoundary = Array.isArray(boundaryPx) && boundaryPx.length >= 6;

  const drawSatelliteContext = () => {
    ctx.drawImage(satellite, 0, 0, width, height);
    if (inp.contextTreatment !== 'precision_atlas') return;
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      imageData.data.set(precisionAtlasContextPixels(imageData.data));
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // A remote image can taint a canvas. Keep the factual image rather than failing the render.
      ctx.fillStyle = 'rgba(238,231,211,0.09)';
      ctx.fillRect(0, 0, width, height);
    }
  };

  if (hasBoundary) {
    // 1. Factual satellite fills everything outside the plot. Precision Atlas applies only a
    // deterministic palette wash, avoiding the dark photographic cut-out around painted land.
    drawSatelliteContext();
    // 2. Beautified scene (elements illustrated by the model), clipped to the
    //    boundary interior — anything the model sprawled outside is erased.
    //    (Blanked/failed renders are caught BEFORE this via estimateBlankFraction.)
    ctx.save();
    traceBoundary(ctx, boundaryPx!);
    ctx.clip();
    ctx.drawImage(model, 0, 0, width, height);
    ctx.restore();
    // 3. Crisp boundary — the single highest-contrast line on the map.
    traceBoundary(ctx, boundaryPx!);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,16,10,0.5)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = inp.boundaryColor ?? '#C2A878'; ctx.lineWidth = 4; ctx.stroke();
  } else {
    // No boundary traced — satellite as the base first (so a model that returns a
    // partial/transparent frame can never leave the map blank), then the model.
    drawSatelliteContext();
    ctx.drawImage(model, 0, 0, width, height);
  }

  // Exact overlay (sector wedges etc.) — drawn UNCLIPPED so arrows that
  // deliberately reach past the boundary survive; sits under the labels.
  if (overlay) ctx.drawImage(overlay, 0, 0, width, height);

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
