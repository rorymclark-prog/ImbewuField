'use client';

// The full "what changed and when" history. The refresh banner shows at most five lines
// (MAX_SHOWN) because it sits over the map; this page is the place those lines live on
// after the banner moves on — Rory: "perhaps we can have a place for now on the app that
// shows a list of updates and what bugs were solved etc". Content comes straight from
// RELEASE_NOTES, so this page is always exactly as current as the build serving it.

import { useEffect, useState } from 'react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import MenuButton from '@/components/MenuButton';
import { RELEASE_NOTES } from '@/lib/release-notes';

export default function UpdatesPage() {
  // The sha of the build the reader is LOOKING AT — fetched, not imported, so a stale
  // installed PWA shows its own (old) build id rather than pretending to be current.
  const [buildSha, setBuildSha] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/build-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => { if (info?.sha) setBuildSha(String(info.sha)); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <MenuButton />
        <BackButton />
        <BrandLogo icon="✦" />
        <div className="w-px h-5" style={{ background: '#E2D8C4', opacity: 0.5 }} />
        <h1 className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>
          What&rsquo;s new
        </h1>
        <div className="flex-1" />
        {buildSha && (
          <span className="text-[11px] font-mono" style={{ color: '#9A8268' }}>
            build {buildSha}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-xs mb-6" style={{ color: '#5C5040' }}>
            Every change that reached the app, newest first — the same notes the refresh
            banner shows, kept here so they don&rsquo;t disappear when the next update lands.
          </p>

          {RELEASE_NOTES.map((entry) => (
            <section key={`${entry.when}-${entry.sha ?? ''}`} className="mb-7">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-base font-display font-semibold" style={{ color: '#1F4D2B' }}>
                  {entry.when}
                </h2>
                {entry.sha && (
                  <span className="text-[10px] font-mono" style={{ color: '#9A8268' }}>
                    {entry.sha}
                  </span>
                )}
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
        </div>
      </main>
    </div>
  );
}
