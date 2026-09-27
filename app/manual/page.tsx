'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ManualHeader from '@/components/manual/ManualHeader';
import { useLanguage } from '@/lib/i18n';
import { MANUAL_LANGS, MANUAL_LANG_NAMES, isManualLang, manualUi } from '@/lib/manual';

// Entry point from the menu. The chapters are static per-language pages (/manual/<lang>/…), and the
// farmer's language only exists in the browser, so this one small client page sends her straight
// to her own language's contents — or, if the app is set to a language the manual is not written
// in yet, lets her pick one.

export default function ManualEntryPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const ui = manualUi(isManualLang(lang) ? lang : 'en');

  useEffect(() => {
    if (isManualLang(lang)) router.replace(`/manual/${lang}`);
  }, [lang, router]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-0)' }}>
      <ManualHeader fallback="/home" label={ui.title} />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
        <h1 className="font-display" style={{ fontSize: 'clamp(28px, 2.4vw + 18px, 40px)', lineHeight: 1.15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {ui.title}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 20px' }}>{ui.subtitle}</p>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>{ui.language}</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {MANUAL_LANGS.map((code) => (
            <li key={code}>
              <Link href={`/manual/${code}`} lang={code} style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '12px 16px', borderRadius: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>
                {MANUAL_LANG_NAMES[code]}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
