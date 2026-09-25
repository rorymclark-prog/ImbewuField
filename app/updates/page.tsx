'use client';

// The full "what changed and when" history. The refresh banner shows at most five lines
// (MAX_SHOWN) because it sits over the map; this page is the place those lines live on
// after the banner moves on — Rory: "perhaps we can have a place for now on the app that
// shows a list of updates and what bugs were solved etc". Content comes straight from
// RELEASE_NOTES, so this page is always exactly as current as the build serving it.

import { useState } from 'react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import MenuButton from '@/components/MenuButton';
import { RELEASE_NOTES } from '@/lib/release-notes';
import { OPEN_UPDATE_GUIDE_EVENT } from '@/lib/update-tour';
import { APP_HEADER_STYLE } from '@/lib/app-header';
import { useAppLevel } from '@/lib/app-level';

// A farmer does not need 150+ dated entries or the git short SHA that used to sit beside each
// one — that is a "should I refresh" note, not a changelog (see lib/release-notes.ts). Simple
// stops at the recent entries; All tools can still reach the rest through one disclosure.
const RECENT_COUNT = 10;

export default function UpdatesPage() {
  const simple = useAppLevel() === 'simple';
  const [showAll, setShowAll] = useState(false);
  const hasOlder = RELEASE_NOTES.length > RECENT_COUNT;
  const entries = showAll && !simple ? RELEASE_NOTES : RELEASE_NOTES.slice(0, RECENT_COUNT);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4"
        style={APP_HEADER_STYLE}
      >
        <MenuButton />
        <BackButton />
        <BrandLogo icon="✦" />
        <div className="w-px h-5" style={{ background: '#E2D8C4', opacity: 0.5 }} />
        <h1 className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>
          What&rsquo;s new
        </h1>
        <div className="flex-1" />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-xs mb-6" style={{ color: '#5C5040' }}>
            Every change that reached the app, newest first — the same notes the refresh
            banner shows, kept here so they don&rsquo;t disappear when the next update lands.
          </p>
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_UPDATE_GUIDE_EVENT))}
            className="mb-6 px-4 rounded-lg font-semibold"
            style={{ minHeight: 44, background: '#1F4D2B', color: '#fff' }}>
            Guide me to recent changes
          </button>

          {entries.map((entry) => (
            <section key={`${entry.when}-${entry.sha ?? ''}`} className="mb-7">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-base font-display font-semibold" style={{ color: '#1F4D2B' }}>
                  {entry.when}
                </h2>
              </div>
              <ul className="space-y-1.5">
                {entry.changes.map((line) => (
                  <li key={line} className="flex gap-2 text-[13px] leading-snug" style={{ color: '#20190F' }}>
                    <span aria-hidden style={{ color: '#1F4D2B' }}>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {!simple && hasOlder && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mb-6 px-4 rounded-lg font-semibold"
              style={{ minHeight: 44, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {showAll ? 'Show fewer updates' : 'Show older updates'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
