// SHEET RENDER SCALE — how many canvas pixels each logical frame pixel becomes, and the one
// setting behind "up the quality".
//
// Rory, three times across two days, most recently with an A3 print in mind: "Can up the
// quality, it's still bad — imagine when this is printed on even A3 it's gonna be blurry."
// Measured, the artwork is not the limit (canopy sources are 1024px and a typical crown draws
// at ~192px — downscaled, i.e. sharp). The limit is this multiplier: at 2 the sheet master is
// frame.imgW (960) × 2 = 1920px wide on every device, and export 'high' is scale 1 of that
// raster, so 1920px IS the print master — roughly 60 dpi on A2, 85 on A3. Labels survive that
// because they are hard-edged; foliage does not.
//
// SCALE is the right knob because every line width, glyph size and inset in DesignGlossy is
// already expressed in `* SCALE` units — raising it yields the SAME drawing with more pixels,
// never a differently-proportioned one.
//
// THE COST BOUNDARY THAT MAKES THE SETTING SAFE: nothing here may enlarge what the AI paths
// receive. The producer and the render queue bill per input pixel in effect (payload, tokens,
// storage), and a display preference must never multiply a farmer's render cost as a side
// effect. DesignGlossy caps every AI-bound bitmap back to AI_INPUT_WIDTH before upload — a
// UNIFORM downscale of the finished composite, which keeps geometry consistent because the
// whole picture shrinks together. (An earlier attempt pinned the AI canvas size while line
// widths still followed SCALE — thinner-looking geometry on the paid path. That is the mistake
// this pair of constants exists to prevent; do not "simplify" the cap away.)
//
// A `let` with a reload contract, not reactive state: the value is read at module load and
// setSheetScale()'s caller reloads, which is the only way to be certain no half-drawn sheet
// spans two scales.

export type SheetScale = 2 | 3;

/** What the AI ALWAYS receives, whatever the farmer's display/print setting. Matches the
 *  historical master width (imgW 960 × scale 2) so render inputs — and their cost — are
 *  byte-for-byte the size they were before the quality setting existed. */
export const AI_INPUT_WIDTH = 1920;

export const SHEET_SCALE_KEY = 'imbewu_sheet_scale';

function readStoredScale(): SheetScale {
  if (typeof window === 'undefined') return 2; // SSR renders nothing; hydration re-reads
  try {
    return window.localStorage.getItem(SHEET_SCALE_KEY) === '3' ? 3 : 2;
  } catch {
    return 2;
  }
}

export let SCALE: SheetScale = readStoredScale();

/** Persist the choice. Returns true when it changed — the caller is expected to reload. */
export function setSheetScale(next: SheetScale): boolean {
  if (next === SCALE) return false;
  try {
    window.localStorage.setItem(SHEET_SCALE_KEY, String(next));
  } catch {
    /* private mode: the live-binding update below still applies for this session */
  }
  SCALE = next;
  return true;
}
