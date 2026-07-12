import type { Metadata } from 'next';
import GuitarNav from '@/components/guitar/GuitarNav';

export const metadata: Metadata = {
  title: 'Guitar Studio — learn nylon-string guitar',
  description:
    'A step-by-step nylon-string (classical) guitar course: interactive lessons with playable tab, a chromatic tuner, metronome and chord library — all in the browser.',
};

// The root layout locks the body to the viewport, so this section provides
// its own scroll container.
export default function GuitarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-paper">
      <GuitarNav />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:pt-8">{children}</main>
    </div>
  );
}
