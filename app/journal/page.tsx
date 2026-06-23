'use client';

import MyRecords from '@/components/MyRecords';
import TabBar from '@/components/TabBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import { BookOpen } from 'lucide-react';

export default function JournalPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: '#F7F2E9',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#FBF6EC',
          borderBottom: '1px solid #E2D8C4',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color="#5C5040" strokeWidth={1.6} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              color: '#5C5040',
              lineHeight: 1,
            }}
          >
            Field Journal
          </span>
        </div>
        <SettingsButton />
      </header>

      {/* Body */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#F7F2E9',
        }}
      >
        <MyRecords />
      </main>

      {/* Tab Bar */}
      <TabBar />
    </div>
  );
}
