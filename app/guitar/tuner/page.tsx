import type { Metadata } from 'next';
import Tuner from '@/components/guitar/Tuner';

export const metadata: Metadata = {
  title: 'Tuner — Guitar Studio',
  description: 'Chromatic guitar tuner: microphone pitch detection plus reference tones for every open string.',
};

export default function TunerPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-semibold text-ink">Tuner</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Standard tuning, thick to thin: E–A–D–G–B–E. Pluck one string at a time near the
          soundhole and let it ring while you watch the needle.
        </p>
      </header>
      <Tuner />
    </div>
  );
}
