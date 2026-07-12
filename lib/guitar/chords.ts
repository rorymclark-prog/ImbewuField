// Chord shapes for the nylon-string curriculum.
// frets are in chart order: index 0 = string 6 (low E) … index 5 = string 1 (high e).
// -1 = don't play, 0 = open. fingers use 1=index 2=middle 3=ring 4=pinky.

export type Chord = {
  id: string;
  name: string;
  quality: string;
  frets: number[];
  fingers?: (0 | 1 | 2 | 3 | 4)[];
  barre?: { fret: number; fromString: number; toString: number };
  level: 'first chords' | 'core' | 'stretch';
  tip: string;
};

export const CHORDS: Chord[] = [
  {
    id: 'em', name: 'E minor', quality: 'minor',
    frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], level: 'first chords',
    tip: 'The easiest full chord on the guitar. Keep fingers 2 and 3 arched so the open G string rings clearly.',
  },
  {
    id: 'e', name: 'E major', quality: 'major',
    frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], level: 'core',
    tip: 'E minor plus your index finger on the G string. The classic final chord of Spanish pieces.',
  },
  {
    id: 'am', name: 'A minor', quality: 'minor',
    frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], level: 'first chords',
    tip: 'Same finger shape as E major, moved down one string. Avoid touching the high e string with finger 1.',
  },
  {
    id: 'a', name: 'A major', quality: 'major',
    frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], level: 'core',
    tip: 'Three fingers share fret 2. On a wide nylon neck there is room — stack them in a diagonal line.',
  },
  {
    id: 'dm', name: 'D minor', quality: 'minor',
    frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], level: 'core',
    tip: 'The most "Spanish"-sounding open chord. Only strings 1–4 are played; let the thumb rest on string 5 or 6.',
  },
  {
    id: 'd', name: 'D major', quality: 'major',
    frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], level: 'core',
    tip: 'A little triangle of fingers. Strum or arpeggiate only the top four strings.',
  },
  {
    id: 'c', name: 'C major', quality: 'major',
    frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], level: 'first chords',
    tip: 'Stretch finger 3 to the A string without collapsing finger 1. Arch everything so both open strings ring.',
  },
  {
    id: 'g', name: 'G major', quality: 'major',
    frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], level: 'first chords',
    tip: 'A big, open, ringing chord. Classical players usually take the top note with finger 3 or 4.',
  },
  {
    id: 'g7', name: 'G7', quality: 'dominant 7th',
    frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], level: 'first chords',
    tip: 'Easier than G major for many beginners, and it pulls beautifully back to C.',
  },
  {
    id: 'e7', name: 'E7', quality: 'dominant 7th',
    frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], level: 'core',
    tip: 'E major with finger 3 lifted. The open D string is the 7th — let it ring.',
  },
  {
    id: 'a7', name: 'A7', quality: 'dominant 7th',
    frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0], level: 'core',
    tip: 'Two fingers, lots of sound. Leads naturally to D or Dm.',
  },
  {
    id: 'b7', name: 'B7', quality: 'dominant 7th',
    frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], level: 'stretch',
    tip: 'Your first four-finger chord — the pinky earns its keep. Essential for pieces in E minor like Romanza.',
  },
  {
    id: 'f', name: 'F major (small barre)', quality: 'major',
    frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], level: 'stretch',
    barre: { fret: 1, fromString: 2, toString: 1 },
    tip: 'Lay finger 1 flat across the top two strings. Nylon strings are kind to barres — press close behind the fret, not on top of it.',
  },
];

export function getChord(id: string): Chord | undefined {
  return CHORDS.find((c) => c.id === id);
}
