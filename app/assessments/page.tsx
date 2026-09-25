'use client';

import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import MelDashboard from '@/components/MelDashboard';
import MenuButton from '@/components/MenuButton';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { useLanguage } from '@/lib/i18n';
import { APP_HEADER_STYLE } from '@/lib/app-header';

const tr = (lang: string, en: string, zu: string) => lang === 'zu' ? zu : en;

// Verified bug: this page rendered <MelDashboard /> with no header or tab bar at all — a dead
// end with no way back except the browser's own back button. Every other screen in this area
// (mentor, ngo, funder, surveys) shares this same header shell + TabBar.
export default function AssessmentsPage() {
  const { lang } = useLanguage();
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={APP_HEADER_STYLE}>
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: 'var(--text-secondary)' }}>{tr(lang, 'Assessments', 'Ukuhlola')}</span>
        <div className="flex-1" />
        <LessonLink id="assessments:overview" label={tr(lang, 'Learn', 'Funda')} />
        <SettingsButton />
      </header>
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>
        <MelDashboard />
      </main>
      <TabBar />
    </div>
  );
}
