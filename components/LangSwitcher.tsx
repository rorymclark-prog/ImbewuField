'use client';

import { Globe } from 'lucide-react';
import { APP_LANGS, useLanguage } from '@/lib/i18n';

export default function LangSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="flex items-center gap-1.5 px-3.5 rounded-full flex-shrink-0"
      style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', minHeight: 56 }}>
      <Globe size={18} style={{ color: 'var(--text-secondary)' }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label={t('language')}
        className="font-mono outline-none cursor-pointer"
        style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: 20 }}
      >
        {APP_LANGS.map((l) => (
          <option key={l.code} value={l.code} style={{ background: 'var(--bg-1)', color: 'var(--text-primary)' }}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
