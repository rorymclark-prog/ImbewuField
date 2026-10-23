'use client';

// The full "what changed and when" history. The refresh banner shows at most five lines
// (MAX_SHOWN) because it sits over the map; this page is the place those lines live on
// after the banner moves on — Rory: "perhaps we can have a place for now on the app that
// shows a list of updates and what bugs were solved etc". Content comes straight from
// RELEASE_NOTES, so this page is always exactly as current as the build serving it.

import { useState } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import { RELEASE_NOTES } from '@/lib/release-notes';
import { OPEN_UPDATE_GUIDE_EVENT } from '@/lib/update-tour';
import { useAppLevel } from '@/lib/app-level';

// A farmer does not need 150+ dated entries or the git short SHA that used to sit beside each
// one — that is a "should I refresh" note, not a changelog (see lib/release-notes.ts). Simple
// stops at the recent days; All tools can still reach the rest through one disclosure.
//
// ux-09 / nav-09: RELEASE_NOTES carries one entry per commit, so the same calendar day repeats
// as a heading several times in a row. Group entries by `when` here (never in
// lib/release-notes.ts, which this track does not edit) so each day prints one heading.
interface DayGroup { when: string; changes: string[]; }
function groupNotesByDay(notes: typeof RELEASE_NOTES): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const note of notes) {
    const last = groups[groups.length - 1];
    if (last && last.when === note.when) {
      last.changes.push(...note.changes);
    } else {
      groups.push({ when: note.when, changes: [...note.changes] });
    }
  }
  return groups;
}
// Long internal lines read shorter as their first sentence (split at the first '. ').
function firstSentence(line: string): string {
  const i = line.indexOf('. ');
  return i > 0 ? line.slice(0, i + 1) : line;
}
const RECENT_DAYS_SIMPLE = 3;
const RECENT_DAYS_ALL = 5;

export default function UpdatesPage() {
  const simple = useAppLevel() === 'simple';
  const [showAll, setShowAll] = useState(false);
  const dayGroups = groupNotesByDay(RELEASE_NOTES);
  const recentDays = simple ? RECENT_DAYS_SIMPLE : RECENT_DAYS_ALL;
  const hasOlder = dayGroups.length > recentDays;
  const visibleDays = showAll ? dayGroups : dayGroups.slice(0, recentDays);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <AppHeader title={'What’s new'} backFallback="/home" />

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--lima-fab-clearance, 96px)' }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* nav-17: AppHeader's title is a <span>, not a heading — this page needs its own
              real <h1> now that the old header's h1 is gone. */}
          <h1 className="t-h1 m-0 mb-4" style={{ color: 'var(--text-primary)' }}>
            What&rsquo;s new
          </h1>
          <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
            Every change that reached the app, newest first — the same notes the refresh
            banner shows, kept here so they don&rsquo;t disappear when the next update lands.
          </p>
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_UPDATE_GUIDE_EVENT))}
            className="mb-6 px-4 rounded-lg font-semibold"
            style={{ minHeight: 44, background: 'var(--color-forest-800)', color: 'var(--on-forest-800)' }}>
            Guide me to recent changes
          </button>

          {visibleDays.map((day) => (
            <section key={day.when} className="mb-7">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="t-h2" style={{ color: 'var(--color-forest-800)' }}>
                  {day.when}
                </h2>
              </div>
              <ul className="space-y-1.5">
                {day.changes.map((line, i) => (
                  <li key={`${day.when}-${i}`} className="flex gap-2 text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                    <span aria-hidden style={{ color: 'var(--color-forest-800)' }}>•</span>
                    <span>{firstSentence(line)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {hasOlder && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mb-6 px-4 rounded-lg font-semibold"
              style={{ minHeight: 44, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {showAll ? 'Show fewer' : 'Show more'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
