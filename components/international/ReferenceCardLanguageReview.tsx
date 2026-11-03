'use client';

import { useState } from 'react';
import { REFERENCE_REVIEW_LANGUAGES, REFERENCE_REVIEW_PACKETS, referenceReviewRows,
  type ReferenceReviewLanguage } from '@/lib/international/locales/reference-review';

const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2';
const muted = 'text-sm text-[var(--text-secondary)]';

export default function ReferenceCardLanguageReview() {
  const [pilot, setPilot] = useState<keyof typeof REFERENCE_REVIEW_PACKETS>('kenya');
  const [language, setLanguage] = useState<ReferenceReviewLanguage>('en');
  const packet = REFERENCE_REVIEW_PACKETS[pilot];
  const rows = referenceReviewRows(packet, language);
  const drafts = rows.filter(row => row.origin === 'draft').length;
  const fallbacks = rows.filter(row => row.origin === 'fallback').length;

  return <section aria-labelledby="reference-card-language-heading" className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3">
    <h2 id="reference-card-language-heading" className="font-display text-lg font-semibold">Country reference card wording</h2>
    <p className={muted}>Compare wording captured from country references. These AI drafts need fluent human review. This preview applies only to the examples on this page.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Reference card<select className={field} value={pilot} onChange={event => {
        const choice = event.target.value;
        if (Object.hasOwn(REFERENCE_REVIEW_PACKETS, choice)) setPilot(choice as typeof pilot);
      }}>
        {Object.entries(REFERENCE_REVIEW_PACKETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select></label>
      <label className="text-sm">Reference wording preview<select className={field} value={language} onChange={event => {
        const choice = REFERENCE_REVIEW_LANGUAGES.find(([key]) => key === event.target.value);
        if (choice) setLanguage(choice[0]);
      }}>
        {REFERENCE_REVIEW_LANGUAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
    </div>
    <p className={muted} role="status">{rows.length} captured English messages · {drafts} unreviewed drafts shown · {fallbacks} English fallbacks · 0 human reviewed</p>
    <p className={muted}>Captured source revision <code>{packet.source.sourceCommit.slice(0, 9)}</code>.</p>
    <details className="rounded-lg border border-[var(--border)] p-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Compare the wording</summary>
      <ul className="space-y-2" aria-label={`${packet.label} wording examples`}>
        {rows.map(row => <li key={row.key} className="grid gap-2 border-t border-[var(--border)] pt-2 sm:grid-cols-2">
          <div><p className="text-xs font-semibold">Captured English</p><p lang="en" className="break-words text-sm">{row.english}</p></div>
          {row.origin !== 'english' && <div><p className="text-xs font-semibold">{row.origin === 'draft' ? 'Unreviewed AI draft' : 'English fallback'}</p>
            <p lang={row.origin === 'draft' ? language : 'en'} dir="auto" className="break-words text-sm">{row.text}</p></div>}
        </li>)}
      </ul>
    </details>
  </section>;
}
