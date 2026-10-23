'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage, translate } from '@/lib/i18n';

/**
 * zu-04: the ONE shared "this isiZulu wording is an unreviewed draft" notice, replacing the
 * inconsistent per-page notes audited across Home, /farmer, /student, /records, /login and
 * /prices — English-first on Home, three lines sat inside a button or a header pill on /farmer,
 * three sentences on /student, a different ochre-box style on /login and /prices.
 *
 * isiZulu sentence first, short; the English source is a collapsed <details> toggle, never
 * inline. Render once per page, directly under the header — never inside a button, card or pill,
 * so it cannot turn a nav pill into two lines or pad out an accordion label. Dismissible per page
 * for the session (sessionStorage), so returning to the same page later in a fresh tab shows it
 * again rather than hiding it forever after one tap.
 */
export default function LanguageDraftNote({ lang, scope }: { lang: string; scope: string }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `imbewu_lang_draft_dismissed_${scope}`;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === '1') setDismissed(true);
    } catch { /* sessionStorage unavailable (private browsing); the note just stays visible */ }
  }, [storageKey]);

  if (lang !== 'zu' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* dismissal only lasts this render */ }
  };

  return (
    <div
      role="note"
      className="rounded-xl px-3 py-2 font-sans"
      style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)', background: 'var(--bg-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p lang="zu" style={{ margin: 0 }}>{t('languageDraftNoticeText')}</p>
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
        <p lang="en" style={{ margin: '4px 0 0' }}>{translate('en', 'languageDraftNoticeEnglishText')}</p>
      </details>
    </div>
  );
}
