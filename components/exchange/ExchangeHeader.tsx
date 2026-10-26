'use client';

import AppHeader from '@/components/layout/AppHeader';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { EX } from './theme';

// w19-01: the shared AppHeader (brand, Back, burger, Settings, desktop nav) with the page title
// as a real t-h1 below it, as /journal does. The old bespoke 56px bar had no brand or Settings.
export default function ExchangeHeader() {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const simple = useAppLevel() === 'simple';
  const title = zu ? 'Ukuhwebelana kwabalimi' : 'Farmer exchange';
  return (
    <>
      <AppHeader
        title={title}
        right={<>
          {/* The "preview · demonstration records" badge is staff-facing shop talk — Simple leaves
             it out; the sample-data notice on the board itself already says the same thing in
             plain words for every reader. */}
          {!simple && (
            <span className="hidden sm:block" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: EX.amberText, whiteSpace: 'nowrap' }}>
              {zu ? 'umbukiso · amarekhodi okubonisa' : 'preview · demonstration records'}
            </span>
          )}
        </>}
      />
      <div className="px-4 pt-4 sm:px-6" style={{ minWidth: 0 }}>
        <h1 className="t-h1" style={{ color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
        <p className="font-sans" style={{ fontSize: 14, color: EX.faint, margin: '2px 0 0', lineHeight: 1.35 }}>{zu ? 'Imbewu, izithombo, okusalile namathuluzi — phakathi kwabalimi' : 'Seed, seedlings, surplus and tools — between farmers'}</p>
      </div>
    </>
  );
}
