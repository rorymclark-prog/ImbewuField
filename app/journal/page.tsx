'use client';

import FieldJournal from '@/components/journal/FieldJournal';
import TabBar from '@/components/TabBar';
import LimaBar from '@/components/LimaBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import BackButton from '@/components/BackButton';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import { useLanguage } from '@/lib/i18n';

export default function JournalPage() {
  const { lang } = useLanguage();
  const isZulu = lang === 'zu';
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      {/* Header */}
      {/* The in-header BackButton is what keeps the global floating back pill
          away (see lib/back-routes.ts and components/BackControl): without it
          the pill rendered on top of the brand logo and clipped the title, so
          the page read "ield Journal". Suppressing the pill instead would
          strand the page — tests/back-control.test.ts defends that. */}
      <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <h1 className="text-xs font-display truncate min-w-0 m-0" style={{ color: 'var(--text-secondary)' }}>{isZulu ? 'Ijenali Yasensimini' : 'Field Journal'}</h1>
        <div className="flex-1" />
        <LessonLink id="journal:overview" label={isZulu ? 'Funda' : 'Learn'} />
        <SettingsButton />
      </header>

      {/* Body — the dated record of what actually happened on the land. Harvest
          weights and sales stay in /records and /finances, where the ledger, the
          harvest reconciliation and the CSV export already live. */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-0)' }}>
        <FieldJournal />
      </main>

      {/* Lima in the document flow, not floating over the page. The draggable FAB was measured
          covering real content on every one of these screens — on /cropplan it sat on a task
          row's "Mark done" checkbox, a tap target. components/ChatWidget.tsx excludes these
          routes; this strip is the help it owes them, the same swap /student and /home already
          made. */}
      <LimaBar />

      <TabBar />
    </div>
  );
}
