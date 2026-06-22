'use client';

import RoleSwitcher from './RoleSwitcher';
import BackButton from './BackButton';
import SettingsButton from './SettingsButton';
import BrandLogo from './BrandLogo';

interface Props {
  role: string;          // RoleSwitcher key, e.g. 'trainer'
  icon: string;
  title: string;         // e.g. 'Trainer app'
  subtitle: string;      // header subtitle
  blurb: string;
  features: { icon: string; label: string }[];
}

export default function RolePlaceholder({ role, icon, title, subtitle, blurb, features }: Props) {
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: 'linear-gradient(180deg, rgba(14,28,13,0.98), rgba(10,21,9,0.95))', borderBottom: '1px solid var(--border)' }}>
        <BackButton />
        <BrandLogo icon={icon} />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#cfe0cd' }}>{subtitle}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--gold)' }}>coming in the pilot</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current={role} />
      </header>

      {/* overflow-y-auto on the outer, min-h-full on the inner so the card centres when it
          fits but can scroll when it's taller than the screen (centring alone would clip it). */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl p-7 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-bright)' }}>
          <div className="text-4xl mb-3">{icon}</div>
          <h1 className="font-display font-bold text-2xl text-gradient mb-2">{title}</h1>
          <p className="font-display text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>{blurb}</p>
          <div className="grid grid-cols-1 gap-2 text-left">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <span className="text-lg flex-shrink-0">{f.icon}</span>
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
    </div>
  );
}
