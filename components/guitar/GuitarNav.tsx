'use client';

// Header navigation for the Guitar Studio section.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Guitar, BookOpen, Music, Mic, Timer } from 'lucide-react';

const LINKS = [
  { href: '/guitar', label: 'Lessons', icon: BookOpen, exactish: true },
  { href: '/guitar/chords', label: 'Chords', icon: Music },
  { href: '/guitar/tuner', label: 'Tuner', icon: Mic },
  { href: '/guitar/metronome', label: 'Metronome', icon: Timer },
];

export default function GuitarNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:gap-4">
        <Link href="/guitar" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-forest text-white">
            <Guitar size={17} />
          </span>
          <span className="hidden font-display text-lg font-semibold text-ink sm:block">Guitar Studio</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Guitar studio">
          {LINKS.map(({ href, label, icon: Icon, exactish }) => {
            const active = exactish
              ? pathname === href || pathname.startsWith('/guitar/lessons')
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ' +
                  (active ? 'bg-forest text-white' : 'text-ink-muted hover:bg-card hover:text-ink')
                }
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
