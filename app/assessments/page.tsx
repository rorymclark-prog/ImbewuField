'use client';

import AppHeader from '@/components/layout/AppHeader';
import MelDashboard from '@/components/MelDashboard';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

const tr = (lang: string, en: string, zu: string) => inlineText(lang, en, zu);

// Verified bug: this page rendered <MelDashboard /> with no header or tab bar at all — a dead
// end with no way back except the browser's own back button. Every other screen in this area
// (mentor, ngo, funder, surveys) shares this same header shell + TabBar.
export default function AssessmentsPage() {
  const { lang } = useLanguage();
  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] lg:h-auto lg:min-h-0 lg:overflow-visible" style={{ background: 'var(--bg-0)' }}>
      <AppHeader
        title={tr(lang, 'Assessments', 'Ukuhlola')}
        right={<LessonLink id="assessments:overview" label={tr(lang, 'Learn', 'Funda')} />}
      />
      <main className="flex-1 overflow-y-auto lg:flex-none lg:overflow-visible" style={{ paddingBottom: 'var(--lima-fab-clearance, 96px)' }}>
        <MelDashboard />
      </main>
      <TabBar hideAtDesktop />
    </div>
  );
}
