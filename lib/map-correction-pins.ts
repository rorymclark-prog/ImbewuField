// Positions are fractions of the saved, finished illustration, including its margins and legend.
// Oblique pins deliberately have no geographic coordinates.
export interface CorrectionPin { id: string; x: number; y: number; note: string; width?: number; height?: number }
export interface CorrectionArea { left: number; top: number; right: number; bottom: number }
export const DEFAULT_CORRECTION_SIZE = .08;
export const MAX_CORRECTION_SIZE = .6;

export function correctionArea(pin: CorrectionPin): CorrectionArea {
  const w = (pin.width ?? DEFAULT_CORRECTION_SIZE) / 2;
  const h = (pin.height ?? DEFAULT_CORRECTION_SIZE) / 2;
  return { left: Math.max(0, pin.x-w), top: Math.max(0, pin.y-h),
    right: Math.min(1, pin.x+w), bottom: Math.min(1, pin.y+h) };
}

export function sameCorrectionPin(a: CorrectionPin, b: CorrectionPin): boolean {
  return a.id === b.id && a.note === b.note && a.x === b.x && a.y === b.y
    && (a.width ?? DEFAULT_CORRECTION_SIZE) === (b.width ?? DEFAULT_CORRECTION_SIZE)
    && (a.height ?? DEFAULT_CORRECTION_SIZE) === (b.height ?? DEFAULT_CORRECTION_SIZE);
}

export const MAX_CORRECTION_PINS = 24;
export const MAX_CORRECTION_NOTE = 240;

export function validCorrectionNotes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_CORRECTION_PINS
    && value.every(note => typeof note === 'string' && note.trim().length > 0 && note.length <= MAX_CORRECTION_NOTE);
}

export function validCorrectionPin(value: unknown): value is CorrectionPin {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<CorrectionPin>;
  const fraction = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  return typeof p.id === 'string' && /^[\w-]{1,64}$/.test(p.id) && fraction(p.x) && fraction(p.y)
    && [p.width, p.height].every(n => n === undefined || (typeof n === 'number' && n >= .01 && n <= MAX_CORRECTION_SIZE))
    && validCorrectionNotes([p.note]);
}

export function correctionPins(value: unknown): CorrectionPin[] {
  return Array.isArray(value) ? value.filter(validCorrectionPin).slice(0, MAX_CORRECTION_PINS) : [];
}

export const LOCAL_CORRECTION_PROMPT = 'Edit the supplied crop of a saved illustration. The first image is the original artwork at this framing. The last image is a numbered guide to the same crop. Apply only the numbered corrections inside their dashed boxes. Match the existing materials, camera, scale, lighting and landmark positions right up to each box edge. Preserve nearby plants, labels, buildings and paths unless explicitly marked for correction. Return the clean crop at exactly the same framing. Omit all review marks.';

export function correctionInstructions(notes: string[]): string {
  if (!validCorrectionNotes(notes)) throw new Error('Choose valid correction notes.');
  return [
    'The last input image is a previous finished illustration with numbered review pins. Use the pin centres on THAT image to locate these requested appearance corrections. Preserve the measured design and framing supplied by the primary input. Return only the requested artwork. Omit review pins, pin numbers and review text.',
    ...notes.map((note,i) => 'Pin ' + (i + 1) + ': ' + JSON.stringify(note)),
  ].join('\n');
}
