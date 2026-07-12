// The nylon-string guitar curriculum: a structured beginner path from
// holding the guitar to playing the opening of Romanza.
// Exercises are real playable tab — the studio synthesises them so the
// learner always hears what the passage should sound like.

import type { TabColumn } from './audio';

export type FretMark = { s: number; f: number; label: string };

export type Exercise = {
  title: string;
  tempo: number;
  cols: TabColumn[];
  loop?: boolean;
  countIn?: boolean;
  tip?: string;
};

export type Section =
  | { kind: 'text'; body: string }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'tip'; body: string }
  | { kind: 'chords'; ids: string[] }
  | { kind: 'exercise'; ex: Exercise }
  | { kind: 'fretboard'; title?: string; marks: FretMark[] };

export type Lesson = {
  id: string;
  num: number;
  title: string;
  subtitle: string;
  minutes: number;
  goals: string[];
  sections: Section[];
  practice: string[];
};

// Small helpers to keep the tab data readable.
const n = (s: number, f: number, d?: number, label?: string): TabColumn =>
  d !== undefined || label !== undefined ? { ns: [[s, f]], d, label } : { ns: [[s, f]] };
const ch = (ns: [number, number][], d?: number, label?: string): TabColumn => ({ ns, d, label });

export const LESSONS: Lesson[] = [
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    num: 1,
    title: 'Meet your nylon-string guitar',
    subtitle: 'Posture, hand positions and how a classical guitar wants to be held',
    minutes: 15,
    goals: [
      'Know the parts of the guitar and the string numbers',
      'Sit with the classical posture (guitar on the left leg)',
      'Place both hands in a relaxed playing position',
    ],
    sections: [
      {
        kind: 'text',
        body: 'A nylon-string (classical) guitar is the friendliest guitar to learn on: the strings are soft under the fingers, the neck is wide so notes don’t crowd each other, and it is played fingerstyle — no pick needed. Everything in this course is built around that.',
      },
      {
        kind: 'list',
        title: 'The map',
        items: [
          'Strings are numbered 1 to 6, from the thinnest (closest to the floor) to the thickest. String 1 is high E, string 6 is low E.',
          'Frets are the metal strips on the neck. “Fret 3” means you press the string just behind the third strip, not on top of it.',
          'Right-hand fingers have Spanish names in classical guitar: p (pulgar, thumb), i (index), m (middle), a (ring).',
          'Left-hand fingers are simply numbered 1–4, index to pinky.',
        ],
      },
      {
        kind: 'list',
        title: 'Classical sitting position',
        items: [
          'Sit on the front half of a chair, both feet on the floor.',
          'Rest the guitar’s waist on your left leg and raise that leg slightly — a footstool, a stack of books, or a cushion under the guitar all work.',
          'The neck points up at roughly 45°, with the tuning pegs around eye level.',
          'The guitar leans back against your chest; you should be able to let go with both hands and it stays put.',
        ],
      },
      {
        kind: 'tip',
        body: 'The angled neck is not a formality — it is what makes barres, stretches and clean chord changes physically easy later. Build the habit now while there is nothing else to think about.',
      },
      {
        kind: 'text',
        body: 'Right hand: let the arm rest on the widest part of the body, wrist gently arched, fingers falling over the soundhole. Left hand: thumb flat against the back of the neck (not hooked over the top), fingers curled so the tips come down onto the strings like little hammers.',
      },
    ],
    practice: [
      'Sit in playing position for 2 minutes, checking the four posture points',
      'Name each string out loud while touching it: E–A–D–G–B–E, thick to thin',
      'Place p on string 6 and i, m, a on strings 3, 2, 1 without looking',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'open-strings',
    num: 2,
    title: 'Tuning and the open strings',
    subtitle: 'Get in tune, then make your first sounds with the thumb',
    minutes: 15,
    goals: [
      'Tune all six strings with the built-in tuner',
      'Play each open string cleanly with the thumb (p)',
      'Hear the difference between a buzzy and a clean note',
    ],
    sections: [
      {
        kind: 'text',
        body: 'Nothing sounds good on an out-of-tune guitar, so tuning always comes first. Open the Tuner from the menu — it listens through your microphone and shows how close each string is. New nylon strings drift a lot for the first week or two; tune every time you pick up the guitar.',
      },
      {
        kind: 'list',
        title: 'The open strings, thick to thin',
        items: [
          'String 6 — E (low)', 'String 5 — A', 'String 4 — D',
          'String 3 — G', 'String 2 — B', 'String 1 — E (high)',
        ],
      },
      {
        kind: 'tip',
        body: 'A classic mnemonic from thick to thin: Eddie Ate Dynamite, Good Bye Eddie.',
      },
      {
        kind: 'text',
        body: 'Now the first real playing. Rest your thumb (p) on string 6 and push through the string so it comes to rest on string 5 — a relaxed, falling motion from the wrist joint of the thumb, not a pluck upward. Press play below to hear the target, then copy it.',
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Open-string walk with p',
          tempo: 60,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'p'), n(5, 0, 1, 'p'), n(4, 0, 1, 'p'), n(3, 0, 1, 'p'),
            n(2, 0, 1, 'p'), n(1, 0, 1, 'p'), n(2, 0), n(3, 0),
            n(4, 0), n(5, 0), n(6, 0, 2),
          ],
          tip: 'Let each note ring into the next. If a note thuds, you are gripping — shake the hand out and try lighter.',
        },
      },
    ],
    practice: [
      'Tune the guitar from string 6 to string 1',
      'Play the open-string walk 5 times slowly, listening for even volume',
      'Close your eyes and find string 4 with p by touch alone',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'right-hand',
    num: 3,
    title: 'The right hand: p, i, m, a',
    subtitle: 'Free stroke — the motion behind almost everything you’ll play',
    minutes: 20,
    goals: [
      'Play free strokes with i and m, alternating evenly',
      'Keep p working independently on the bass strings',
      'Play your first p–i–m–a arpeggio',
    ],
    sections: [
      {
        kind: 'text',
        body: 'The free stroke (tirando) is the everyday stroke of classical guitar: the fingertip pushes through the string and follows through into the air, just missing the neighbouring string. The movement comes from the big knuckle at the hand, not from the fingertip curling.',
      },
      {
        kind: 'list',
        title: 'Home position',
        items: [
          'p rests on string 6, i on string 3, m on string 2, a on string 1',
          'Wrist stays quiet — only the fingers move',
          'Fingernails or fingertips both work; short nails are fine to start',
        ],
      },
      {
        kind: 'exercise',
        ex: {
          title: 'i–m alternation on the first string',
          tempo: 70,
          countIn: true,
          loop: true,
          cols: [
            n(1, 0, 1, 'i'), n(1, 0, 1, 'm'), n(1, 0, 1, 'i'), n(1, 0, 1, 'm'),
            n(1, 0, 1, 'i'), n(1, 0, 1, 'm'), n(1, 0, 1, 'i'), n(1, 0, 1, 'm'),
          ],
          tip: 'Strict alternation — never the same finger twice. This becomes your scale technique later.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Thumb walk while fingers rest',
          tempo: 60,
          loop: true,
          cols: [
            n(6, 0, 1, 'p'), n(5, 0, 1, 'p'), n(4, 0, 1, 'p'), n(5, 0, 1, 'p'),
            n(6, 0, 1, 'p'), n(5, 0, 1, 'p'), n(4, 0, 1, 'p'), n(5, 0, 1, 'p'),
          ],
          tip: 'Keep i, m and a lightly touching strings 3, 2 and 1 while p walks — that anchor is what keeps the hand stable.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Your first arpeggio: p–i–m–a',
          tempo: 60,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'p'), n(3, 0, 1, 'i'), n(2, 0, 1, 'm'), n(1, 0, 1, 'a'),
            n(6, 0, 1, 'p'), n(3, 0, 1, 'i'), n(2, 0, 1, 'm'), n(1, 0, 1, 'a'),
          ],
          tip: 'All open strings — pure right hand. This exact pattern, over chords, is half of the classical repertoire.',
        },
      },
    ],
    practice: [
      'i–m alternation: 2 minutes on string 1, then 1 minute each on strings 2 and 3',
      'p–i–m–a arpeggio: 10 slow repetitions with the play-along',
      'Watch the right hand in a mirror — only fingers should move, not the wrist',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'left-hand',
    num: 4,
    title: 'The left hand: first notes',
    subtitle: 'Fretting cleanly in first position',
    minutes: 20,
    goals: [
      'Fret notes with a clear, buzz-free sound',
      'Use one finger per fret (the “first position” habit)',
      'Learn the notes F, G, C and D on the top two strings',
    ],
    sections: [
      {
        kind: 'text',
        body: 'Left-hand rule number one: press just behind the fret wire, with the very tip of the finger, and only as hard as needed. Try this experiment — touch the string lightly and pluck (it buzzes), then squeeze gradually until the note pops clear. That moment of clarity is all the pressure you ever need.',
      },
      {
        kind: 'fretboard',
        title: 'Your first fretted notes',
        marks: [
          { s: 1, f: 1, label: 'F' }, { s: 1, f: 3, label: 'G' },
          { s: 2, f: 1, label: 'C' }, { s: 2, f: 3, label: 'D' },
        ],
      },
      {
        kind: 'text',
        body: 'In first position each finger owns a fret: finger 1 covers fret 1, finger 2 fret 2, finger 3 fret 3, finger 4 fret 4. So F and C are finger 1, G and D are finger 3.',
      },
      {
        kind: 'exercise',
        ex: {
          title: 'The 1–2–3–4 spider',
          tempo: 60,
          countIn: true,
          loop: true,
          cols: [
            n(1, 1, 1, '1'), n(1, 2, 1, '2'), n(1, 3, 1, '3'), n(1, 4, 1, '4'),
            n(2, 1, 1, '1'), n(2, 2, 1, '2'), n(2, 3, 1, '3'), n(2, 4, 1, '4'),
          ],
          tip: 'Keep each finger down as the next one lands — by “4” all four fingertips are on the string. Alternate i–m in the right hand.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Note mixer: F, G, C, D',
          tempo: 60,
          loop: true,
          cols: [
            n(1, 1, 1, 'F'), n(1, 3, 1, 'G'), n(2, 1, 1, 'C'), n(2, 3, 1, 'D'),
            n(1, 3, 1, 'G'), n(1, 1, 1, 'F'), n(2, 3, 1, 'D'), n(2, 1, 1, 'C'),
          ],
          tip: 'Say the note names out loud as you play them — it wires the fretboard into memory twice as fast.',
        },
      },
      {
        kind: 'tip',
        body: 'Sore fingertips are normal for the first two weeks and much gentler on nylon than on steel. Short daily sessions beat one long one — the skin adapts overnight.',
      },
    ],
    practice: [
      'Spider exercise on strings 1 and 2, 3 minutes',
      'Note mixer until you can play it without looking at the diagram',
      'Pressure experiment on each new note: buzz → clear → relax',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'first-melody',
    num: 5,
    title: 'Reading tab & your first melody',
    subtitle: 'Ode to Joy — Beethoven, on two strings',
    minutes: 25,
    goals: [
      'Read guitar tablature confidently',
      'Play a complete melody from start to finish',
      'Combine fretted notes and open strings in a real piece',
    ],
    sections: [
      {
        kind: 'text',
        body: 'Tablature (tab) is a picture of the strings: six lines, the top line is string 1 (high e) and the bottom is string 6. A number is the fret to press — 0 means open. Read left to right, exactly like text. Every exercise you have played so far was written in tab; now you can name what you were reading.',
      },
      {
        kind: 'text',
        body: 'Your first piece is the theme from Beethoven’s Ninth Symphony. It uses only the notes you learned in Lesson 4 plus the open strings E and B. Listen first, then learn it phrase by phrase.',
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Ode to Joy — phrase 1',
          tempo: 80,
          countIn: true,
          cols: [
            n(1, 0), n(1, 0), n(1, 1), n(1, 3),
            n(1, 3), n(1, 1), n(1, 0), n(2, 3),
            n(2, 1), n(2, 1), n(2, 3), n(1, 0),
            n(1, 0, 1.5), n(2, 3, 0.5), n(2, 3, 2),
          ],
          tip: 'The ending rhythm is long–short–looong. Sing it: “da-a da daaa”.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Ode to Joy — phrase 2 (the ending)',
          tempo: 80,
          countIn: true,
          cols: [
            n(1, 0), n(1, 0), n(1, 1), n(1, 3),
            n(1, 3), n(1, 1), n(1, 0), n(2, 3),
            n(2, 1), n(2, 1), n(2, 3), n(1, 0),
            n(2, 3, 1.5), n(2, 1, 0.5), n(2, 1, 2),
          ],
          tip: 'Identical to phrase 1 until the last three notes, which settle down onto C — home.',
        },
      },
      {
        kind: 'tip',
        body: 'Alternate i–m throughout, and keep finger 1 hovering over fret 1 even when it isn’t playing. The less your fingers travel, the smoother the melody sounds.',
      },
    ],
    practice: [
      'Play along with each phrase at 80, then try without the guide',
      'Slow it to a crawl and make every note ring its full length',
      'Perform the whole melody for someone (or your phone’s voice recorder)',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'rest-stroke',
    num: 6,
    title: 'Rest stroke & beautiful tone',
    subtitle: 'Apoyando — the singing sound of classical guitar',
    minutes: 20,
    goals: [
      'Play rest strokes (apoyando) with i and m',
      'Play a one-octave C major scale in first position',
      'Control loud and soft on purpose',
    ],
    sections: [
      {
        kind: 'text',
        body: 'In a rest stroke the finger pushes through the string and lands — rests — on the next string instead of escaping into the air. The string is driven more towards the soundboard, which gives a fatter, louder, more vocal note. Melodies love it; that’s why it gets its own lesson.',
      },
      {
        kind: 'list',
        title: 'Free stroke vs rest stroke',
        items: [
          'Free stroke (tirando): follow through into the air — for arpeggios and chords',
          'Rest stroke (apoyando): follow through onto the next string — for melodies and scales',
          'Same relaxed motion from the big knuckle in both',
        ],
      },
      {
        kind: 'exercise',
        ex: {
          title: 'C major scale, rest stroke, one octave',
          tempo: 60,
          countIn: true,
          loop: true,
          cols: [
            n(5, 3, 1, 'C'), n(4, 0, 1, 'D'), n(4, 2, 1, 'E'), n(4, 3, 1, 'F'),
            n(3, 0, 1, 'G'), n(3, 2, 1, 'A'), n(2, 0, 1, 'B'), n(2, 1, 1, 'C'),
            n(2, 0, 1, 'B'), n(3, 2, 1, 'A'), n(3, 0, 1, 'G'), n(4, 3, 1, 'F'),
            n(4, 2, 1, 'E'), n(4, 0, 1, 'D'), n(5, 3, 2, 'C'),
          ],
          tip: 'Strict i–m alternation, every note a rest stroke. This scale is the vocabulary of hundreds of melodies.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Dynamics drill: whisper to shout',
          tempo: 70,
          loop: true,
          cols: [
            n(1, 0, 1, 'pp'), n(1, 0), n(1, 0, 1, 'mf'), n(1, 0),
            n(1, 0, 1, 'ff'), n(1, 0), n(1, 0, 1, 'mf'), n(1, 0, 1, 'pp'),
          ],
          tip: 'Same stroke, different depth. Volume comes from how far you press the string in, not from tension.',
        },
      },
      {
        kind: 'tip',
        body: 'Tone experiment: pluck near the bridge (bright, glassy) then over the soundhole (warm, round). Classical guitarists move the right hand constantly to “mix” their own sound.',
      },
    ],
    practice: [
      'C major scale with rest strokes, up and down, 5 minutes',
      'Play Ode to Joy again — melody in rest stroke this time',
      'One minute of the dynamics drill, exaggerating the difference',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'thumb-melody',
    num: 7,
    title: 'Thumb and fingers together',
    subtitle: 'The pinch and the waltz — two voices at once',
    minutes: 20,
    goals: [
      'Pinch a bass note and a melody note at the same instant',
      'Keep a waltz accompaniment steady (bass–pluck–pluck)',
      'Understand how solo guitar carries two voices',
    ],
    sections: [
      {
        kind: 'text',
        body: 'This is the moment classical guitar becomes magic: the thumb plays a bass line while the fingers play melody — one instrument, two voices. The core skill is the pinch: p and a finger pluck together, in opposite directions, like snapping your fingers in slow motion.',
      },
      {
        kind: 'exercise',
        ex: {
          title: 'The pinch drill',
          tempo: 60,
          countIn: true,
          loop: true,
          cols: [
            ch([[6, 0], [1, 0]], 2, 'p+a'), ch([[6, 0], [1, 0]], 2, 'p+a'),
            ch([[5, 0], [1, 0]], 2, 'p+a'), ch([[5, 0], [1, 0]], 2, 'p+a'),
            ch([[4, 0], [1, 0]], 2, 'p+a'), ch([[4, 0], [1, 0]], 2, 'p+a'),
            ch([[6, 0], [1, 0]], 4, 'p+a'),
          ],
          tip: 'Both notes must speak at exactly the same instant — record yourself and listen for a “flam”.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Waltz pattern: bass–pluck–pluck',
          tempo: 90,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'p'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'),
            n(5, 0, 1, 'p'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'),
            n(4, 0, 1, 'p'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'), ch([[3, 0], [2, 0], [1, 0]], 1, 'ima'),
            n(6, 0, 3, 'p'),
          ],
          tip: 'ONE-two-three, ONE-two-three. The bass note is the downbeat — lean on it slightly.',
        },
      },
      {
        kind: 'tip',
        body: 'When i, m and a pluck together, they act as one “finger” playing a small chord. Keep the three fingertips close together so they move as a unit.',
      },
    ],
    practice: [
      'Pinch drill until ten pinches in a row sound as one attack',
      'Waltz pattern for 3 minutes without stopping — steadiness over speed',
      'Try the waltz while humming Ode to Joy over it (just for fun)',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'first-chords',
    num: 8,
    title: 'Your first chords',
    subtitle: 'Em, Am, C and G7 — the keys to a thousand songs',
    minutes: 25,
    goals: [
      'Form Em, Am, C and G7 cleanly',
      'Arpeggiate each chord so every note rings',
      'Change between chords without stopping the pulse',
    ],
    sections: [
      {
        kind: 'text',
        body: 'A chord is several notes ringing together. On classical guitar you will mostly arpeggiate chords (roll through them with p–i–m–a) rather than strum — which is good news, because arpeggios expose every buzzing note and teach your left hand honesty. Tap any diagram below to hear the chord.',
      },
      { kind: 'chords', ids: ['em', 'am', 'c', 'g7'] },
      {
        kind: 'list',
        title: 'Clean-chord checklist',
        items: [
          'Fingertips arched, landing on their very tips',
          'Fingers just behind the fret wire',
          'Thumb low on the back of the neck, roughly opposite finger 2',
          'Pluck each string one at a time — fix any that buzz before playing the chord',
        ],
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Arpeggio tour: Em → Am → C → G7',
          tempo: 70,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'Em'), n(3, 0), n(2, 0), n(1, 0),
            n(5, 0, 1, 'Am'), n(3, 2), n(2, 1), n(1, 0),
            n(5, 3, 1, 'C'), n(3, 0), n(2, 1), n(1, 0),
            n(6, 3, 1, 'G7'), n(3, 0), n(2, 0), n(1, 1),
          ],
          tip: 'Start moving the left hand on the last note of each bar — changes happen during the music, not between it.',
        },
      },
      {
        kind: 'tip',
        body: 'Spot the shortcuts: from Am to C only finger 3 moves. Finding the “shared fingers” between chords is how changes get fast.',
      },
    ],
    practice: [
      'One minute per chord: place, arpeggiate, lift, repeat',
      'Chord-change pairs: Em↔Am, Am↔C, C↔G7, 10 clean changes each',
      'Arpeggio tour along with the guide, then twice as slow without it',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'arpeggio-study',
    num: 9,
    title: 'Arpeggio study in E minor',
    subtitle: 'Your first real study — in the style of Giuliani and Carcassi',
    minutes: 25,
    goals: [
      'Play a flowing p–i–m–a–m–i pattern',
      'Hold chord shapes while the right hand paints across them',
      'Learn B7, the chord that makes E minor feel like home',
    ],
    sections: [
      {
        kind: 'text',
        body: 'The nineteenth-century guitar masters wrote hundreds of studies that are just this: a chord progression held by the left hand while the right hand plays a repeating arpeggio pattern. Master one pattern and you can play all of them. Ours is p–i–m–a–m–i — up and back like a small wave.',
      },
      { kind: 'chords', ids: ['b7'] },
      {
        kind: 'exercise',
        ex: {
          title: 'The wave on open strings',
          tempo: 80,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'p'), n(3, 0, 1, 'i'), n(2, 0, 1, 'm'),
            n(1, 0, 1, 'a'), n(2, 0, 1, 'm'), n(3, 0, 1, 'i'),
            n(6, 0, 1, 'p'), n(3, 0, 1, 'i'), n(2, 0, 1, 'm'),
            n(1, 0, 1, 'a'), n(2, 0, 1, 'm'), n(3, 0, 1, 'i'),
          ],
          tip: 'Six even notes per bar — no bump on the turnaround at “a”.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Study in E minor: Em – C – Am – B7 – Em',
          tempo: 76,
          countIn: true,
          loop: true,
          cols: [
            n(6, 0, 1, 'Em'), n(3, 0), n(2, 0), n(1, 0), n(2, 0), n(3, 0),
            n(5, 3, 1, 'C'), n(3, 0), n(2, 1), n(1, 0), n(2, 1), n(3, 0),
            n(5, 0, 1, 'Am'), n(3, 2), n(2, 1), n(1, 0), n(2, 1), n(3, 2),
            n(5, 2, 1, 'B7'), n(3, 2), n(2, 0), n(1, 2), n(2, 0), n(3, 2),
            ch([[6, 0], [3, 0], [2, 0], [1, 0]], 6, 'Em'),
          ],
          tip: 'B7 is the hard bar — isolate it. Notice how tense it feels, and how the final Em resolves that tension. That pull is what music is made of.',
        },
      },
      {
        kind: 'tip',
        body: 'Once the study flows, shape it: start softly, grow through the B7 bar, and let the final Em bloom. You are no longer doing exercises — you are playing music.',
      },
    ],
    practice: [
      'The wave on open strings, 2 minutes, eyes closed',
      'B7 alone: place, arpeggiate, lift — 10 repetitions',
      'The full study 5 times, adding dynamics on the last two',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'spanish',
    num: 10,
    title: 'The Spanish sound',
    subtitle: 'Phrygian colour and the Andalusian cadence',
    minutes: 20,
    goals: [
      'Play the E Phrygian scale — the flamenco sound',
      'Play the Andalusian cadence: Am – G – F – E',
      'Meet the small barre in the F chord',
    ],
    sections: [
      {
        kind: 'text',
        body: 'That unmistakably Spanish colour comes from the Phrygian mode — a scale that starts with a half-step — and from the Andalusian cadence, four chords stepping down to E. Nylon strings were made for this sound.',
      },
      {
        kind: 'exercise',
        ex: {
          title: 'E Phrygian scale',
          tempo: 70,
          countIn: true,
          loop: true,
          cols: [
            n(4, 2, 1, 'E'), n(4, 3, 1, 'F'), n(3, 0, 1, 'G'), n(3, 2, 1, 'A'),
            n(2, 0, 1, 'B'), n(2, 1, 1, 'C'), n(2, 3, 1, 'D'), n(1, 0, 1, 'E'),
            n(2, 3, 1, 'D'), n(2, 1, 1, 'C'), n(2, 0, 1, 'B'), n(3, 2, 1, 'A'),
            n(3, 0, 1, 'G'), n(4, 3, 1, 'F'), n(4, 2, 2, 'E'),
          ],
          tip: 'Hear how E–F at the start instantly sounds Spanish? That half-step is the whole secret.',
        },
      },
      { kind: 'chords', ids: ['g', 'f', 'e'] },
      {
        kind: 'exercise',
        ex: {
          title: 'Andalusian cadence: Am – G – F – E',
          tempo: 80,
          countIn: true,
          loop: true,
          cols: [
            n(5, 0, 1, 'Am'), n(3, 2), n(2, 1), n(1, 0),
            n(6, 3, 1, 'G'), n(3, 0), n(2, 0), n(1, 3),
            n(4, 3, 1, 'F'), n(3, 2), n(2, 1), n(1, 1),
            n(6, 0, 1, 'E'), n(3, 1), n(2, 0), n(1, 0),
          ],
          tip: 'F uses the small barre — finger 1 flat across strings 1 and 2. Roll the finger slightly onto its bony edge for a cleaner press.',
        },
      },
      {
        kind: 'tip',
        body: 'Play the cadence near the bridge for a hard flamenco bite, then over the soundhole for a warm serenade. Same notes, two different worlds.',
      },
    ],
    practice: [
      'E Phrygian scale up and down, rest stroke, 3 minutes',
      'Small-barre F: place and arpeggiate 10 times, checking both strings ring',
      'Andalusian cadence on loop until the changes breathe',
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: 'romanza',
    num: 11,
    title: 'Romanza',
    subtitle: 'The opening of the most beloved piece in the classical repertoire',
    minutes: 30,
    goals: [
      'Play melody, harmony and bass at once in a real piece',
      'Keep the a-finger melody singing above the accompaniment',
      'Perform the opening phrase of Romanza (Spanish Romance)',
    ],
    sections: [
      {
        kind: 'text',
        body: 'Romanza (also called Spanish Romance or Románce Anónimo) is the piece that made millions of people fall in love with the classical guitar. The right hand plays a constant a–m–i triplet ripple; the top note of each triplet is the melody, so the a finger must sing while m and i whisper. This arrangement of the opening phrase stays in easy positions.',
      },
      {
        kind: 'list',
        title: 'How it works',
        items: [
          'Every beat: a plays the melody on string 1, then m on string 2, then i on string 3',
          'p adds a bass note at the start of each bar and lets it ring',
          'Left-hand fingers walk down the first string: 7 → 5 → 3 → 2 → 0',
        ],
      },
      {
        kind: 'exercise',
        ex: {
          title: 'The ripple on open strings',
          tempo: 100,
          countIn: true,
          loop: true,
          cols: [
            ch([[6, 0], [1, 0]], 1, 'p+a'), n(2, 0, 1, 'm'), n(3, 0, 1, 'i'),
            n(1, 0, 1, 'a'), n(2, 0, 1, 'm'), n(3, 0, 1, 'i'),
            n(1, 0, 1, 'a'), n(2, 0, 1, 'm'), n(3, 0, 1, 'i'),
          ],
          tip: 'Make the a-finger note clearly louder than m and i — melody above, murmur below.',
        },
      },
      {
        kind: 'exercise',
        ex: {
          title: 'Romanza — opening phrase (adapted)',
          tempo: 108,
          countIn: true,
          cols: [
            // Bar 1 — melody B (fret 7)
            ch([[6, 0], [1, 7]], 1), n(2, 0), n(3, 0),
            n(1, 7), n(2, 0), n(3, 0),
            n(1, 7), n(2, 0), n(3, 0),
            // Bar 2 — melody walks down A, G, F#
            ch([[6, 0], [1, 5]], 1), n(2, 0), n(3, 0),
            n(1, 3), n(2, 0), n(3, 0),
            n(1, 2), n(2, 0), n(3, 0),
            // Bar 3 — melody E
            ch([[6, 0], [1, 0]], 1), n(2, 0), n(3, 0),
            n(1, 0), n(2, 0), n(3, 0),
            n(1, 0), n(2, 0), n(3, 0),
            // Bar 4 — rest on the low E
            ch([[6, 0], [1, 0], [2, 0]], 3),
          ],
          tip: 'Use finger 4 for fret 7, finger 3 for fret 5 — the hand shifts down the neck as the melody falls. Slow is beautiful here.',
        },
      },
      {
        kind: 'tip',
        body: 'You are now playing a three-voice texture from the real repertoire. From here the path continues: the full Romanza, Sor studies, Tárrega’s Lágrima — and everything this course taught you is exactly the technique they need.',
      },
    ],
    practice: [
      'The ripple until a–m–i is automatic and the melody note leads',
      'Left hand alone: 7 → 5 → 3 → 2 → 0 on string 1, smooth shifts',
      'The opening phrase, three beautiful performances in a row',
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function nextLesson(completed: string[]): Lesson {
  return LESSONS.find((l) => !completed.includes(l.id)) ?? LESSONS[LESSONS.length - 1];
}
