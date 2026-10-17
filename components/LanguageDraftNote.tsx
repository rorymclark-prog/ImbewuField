'use client';

import { useState } from 'react';

/**
 * zu-04: one shared "this isiZulu text is an unreviewed draft" notice.
 *
 * Before this, each screen rolled its own: /home led with the English sentence then repeated it
 * in isiZulu; /farmer's site-report buried the note inside a clickable button (turning a one-line
 * accordion toggle into three) and again inside the Lima read-out's running paragraph; /login and
 * /prices used a third, ochre-box style. None of them agreed on what came first or how much space
 * the English source took.
 *
 * The rule here: the isiZulu sentence leads, short; the English source is one tap away, never
 * shown by default. Render this ONCE per screen, under the header — never inside a button, a card
 * someone might tap for something else, or a header pill. Nothing renders in any language but
 * isiZulu (and, like the rest of the app's regional-draft notes, no fluent-speaker review has
 * happened yet for this text).
 */
export default function LanguageDraftNote({
  lang,
  zulu,
  english,
  className = '',
}: {
  lang: string;
  /** The isiZulu draft sentence, shown first. */
  zulu: string;
  /** The reviewed English this isiZulu text was drafted from. */
  english: string;
  className?: string;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  if (lang !== 'zu') return null;

  return (
    <p
      role="note"
      className={`font-sans rounded-xl px-3 py-2 ${className}`}
      style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)', background: 'var(--bg-1)', border: '1px solid var(--border)' }}
    >
      <span lang="zu">{zulu}</span>
      {' '}
      <button
        type="button"
        onClick={() => setShowEnglish((v) => !v)}
        aria-expanded={showEnglish}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', color: 'var(--color-forest-700)', cursor: 'pointer' }}
      >
        {showEnglish ? 'Vala' : 'English'}
      </button>
      {showEnglish && (
        <span lang="en" className="block mt-1" style={{ color: 'var(--text-muted)' }}>
          {english}
        </span>
      )}
    </p>
  );
}
