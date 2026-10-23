'use client';

import FieldJournal from '@/components/journal/FieldJournal';
import TabBar from '@/components/TabBar';
import LimaBar from '@/components/LimaBar';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';
import { useLanguage } from '@/lib/i18n';

export default function JournalPage() {
  const { lang, t } = useLanguage();
  const isZulu = lang === 'zu';
  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] lg:h-auto lg:min-h-0 lg:overflow-visible" style={{ background: 'var(--bg-0)' }}>
      {/* Header */}
      <AppHeader
        title={t('navFieldJournal')}
        right={<LessonLink id="journal:overview" label={isZulu ? 'Funda' : 'Learn'} />}
      />
      {/* nav-17: AppHeader's title is a <span>, not a heading — this page needs its own
          real, visible <h1> now that the old header's h1 is gone. */}
      <h1 className="t-h1 px-3 sm:px-4 pt-3 m-0" style={{ color: 'var(--text-primary)' }}>
        {t('navFieldJournal')}
      </h1>

      {/* Body — the dated record of what actually happened on the land. Harvest
          weights and sales stay in /records and /finances, where the ledger, the
          harvest reconciliation and the CSV export already live. */}
      <main className="flex-1 overflow-y-auto lg:flex-none lg:overflow-visible" style={{ background: 'var(--bg-0)' }}>
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
