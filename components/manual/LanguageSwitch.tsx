import Link from 'next/link';
import { MANUAL_LANGS, MANUAL_LANG_NAMES, type ManualLang } from '@/lib/manual';

/** One link per manual language; `hrefFor` decides whether it lands on contents or this chapter. */
export default function LanguageSwitch({ current, label, hrefFor }: { current: ManualLang; label: string; hrefFor: (lang: ManualLang) => string }) {
  return (
    <nav aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 20px' }}>
      {MANUAL_LANGS.map((code) => {
        const active = code === current;
        return (
          <Link
            key={code}
            href={hrefFor(code)}
            lang={code}
            aria-current={active ? 'true' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 14px',
              borderRadius: 999, fontSize: 15, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? 'var(--emerald)' : 'var(--border)'}`,
              background: active ? 'var(--bg-2)' : 'var(--bg-1)', color: 'var(--text-primary)',
            }}
          >
            {MANUAL_LANG_NAMES[code]}
          </Link>
        );
      })}
    </nav>
  );
}
