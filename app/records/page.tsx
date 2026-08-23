'use client';

import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import LessonLink from '@/components/design/LessonLink';
import MyRecords from '@/components/MyRecords';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import MenuButton from '@/components/MenuButton';

export default function RecordsPage() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: '#E4DCC6' }}
    >
      <header
        className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>My Records</span>
        <div className="flex-1" />
        <LessonLink id="finance:overview" label="Learn" />
        <SettingsButton />
      </header>

      {/* Harvest and sales are farmer records. A map is useful for choosing land,
          but it adds no context to crop weights and leaves the actual form squeezed
          into a side panel — exactly what Rory found from Finance. */}
      <main className="flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-5">
        <div
          className="max-w-3xl mx-auto rounded-2xl"
          style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
        >
          <MyRecords />
        </div>
      </main>

      <TabBar />
    </div>
  );
}
