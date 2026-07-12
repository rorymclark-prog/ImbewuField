'use client';

// Chord library: every shape used in the course, grouped by difficulty,
// each one playable with a tap.

import { Music } from 'lucide-react';
import { CHORDS } from '@/lib/guitar/chords';
import ChordDiagram from '@/components/guitar/ChordDiagram';

const GROUPS: { level: (typeof CHORDS)[number]['level']; title: string; blurb: string }[] = [
  {
    level: 'first chords',
    title: 'First chords',
    blurb: 'Start here — these four shapes unlock Lesson 8 and thousands of songs.',
  },
  {
    level: 'core',
    title: 'Core open chords',
    blurb: 'The everyday vocabulary of the open position.',
  },
  {
    level: 'stretch',
    title: 'Stretch goals',
    blurb: 'A four-finger chord and your first barre. Worth every minute.',
  },
];

export default function ChordsPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="flex items-center gap-2.5 font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-semibold text-ink">
          <Music size={26} className="text-forest" /> Chord library
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          Tap any chord to hear it arpeggiated from bass to treble — the way classical players
          usually voice chords. Numbers show which left-hand finger to use; a circle above the nut
          means play the string open, a cross means don’t play it.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.level}>
          <h2 className="font-display text-xl font-semibold text-ink">{group.title}</h2>
          <p className="mb-4 mt-1 text-sm text-ink-muted">{group.blurb}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {CHORDS.filter((c) => c.level === group.level).map((chord) => (
              <div key={chord.id} className="flex flex-col">
                <ChordDiagram chord={chord} compact />
                <p className="mt-1.5 px-1 text-xs leading-relaxed text-ink-muted">{chord.tip}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
