'use client';

import { useId, useMemo, useState } from 'react';
import { useRegisterBackControl } from '@/components/BackControl';
import type { MassEntryReviewData, MassEntryReviewLocale } from '@/lib/international/locales/mass-entry-review';

const languages: readonly { locale: MassEntryReviewLocale; label: string }[] = [
  { locale: 'fr', label: 'French · Français' },
  { locale: 'es', label: 'Spanish · Español' },
  { locale: 'pt-BR', label: 'Brazilian Portuguese · Português (Brasil)' },
  { locale: 'sw', label: 'Swahili · Kiswahili' },
  { locale: 'hi', label: 'Hindi · हिन्दी' },
  { locale: 'bn', label: 'Bengali · বাংলা' },
  { locale: 'id', label: 'Indonesian · Bahasa Indonesia' },
];

const fieldClass = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';
const panelClass = 'min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3 [overflow-wrap:anywhere]';
const noteClass = 'text-sm text-[var(--text-secondary)]';

const states: Record<'draft' | 'reviewed' | 'missing' | 'source-missing' | 'stale' | 'invalid', string> = {
  draft: 'Unreviewed AI draft · structurally valid',
  reviewed: 'Review status requires separate evidence',
  missing: 'Draft missing',
  'source-missing': 'Current English source unavailable',
  stale: 'Stale source binding',
  invalid: 'Invalid draft packet or message',
};

const sourceStates: Record<'matched' | 'changed' | 'available' | 'unavailable', string> = {
  matched: 'Current file fingerprint matches the frozen capture',
  changed: "Current file changed · inspect each row's current source and issues",
  available: 'Current file available',
  unavailable: 'Current file unavailable · source binding unavailable',
};

