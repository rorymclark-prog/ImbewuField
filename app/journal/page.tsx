'use client';

import MyRecords from '@/components/MyRecords';
import TabBar from '@/components/TabBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import LessonLink from '@/components/design/LessonLink';

export default function JournalPage() {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Field Journal</span>
        <div className="flex-1" />
        <LessonLink id="journal:overview" label="Learn" />
        <SettingsButton />
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto" style={{ background: '#E4DCC6' }}>
        <MyRecords />
      </main>

      <TabBar />
    </div>
  );
}
