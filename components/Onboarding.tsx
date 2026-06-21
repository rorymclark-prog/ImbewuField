'use client';

import { useState } from 'react';
import { APP_LANGS, useLanguage, translate } from '@/lib/i18n';

export default function Onboarding() {
  const { onboarded, completeOnboarding } = useLanguage();
  const [picked, setPicked] = useState('en');

  if (onboarded) return null;
  const tp = (key: string) => translate(picked, key); // preview in the picked language

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,10,6,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border-bright)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

        {/* Hero */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🌿</div>
          <div className="font-display font-bold text-xl text-gradient mb-1">{tp('welcomeTitle')}</div>
          <div className="font-display text-sm" style={{ color: 'var(--text-muted)' }}>{tp('welcomeSub')}</div>
        </div>

        {/* Primary action — prominent, immediately actionable */}
        <button onClick={() => completeOnboarding(picked)}
          className="w-full py-3 rounded-xl text-base font-display font-semibold transition-all mb-5"
          style={{ background: 'linear-gradient(135deg, var(--emerald), var(--teal))', color: '#fff', boxShadow: '0 4px 20px rgba(72,168,100,0.35)' }}>
          {tp('start')} →
        </button>

        {/* Language grid — secondary, clearly labelled */}
        <div className="mb-1 flex items-center gap-2">
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {tp('pickLang')}
          </div>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {APP_LANGS.map((l) => (
            <button key={l.code} onClick={() => setPicked(l.code)}
              className="py-2 px-2 rounded-lg text-xs font-display transition-all"
              style={picked === l.code
                ? { background: 'rgba(72,168,100,0.18)', border: '1px solid rgba(72,168,100,0.5)', color: 'var(--emerald-bright)' }
                : { background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              {l.native}
            </button>
          ))}
        </div>

        {/* Reassurance — language is always changeable */}
        <div className="text-xs font-display text-center" style={{ color: 'var(--text-muted)', opacity: 0.65 }}>
          {tp('pickLangSub')}
        </div>
      </div>
    </div>
  );
}
