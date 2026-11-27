// Positions are fractions of the saved, finished illustration, including its margins and legend.
// Oblique pins deliberately have no geographic coordinates.
export interface CorrectionPin { id: string; x: number; y: number; note: string }
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
    && validCorrectionNotes([p.note]);
}

export function correctionPins(value: unknown): CorrectionPin[] {
  return Array.isArray(value) ? value.filter(validCorrectionPin).slice(0, MAX_CORRECTION_PINS) : [];
}

export function correctionInstructions(notes: string[]): string {
  if (!validCorrectionNotes(notes)) throw new Error('Choose valid correction notes.');
  return [
    'The last input image is a previous finished illustration with numbered review pins. Use the pin centres on THAT image to locate these requested appearance corrections. Preserve the measured design and framing supplied by the primary input. Return only the requested artwork. Omit review pins, pin numbers and review text.',
    ...notes.map((note,i) => 'Pin ' + (i + 1) + ': ' + JSON.stringify(note)),
  ].join('\n');
}
