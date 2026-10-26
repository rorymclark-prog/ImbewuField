'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { APP_LANGS, translate, useLanguage } from '@/lib/i18n';

/**
 * zu-04: the ONE shared "this isiZulu wording is an unreviewed draft" notice, replacing the
 * inconsistent per-page notes audited across Home, /farmer, /student, /records, /login and
 * /prices — English-first on Home, three lines sat inside a button or a header pill on /farmer,
 * three sentences on /student, a different ochre-box style on /login and /prices.
 *
 * The selected language comes first; the English source is a collapsed <details> toggle, never
 * inline. Render once per page, directly under the header — never inside a button, card or pill,
 * so it cannot turn a nav pill into two lines or pad out an accordion label. Dismissible per page
 * for the session (sessionStorage), so returning to the same page later in a fresh tab shows it
 * again rather than hiding it forever after one tap.
 *
 * isiXhosa joined isiZulu as a labelled machine-draft language (the full UI dictionary was
 * drafted in one pass, unreviewed). Its English source line is the same sentence with the
 * language name swapped (from APP_LANGS), so lib/i18n.tsx does not need a second copy of it.
 */
export default function LanguageDraftNote({ lang, scope }: { lang: string; scope: string }) {
  const { setLang } = useLanguage();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  // Dismissing isiZulu must not hide the warning after switching to a different draft language.
  const storageKey = `imbewu_lang_draft_dismissed_${scope}_${lang}`;
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    try {
      setDismissedKey(sessionStorage.getItem(storageKey) === '1' ? storageKey : null);
    } catch { /* sessionStorage unavailable (private browsing); the note just stays visible */ }
  }, [storageKey]);

  // isiXhosa is an unreviewed machine draft too, so it carries the same notice.
  if ((lang !== 'xh' && !['zu', 'st', 'ts', 've'].includes(lang)) || dismissedKey === storageKey) return null;

  const dismiss = () => {
    setDismissedKey(storageKey);
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* dismissal only lasts this render */ }
  };

  return (
    <div
      role="note"
      className="rounded-xl px-3 py-2 font-sans"
      style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)', background: 'var(--bg-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p lang={lang} style={{ margin: 0 }}>{t('languageDraftNoticeText')}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('languageDraftNoticeDismiss')}
          className="flex items-center justify-center flex-shrink-0 rounded-md"
          style={{ width: 24, height: 24, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
      <details className="mt-1">
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>{t('languageDraftNoticeEnglishToggle')}</summary>
        <p lang="en" style={{ margin: '4px 0 0' }}>{translate('en', 'languageDraftNoticeEnglishText').replace('isiZulu', APP_LANGS.find((locale) => locale.code === lang)?.label ?? lang)}</p>
        <button type="button" onClick={() => setLang('en')} className="min-h-11 underline">
          {t('languageDraftNoticeEnglishToggle')}
        </button>
      </details>
    </div>
  );
}
