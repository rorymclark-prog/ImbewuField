'use client';

import { APP_LANGS, useLanguage } from '@/lib/i18n';

export default function LangSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-full flex-shrink-0"
      style={{ background: 'rgba(22,37,20,0.6)', border: '1px solid var(--border)' }}>
      <span className="text-base" style={{ opacity: 0.7 }}>🌍</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="App language"
        className="text-sm font-mono outline-none cursor-pointer"
        style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}
      >
        {APP_LANGS.map((l) => (
          <option key={l.code} value={l.code} style={{ background: 'var(--bg-2)', color: 'var(--text-primary)' }}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
