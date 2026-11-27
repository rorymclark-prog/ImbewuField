import { MAX_CORRECTION_PINS, MAX_CORRECTION_SIZE, type CorrectionArea } from './map-correction-pins';
import { compareRenders, retainedRenderHasVisibleChange } from './render-difference';
import { drainCanvasToDataUrl, releaseImageSource } from './release-canvas';
import { UserFacingError } from './user-facing-error';

export interface CorrectionFrame { version: 1; width: number; height: number; areas: CorrectionArea[] }

export function validAreas(value: unknown): value is CorrectionArea[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_CORRECTION_PINS && value.every(a =>
    a && [a.left, a.right, a.top, a.bottom].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && a.right > a.left && a.bottom > a.top && Math.max(a.right - a.left, a.bottom - a.top) <= MAX_CORRECTION_SIZE + 1e-9);
}

export function validCorrectionFrame(value: unknown): value is CorrectionFrame {
  const f = value as Partial<CorrectionFrame> | null;
  return !!f && f.version === 1 && [f.width, f.height].every(n => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 16384)
    && f.width! * f.height! <= 32_000_000 && validAreas(f.areas);
}

/** The surrounding artwork gives the model landmarks and scale for a thin swale or a small tree.
 * Derive the same print-pixel rectangle for both provider references and for recovered output. */
export function correctionCrop({width,height,areas}: CorrectionFrame) {
  const left = Math.floor(Math.min(...areas.map(a => a.left)) * width);
  const top = Math.floor(Math.min(...areas.map(a => a.top)) * height);
  const right = Math.ceil(Math.max(...areas.map(a => a.right)) * width);
  const bottom = Math.ceil(Math.max(...areas.map(a => a.bottom)) * height);
  const margin = Math.max(32, Math.ceil(Math.max(right-left,bottom-top) * .18));
  const w = Math.min(width, Math.max(right-left + 2*margin, Math.ceil((bottom-top + 2*margin)/2)));
  const h = Math.min(height, Math.max(bottom-top + 2*margin, Math.ceil(w/2)));
  return {x:Math.max(0,Math.min(width-w,Math.floor((left+right-w)/2))),
    y:Math.max(0,Math.min(height-h,Math.floor((top+bottom-h)/2))), width:w, height:h};
}

async function decode(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// An original print sheet can exceed the Storage object's size limit even as a PNG.
// Freeze lossless strips under this job before dispatch so recovery also works on another device.
// Strip boundaries and crop geometry are part of the version 1 storage format.
function stripHeight(width: number) { return Math.max(1, Math.floor(1_000_000 / width)); }
export function originalStripPath(inputPath: string, y: number) {
  return inputPath.replace(/\/input-([^/]+)\.jpg$/, '/original-$1-' + y + '.png');
}

export async function freezeCorrectionOriginal(src: string, areas: CorrectionArea[], write: (y: number, png: Blob) => Promise<void>) {
  const img = await decode(src);
  const strip = document.createElement('canvas');
  try {
    const frame = { version:1 as const, width: img.naturalWidth, height: img.naturalHeight, areas };
    if (!validCorrectionFrame(frame)) throw new UserFacingError('This saved illustration has an unsupported size or edit area.');
    strip.width = frame.width;
    for (let y = 0; y < frame.height; y += stripHeight(frame.width)) {
      strip.height = Math.min(stripHeight(frame.width), frame.height - y);
      const ctx = strip.getContext('2d');
      if (!ctx) throw new Error('Cannot open the original map.');
      ctx.drawImage(img, 0, y, strip.width, strip.height, 0, 0, strip.width, strip.height);
      const png = await new Promise<Blob>((resolve, reject) => strip.toBlob(b => b ? resolve(b) : reject(new Error('Cannot save original map pixels.')), 'image/png'));
      await write(y, png);
    }
    return frame;
  } finally { strip.width = strip.height = 1; releaseImageSource(img); }
}

export class NoVisibleCorrection extends UserFacingError { }

/** Use crop coordinates for the existing paid difference gate. A new background outside
 * the marked area must not qualify an unchanged swale as a successful correction. */
export function correctionScoreMask(frame: CorrectionFrame): string {
  const crop = correctionCrop(frame);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(crop.width,crop.height));
  canvas.width = Math.max(1,Math.round(crop.width*scale));
  canvas.height = Math.max(1,Math.round(crop.height*scale));
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot check the selected correction.');
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.scale(canvas.width/crop.width,canvas.height/crop.height);
    for (const a of frame.areas) ctx.clearRect(a.left*frame.width-crop.x, a.top*frame.height-crop.y,
      (a.right-a.left)*frame.width,(a.bottom-a.top)*frame.height);
    return drainCanvasToDataUrl(canvas,'image/png');
  } finally { canvas.width = canvas.height = 1; }
}

