'use client';

import { Globe } from 'lucide-react';
import { APP_LANGS, useLanguage } from '@/lib/i18n';

export default function LangSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1.5 px-3.5 rounded-full flex-shrink-0"
      style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', minHeight: 56 }}>
      <Globe size={18} style={{ color: '#5C5040' }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="App language"
        className="font-mono outline-none cursor-pointer"
        style={{ background: 'transparent', color: '#20190F', border: 'none', fontSize: 20 }}
      >
        {APP_LANGS.map((l) => (
          <option key={l.code} value={l.code} style={{ background: '#FFFEFA', color: '#20190F' }}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
