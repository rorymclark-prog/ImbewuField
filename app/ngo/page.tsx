'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { LayoutDashboard, Inbox } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';
import ContactInbox from '@/components/ContactInbox';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
      <span className="text-sm font-display">Loading dashboard...</span>
    </div>
  ),
});

export default function NgoPage() {
  const [view, setView] = useState<'dashboard' | 'messages'>('dashboard');
  const [msgUnread, setMsgUnread] = useState(0);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>NGO · programme overview</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--gold)' }}>demo data</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="ngo" />
      </header>

      {/* Tab strip */}
      <div className="flex-shrink-0 flex" style={{ background: '#FBF6EC', borderBottom: '1px solid #E2D8C4', paddingLeft: 16, paddingRight: 16 }}>
        {([
          { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: 0 },
          { key: 'messages',  label: 'Messages',  icon: Inbox,          badge: msgUnread },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="flex items-center gap-1.5 py-2.5 px-3 font-display text-xs font-semibold"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: view === key ? '#1F4D2B' : '#8C7A62',
              borderBottom: view === key ? '2px solid #1F4D2B' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={13} />
            {label}
            {badge != null && badge > 0 && (
              <span className="flex items-center justify-center rounded-full font-mono"
                style={{ minWidth: 16, height: 16, fontSize: 9, padding: '0 4px', background: '#1F4D2B', color: '#F7F2E9' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'dashboard' ? (
        <div className="flex-1 flex overflow-hidden">
          <NgoDashboard />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: 80 }}>
          <ContactInbox recipient="organisation" onUnreadCount={setMsgUnread} />
        </div>
      )}

      <TabBar />
    </div>
  );
}