export default function MassEntryDraftReview({ data }: { data: MassEntryReviewData }) {
  // The route already renders an in-flow return link; the floating fallback covered it.
  useRegisterBackControl();
  const id = useId();
  const availableLocales = useMemo(() => {
    return languages.filter(lang => data.languages.some(entry => entry.locale === lang.locale));
  }, [data.languages]);

  const defaultLocale: MassEntryReviewLocale = availableLocales.length > 0 ? availableLocales[0].locale : 'fr';
  const [locale, setLocale] = useState<MassEntryReviewLocale>(defaultLocale);
  const [query, setQuery] = useState('');

  const activeLanguage = languages.find(item => item.locale === locale) ?? {
    locale,
    label: locale,
  };

  const selected = data.languages.find(item => item.locale === locale);
  const rows = selected?.rows ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return rows;
    return rows.filter(row => {
      const haystack = `${row.key} ${row.currentEnglish ?? ''} ${row.frozenEnglish} ${row.translation ?? ''}`;
      return haystack.toLocaleLowerCase(locale).includes(needle);
    });
  }, [rows, query, locale]);

  const validDrafts = rows.filter(row => row.state === 'draft').length;
  const issueRows = rows.filter(row => row.state !== 'draft' || row.issues.length > 0).length;

  return (
    <main lang="en" className="min-h-screen bg-[var(--bg-0)] p-4 text-[var(--text-primary)] sm:p-6">
      <div className="mx-auto min-w-0 max-w-5xl space-y-5 font-sans [overflow-wrap:anywhere]">
        <header className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">
            Harvest-weight entry wording review
          </h1>
          <p className={noteClass}>
            Compare the frozen 12-message harvest-weight and readback wording against inactive language drafts in French, Spanish, Brazilian Portuguese, Swahili, Hindi, Bengali, and Indonesian.
          </p>
          <div className={panelClass} role="region" aria-label="Worksheet scope and limitations">
            <p className="text-sm">
              Review worksheet only. This compares inactive drafts and does not translate the live app, approve fluency, change country or measurement units, or certify local crop advice. A source-paired AI draft is not fluent approval.
            </p>
          </div>
        </header>

        <section className={panelClass} aria-labelledby={`${id}-source-heading`}>
          <h2 id={`${id}-source-heading`} className="font-display text-lg font-semibold">
            Current source checks
          </h2>
          <p className={noteClass}>
            These checks compare current component files with the frozen capture. Matching bytes do not verify a translation’s meaning or fluent quality.
          </p>
          <p className={noteClass}>
            Frozen capture date: <bdi dir="ltr">{data.capturedOn}</bdi>. Frozen packet SHA256:{' '}
            <code className="break-all">{data.sourceSha256}</code>.
          </p>
          <ul className="space-y-3">
            {data.sources.map(source => (
              <li key={source.path} className="min-w-0">
                <code className="block break-all text-xs">{source.path}</code>
                <p className="text-sm">{sourceStates[source.status] ?? source.status}</p>
                {source.capturedSha256 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Captured SHA: <code className="break-all">{source.capturedSha256}</code>
                  </p>
                )}
                {source.currentSha256 && source.currentSha256 !== source.capturedSha256 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Current SHA: <code className="break-all">{source.currentSha256}</code>
                  </p>
                )}
              </li>
            ))}
          </ul>
          {data.sources.length === 0 && (
            <p role="status" className={noteClass}>
              Current source checks are unavailable.
            </p>
          )}
          {data.issue && (
            <p role="status" className="rounded-lg border border-[var(--border)] p-3 text-sm text-red-600">
              {data.issue}
            </p>
          )}
        </section>

        <section className={panelClass} aria-labelledby={`${id}-selection-heading`}>
          <h2 id={`${id}-selection-heading`} className="font-display text-lg font-semibold">
            Choose a draft to compare
          </h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label htmlFor={`${id}-locale`} className="min-w-0 text-sm">
              Draft language
              <select
                id={`${id}-locale`}
                className={fieldClass}
                value={locale}
                onChange={event => {
                  const choice = languages.find(item => item.locale === event.target.value);
                  if (choice) {
                    setLocale(choice.locale);
                  }
                }}
              >
                {languages.map(item => (
                  <option key={item.locale} value={item.locale}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-search`} className="min-w-0 text-sm">
              Find a key or wording
              <input
                id={`${id}-search`}
                className={fieldClass}
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search keys, English, or draft..."
              />
            </label>
          </div>
          <p className="text-sm">
            <strong>{validDrafts} structurally valid drafts</strong> · {issueRows} rows needing source or draft attention · {rows.length} source rows in this packet.
          </p>
          <p className={noteClass}>
            This count represents structural draft coverage, not reviewed translation quality. Changing the comparison language does not activate runtime translations or alter application settings.
          </p>
          {!selected && (
            <p role="status" className={noteClass}>
              No draft comparison is available for {activeLanguage.label}. Check the source and packet issues above.
            </p>
          )}
          <p role="status" aria-live="polite" className={noteClass}>
            Showing {filtered.length} of {rows.length} rows · {activeLanguage.label}.
          </p>
        </section>

        <section aria-label="Harvest-weight draft comparisons" className="min-w-0 space-y-3">
          {selected && filtered.length === 0 && (
            <p role="status" className={noteClass}>
              No messages match this search.
            </p>
          )}
          {filtered.map(row => (
            <article
              key={row.key}
              data-mass-draft-comparison
              className={panelClass}
              aria-label={`Draft comparison for ${row.key}`}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <h2 className="break-all font-mono text-sm font-semibold">{row.key}</h2>
                <p className="text-xs">{states[row.state] ?? row.state}</p>
              </div>
              <p className={noteClass}>
                Source file: <code className="break-all text-xs">{row.sourceFile}</code>
              </p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold">
                    {row.currentEnglish === null
                      ? 'Frozen English snapshot — current source unavailable'
                      : 'Current English'}
                  </h3>
                  <p className="mt-1 min-w-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]" lang="en">
                    <bdi dir="auto">{row.currentEnglish ?? row.frozenEnglish}</bdi>
                  </p>
                  {row.currentEnglish === null && (
                    <p className={noteClass}>
                      This frozen wording is not verified as the current English source.
                    </p>
                  )}
                  {row.currentEnglish !== null && row.currentEnglish !== row.frozenEnglish && (
                    <p className={noteClass}>
                      Frozen English snapshot: <bdi lang="en" dir="auto">{row.frozenEnglish}</bdi>
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold">
                    Inactive AI draft · {activeLanguage.label}
                  </h3>
                  <p
                    className="mt-1 min-w-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"
                    lang={row.translation === null ? 'en' : locale}
                  >
                    <bdi dir="auto">{row.translation ?? 'Draft unavailable.'}</bdi>
                  </p>
                </div>
              </div>
              {row.issues.length > 0 && (
                <ul
                  aria-label={`Issues for ${row.key}`}
                  className="list-disc space-y-1 pl-5 text-sm text-red-600"
                >
                  {row.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              )}
              <p className={noteClass}>
                AI draft, not fluent human approval. This worksheet does not save an approval or publish this wording.
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
