import type { Metadata } from 'next';
import Metronome from '@/components/guitar/Metronome';

export const metadata: Metadata = {
  title: 'Metronome — Guitar Studio',
  description: 'A clean Web Audio metronome with accented downbeats, tap tempo and common time signatures.',
};

export default function MetronomePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-semibold text-ink">Metronome</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Steady beats beat fast fingers. Practise new material well below performance tempo and
          only speed up when three repetitions in a row are clean.
        </p>
      </header>
      <Metronome />
      <p className="text-xs leading-relaxed text-ink-faint">
        Tip: the higher click marks beat one. For the waltz patterns in Lesson 7, switch to 3/4 and
        lean into that first beat.
      </p>
    </div>
  );
}
