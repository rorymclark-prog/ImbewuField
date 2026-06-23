'use client';

import type { ElementType } from 'react';
import RoleSwitcher from './RoleSwitcher';
import BackButton from './BackButton';
import SettingsButton from './SettingsButton';
import BrandLogo from './BrandLogo';
import TabBar from './TabBar';

interface Props {
  role: string;
  Icon: ElementType;
  title: string;
  subtitle: string;
  blurb: string;
  features: { Icon: ElementType; label: string }[];
}

export default function RolePlaceholder({ role, Icon, title, subtitle, blurb, features }: Props) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>{subtitle}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--gold)' }}>coming in the pilot</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current={role} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl p-7 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-bright)' }}>
          <div className="flex justify-center mb-3">
            <div className="flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, background: 'rgba(31,77,43,0.10)', color: '#1F4D2B' }}>
              <Icon size={28} strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="font-display font-bold text-2xl text-gradient mb-2">{title}</h1>
          <p className="font-display text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>{blurb}</p>
          <div className="grid grid-cols-1 gap-2 text-left">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="flex-shrink-0" style={{ color: '#5C5040' }}>
                  <f.Icon size={16} strokeWidth={1.6} />
                </div>
                <span className="font-display text-sm" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-mono mt-6" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            Built once the NGO pilot is funded · part of the ImbewuField suite
          </p>
        </div>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
