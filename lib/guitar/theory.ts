// Music theory helpers for the guitar studio.
// Strings are numbered 1..6 from the high E (treble) to the low E (bass),
// matching how tab and chord charts are usually read.

export const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const; // string 1..6

/** MIDI note of each open string, index 0 = string 1 (high e). */
export const OPEN_MIDI = [64, 59, 55, 50, 45, 40] as const;

const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number, withOctave = true): string {
  const name = NAMES_SHARP[((midi % 12) + 12) % 12];
  return withOctave ? `${name}${Math.floor(midi / 12) - 1}` : name;
}

/** MIDI note for a fretted position. string: 1..6, fret: 0..n */
export function fretToMidi(string: number, fret: number): number {
  return OPEN_MIDI[string - 1] + fret;
}

export function fretToName(string: number, fret: number, withOctave = false): string {
  return midiToName(fretToMidi(string, fret), withOctave);
}

/** Nearest note to a frequency, plus how many cents it is off. */
export function freqToNote(freq: number): { midi: number; name: string; cents: number } {
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFloat);
  return { midi, name: midiToName(midi), cents: Math.round((midiFloat - midi) * 100) };
}

export const STANDARD_TUNING = [1, 2, 3, 4, 5, 6].map((s) => ({
  string: s,
  midi: OPEN_MIDI[s - 1],
  name: midiToName(OPEN_MIDI[s - 1]),
  freq: midiToFreq(OPEN_MIDI[s - 1]),
}));
