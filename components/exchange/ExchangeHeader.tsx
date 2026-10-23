'use client';

import { Handshake } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { EX } from './theme';

export default function ExchangeHeader() {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const simple = useAppLevel() === 'simple';
  return (
    <header className="flex items-center gap-3 px-4" style={{ height: 56, borderBottom: `1px solid ${EX.border}`, background: EX.card }}>
      <MenuButton /><BackButton fallback="/home" />
      <Handshake size={17} aria-hidden style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <h1 className="t-h1" style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>{zu ? 'Ukuhwebelana kwabalimi' : 'Farmer exchange'}</h1>
        <p className="font-sans hidden sm:block" style={{ fontSize: 12, color: EX.faint, margin: 0, lineHeight: 1.3 }}>{zu ? 'Imbewu, izithombo, okusalile namathuluzi — phakathi kwabalimi' : 'Seed, seedlings, surplus and tools — between farmers'}</p>
      </div>
      <div style={{ flex: 1 }} />
      {/* The "preview · demonstration records" badge is staff-facing shop talk — Simple leaves
          it out; the sample-data notice on the board itself already says the same thing in
          plain words for every reader. */}
      {!simple && (
        <span className="hidden sm:block" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: EX.amberText, whiteSpace: 'nowrap' }}>
          {zu ? 'umbukiso · amarekhodi okubonisa' : 'preview · demonstration records'}
        </span>
      )}
    </header>
  );
}