/** Feather only inward. Overlapping selections take their maximum coverage, so the
 * correction is independent of the order the farmer ticked the pins. */
export function correctionCoverage(frame: CorrectionFrame, yStart: number, rows: number) {
  const { width, height } = frame;
  const coverage = new Uint8Array(width * rows);
  for (const a of frame.areas) {
    const l = a.left * width, r = a.right * width, t = a.top * height, b = a.bottom * height;
    const feather = Math.max(1, Math.min(12, (r - l) / 8, (b - t) / 8));
    for (let y = Math.max(yStart, Math.ceil(t - .5)); y < Math.min(yStart + rows, b - .5); y++) {
      for (let x = Math.max(0, Math.ceil(l - .5)); x < Math.min(width, r - .5); x++) {
        const distance = Math.min(x + .5 - l, r - x - .5, y + .5 - t, b - y - .5);
        const i = (y - yStart) * width + x;
        coverage[i] = Math.max(coverage[i], Math.round(255 * Math.min(1, distance / feather)));
      }
    }
  }
  return coverage;
}

export async function applyLocalCorrection(candidate: string, frame: CorrectionFrame, read: (y: number) => Promise<string>) {
  if (!validCorrectionFrame(frame)) throw new UserFacingError('The saved correction area is unreadable.');
  const img = await decode(candidate);
  const result = document.createElement('canvas'), strip = document.createElement('canvas');
  try {
    const crop = correctionCrop(frame);
    const drift = Math.abs(img.naturalWidth * crop.height - img.naturalHeight * crop.width);
    if (drift > Math.max(img.naturalWidth, img.naturalHeight, crop.width, crop.height))
      throw new UserFacingError('The correction does not line up with the marked part of the sheet.');
    result.width = strip.width = frame.width; result.height = frame.height;
    const out = result.getContext('2d');
    let visible = false;
    if (!out) throw new Error('Cannot assemble the corrected map.');
    for (let y = 0; y < frame.height; y += stripHeight(frame.width)) {
      strip.height = Math.min(stripHeight(frame.width), frame.height - y);
      const ctx = strip.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Cannot open corrected map pixels.');
      const original = await decode(await read(y));
      try {
        if (original.naturalWidth !== strip.width || original.naturalHeight !== strip.height)
          throw new UserFacingError('Part of the original illustration has the wrong dimensions.');
        out.drawImage(original, 0, y);
        const mask = correctionCoverage(frame, y, strip.height);
        if (!mask.some(Boolean)) continue;
        ctx.drawImage(original, 0, 0);
        const before = ctx.getImageData(0, 0, strip.width, strip.height);
        ctx.clearRect(0, 0, strip.width, strip.height);
        ctx.drawImage(img, crop.x, crop.y-y, crop.width, crop.height);
        const after = ctx.getImageData(0, 0, strip.width, strip.height);
        for (let p = 0; p < mask.length; p++) {
          const strength = mask[p] / 255;
          for (let c = p * 4; c < p * 4 + 4; c++) after.data[c] = before.data[c] + strength * (after.data[c] - before.data[c]);
        }
        visible ||= retainedRenderHasVisibleChange(compareRenders(before.data, after.data));
        // Write only the edit rectangles. Even an RGBA read / write round trip can
        // change a translucent pixel, so leave the surrounding original on its canvas.
        for (const area of frame.areas) {
          const left = Math.ceil(area.left * frame.width - .5);
          const right = Math.ceil(area.right * frame.width - .5);
          const top = Math.max(0, Math.ceil(area.top * frame.height - .5) - y);
          const bottom = Math.min(strip.height, Math.ceil(area.bottom * frame.height - .5) - y);
          if (right > left && bottom > top) out.putImageData(after, 0, y, left, top, right - left, bottom - top);
        }
      } finally { releaseImageSource(original); }
    }
    if (!visible) throw new NoVisibleCorrection('The AI returned no visible correction inside your selected areas. Your original is in Saved maps.');
    const png = drainCanvasToDataUrl(result, 'image/png');
    if (!png.startsWith('data:image/png;base64,')) throw new Error('Could not encode the corrected map.');
    return png;
  } finally { result.width = result.height = strip.width = strip.height = 1; releaseImageSource(img); }
}
