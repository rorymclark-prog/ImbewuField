'use client';

import { useEffect, useRef } from 'react';
import FieldJournal from '@/components/journal/FieldJournal';
import TabBar from '@/components/TabBar';
import LimaBar from '@/components/LimaBar';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';
import { useLanguage } from '@/lib/i18n';

export default function JournalPage() {
  const { lang, t } = useLanguage();
  const isZulu = lang === 'zu';
  const scrollRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = scrollRef.current;
    if (!main) return;
    // The sticky rail must fit the space left by the header and help bar, including
    // their translated or enlarged text. The full viewport is taller than that space.
    const measure = () => main.style.setProperty('--journal-scroll-height', `${main.clientHeight}px`);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(main);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return (
    <div className="flex flex-col overflow-hidden h-[100dvh]" style={{ background: 'var(--bg-0)' }}>
      {/* Header */}
      <AppHeader
        title=""
        right={<LessonLink id="journal:overview" label={isZulu ? 'Funda' : 'Learn'} />}
      />
      {/* w19-08: the h1 below is the one title; the header no longer repeats it. */}
      {/* nav-17: AppHeader's title is a <span>, not a heading — this page needs its own
          real, visible <h1> now that the old header's h1 is gone. */}
      <h1 className="t-h1 px-3 sm:px-4 pt-3 m-0" style={{ color: 'var(--text-primary)' }}>
        {t('navFieldJournal')}
      </h1>

      {/* Body — the dated record of what actually happened on the land. Harvest
          weights and sales stay in /records and /finances, where the ledger, the
          harvest reconciliation and the CSV export already live. */}
      {/* The app body clips to the viewport. Keep one scrolling region at desktop too,
          or later notes and the saved-photo dates become unreachable below the screen. */}
      <main ref={scrollRef} className="journal-narrow-sidebar flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--bg-0)' }}>
        <FieldJournal />
      </main>

      {/* Lima in the document flow, not floating over the page. The draggable FAB was measured
          covering real content on every one of these screens — on /cropplan it sat on a task
          row's "Mark done" checkbox, a tap target. components/ChatWidget.tsx excludes these
          routes; this strip is the help it owes them, the same swap /student and /home already
          made. */}
      <LimaBar />

      <TabBar hideAtDesktop />
    </div>
  );
}
