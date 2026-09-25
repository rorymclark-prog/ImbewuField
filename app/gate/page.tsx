'use client';

import { useState } from 'react';
import BackButton from '@/components/BackButton';
import { ArrowRight } from 'lucide-react';
import { translate, useLanguage } from '@/lib/i18n';

export default function GatePage() {
  const { t, lang } = useLanguage();
  const gateText = (key: string) => lang === 'zu' ? `${t(key)} · ${translate('en', key)}` : t(key);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get('from') || '/home';
      } else { setError(true); setLoading(false); }
    } catch { setError(true); setLoading(false); }
  }

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(32,25,15,0.10)' }}>
        <BackButton fallback="/partners" /><div className="text-center mb-5">
          {/* Lima icon */}
          <div className="flex items-center justify-center mb-3">
            <div style={{ width: 44, height: 44, background: 'var(--color-forest-800)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/>
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
              </svg>
            </div>
          </div>
          <h1 className="font-display font-bold" style={{ margin: 0, fontSize: 22, color: 'var(--color-ink)', letterSpacing: '-0.02em', marginBottom: 4 }}>ImbewuField</h1>
          <div className="font-sans text-sm" style={{ color: 'var(--color-muted-strong)' }}>{t('gateDescription')}</div>
        </div>
        {lang === 'zu' && <p role="note" className="rounded-xl px-3 py-2 mb-3 font-sans" style={{ fontSize: 12, lineHeight: 1.45, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: 'var(--color-ochre)' }}>{t('gateZuluDraftNotice')}</p>}
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder={gateText('gatePassword')}
          aria-label={gateText('gatePassword')}
          className="w-full font-sans rounded-lg px-3 py-2.5 outline-none mb-2"
          style={{ background: 'var(--color-surface)', border: `1px solid ${error ? 'var(--color-ochre-light)' : 'var(--border)'}`, color: 'var(--color-ink)', fontSize: 16 }}
        />
        {error && <p className="font-sans mb-2" role="alert" style={{ fontSize: 13, color: 'var(--gold-dim)' }}>{gateText('gateWrongPassword')}</p>}
        <button type="submit" disabled={loading || !password}
          className="w-full py-2.5 rounded-xl font-sans font-semibold transition-all"
          style={loading
            ? { background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--color-ink-faint)', fontSize: 15 }
            : { background: 'var(--color-forest-800)', color: 'var(--color-canvas)', fontSize: 15, opacity: !password ? 0.5 : 1 }}>
          {loading ? gateText('gateChecking') : <span className="flex items-center justify-center gap-1.5">{gateText('gateEnter')}<ArrowRight size={15} /></span>}
        </button>
      </form>
    </div>
  );
}
