'use client';

import AppHeader from '@/components/layout/AppHeader';
import MelDashboard from '@/components/MelDashboard';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { useLanguage } from '@/lib/i18n';

const tr = (lang: string, en: string, zu: string) => lang === 'zu' ? zu : en;

// Verified bug: this page rendered <MelDashboard /> with no header or tab bar at all — a dead
// end with no way back except the browser's own back button. Every other screen in this area
// (mentor, ngo, funder, surveys) shares this same header shell + TabBar.
export default function AssessmentsPage() {
  const { lang } = useLanguage();
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <AppHeader
        title={tr(lang, 'Assessments', 'Ukuhlola')}
        right={<LessonLink id="assessments:overview" label={tr(lang, 'Learn', 'Funda')} />}
      />
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>
        <MelDashboard />
      </main>
      <TabBar hideAtDesktop />
    </div>
  );
}
