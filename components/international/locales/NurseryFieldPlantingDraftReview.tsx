'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import { downloadFile } from '@/lib/file-delivery';
import { nurseryFieldPlantingReviewCsv } from '@/lib/international/locales/nursery-field-planting-review-csv';
import { NURSERY_REVIEW_LANGUAGES as languages, type NurseryReviewLocale } from '@/lib/international/locales/nursery-field-planting-review-locales';
import type { NurseryReviewData, NurseryReviewRow } from '@/lib/international/locales/nursery-field-planting-review';

const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';
const panel = 'min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3 [overflow-wrap:anywhere]';
const note = 'text-sm text-[var(--text-secondary)]';
const states: Record<NurseryReviewRow['state'], string> = {
  draft: 'Unreviewed AI draft · structurally valid',
  reviewed: 'Review status requires separate evidence',
  missing: 'Draft missing',
  'source-missing': 'Current English source unavailable',
  stale: 'Stale source binding',
  invalid: 'Invalid draft packet or message',
};
const sourceStates: Record<NurseryReviewData['sources'][number]['status'], string> = {
  matched: 'Current file fingerprint matches the frozen capture',
  changed: 'Current file changed · source binding unavailable',
  unavailable: 'Current file unavailable · source binding unavailable',
};

export default function NurseryFieldPlantingDraftReview({ data }: { data: NurseryReviewData }) {
  // This worksheet has an in-flow return link; avoid the floating Back covering it.
  useRegisterBackControl();
  const id = useId();
  const [locale, setLocale] = useState<NurseryReviewLocale>('fr');
  const [query, setQuery] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const language = languages.find(item => item.locale === locale)!;
  const selected = data.languages.find(item => item.locale === locale);
  const rows = selected?.rows ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return rows.filter(row => `${row.key} ${row.currentEnglish ?? ''} ${row.frozenEnglish} ${row.translation ?? ''}`.toLocaleLowerCase(locale).includes(needle));
  }, [rows, query, locale]);
  const validDrafts = rows.filter(row => row.state === 'draft').length;
  const issueRows = rows.filter(row => row.state !== 'draft').length;
  function downloadWorksheet() {
    if (data.issue || rows.length === 0) return;
    const csv = nurseryFieldPlantingReviewCsv(locale, rows);
    downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `nursery-field-planting-drafts-${locale}.csv`);
    setDownloadMessage('Worksheet download requested. Check your downloads.');
  }

  return <main lang="en" dir="ltr" className="min-h-screen bg-[var(--bg-0)] p-4 text-[var(--text-primary)] sm:p-6">
    <div className="mx-auto min-w-0 max-w-5xl space-y-5 font-sans [overflow-wrap:anywhere]">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><MenuButton /><Link href="/international/locales" prefetch={false} className="inline-flex min-h-11 max-w-full items-center text-sm underline">Language draft review</Link></div>
        <h1 className="font-display text-2xl font-semibold">Nursery field-planting language worksheet</h1>
        <p className={note}>Compare the frozen 26-message nursery field-planting wording with inactive language drafts. Brazilian Portuguese here is a separate packet from the Portuguese draft on the general language-review page.</p>
        <p className={panel}>Review worksheet only. Fluent human approval is not recorded here, and no review decisions are saved. These drafts do not activate a language or change the app’s language choices, calibrated lessons, audio, country, currency, units or local farming readiness.</p>
      </header>

      <section className={panel} aria-labelledby={`${id}-source-heading`}>
        <h2 id={`${id}-source-heading`} className="font-display text-lg font-semibold">Current source checks</h2>
        <p className={note}>These checks compare current component files with the frozen capture. Matching bytes do not verify a translation’s meaning or fluent quality.</p>
        <p className={note}>Frozen capture date: <bdi dir="ltr">{data.capturedOn}</bdi>. Frozen packet SHA256: <code className="break-all">{data.sourceSha256}</code>.</p>
        <ul className="space-y-3">{data.sources.map(source => <li key={source.path} className="min-w-0">
          <code className="block break-all text-xs">{source.path}</code>
          <p className="text-sm">{sourceStates[source.status]}</p>
        </li>)}</ul>
        {data.sources.length === 0 && <p role="status" className={note}>Current source checks are unavailable.</p>}
        {data.issue && <p role="status" className="rounded-lg border border-[var(--border)] p-3 text-sm">{data.issue}</p>}
      </section>

      <section className={panel} aria-labelledby={`${id}-selection-heading`}>
        <h2 id={`${id}-selection-heading`} className="font-display text-lg font-semibold">Choose a draft to compare</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label htmlFor={`${id}-locale`} className="min-w-0 text-sm">Draft language<select id={`${id}-locale`} className={field} value={locale} onChange={event => {
            const choice = languages.find(item => item.locale === event.target.value);
            if (choice) { setLocale(choice.locale); setDownloadMessage(''); }
          }}>{languages.map(item => <option key={item.locale} value={item.locale}>{item.label}</option>)}</select></label>
          <label htmlFor={`${id}-search`} className="min-w-0 text-sm">Find a key, English wording or draft<input id={`${id}-search`} className={field} type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        </div>
        <p className="text-sm"><strong>{validDrafts} structurally valid drafts</strong> · {issueRows} rows needing source or draft attention · {rows.length} source rows in this packet.</p>
        <p className={note}>This count is structural draft coverage, not reviewed translation coverage. Changing the comparison language does not change the main app language, formatting, country or measurement system.</p>
        <button type="button" className="min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50" disabled={!!data.issue || rows.length === 0} onClick={downloadWorksheet}>Download draft review worksheet (CSV)</button>
        <p className={note}>The worksheet includes every row for the selected language, even when search hides some. It keeps source references, current and frozen English, draft text and source/draft check states, with a blank reviewer-note column. Exporting never approves translations or saves review decisions.</p>
        {downloadMessage && <p role="status" className={note}>{downloadMessage}</p>}
        {!selected && <p role="status" className={note}>No draft comparison is available for {language.label}. Check the source and packet issues above.</p>}
        <p role="status" aria-live="polite" className={note}>Showing {filtered.length} of {rows.length} rows · {language.label}.</p>
      </section>

      <section aria-label="Nursery field-planting draft comparisons" className="min-w-0 space-y-3">
        {selected && filtered.length === 0 && <p role="status" className={note}>No messages match this search.</p>}
        {filtered.map(row => <article key={row.key} data-nursery-draft-comparison className={panel} aria-label={`Draft comparison for ${row.key}`}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h2 className="break-all font-mono text-sm font-semibold">{row.key}</h2><p className="text-xs">{states[row.state]}</p></div>
          <p className={note}>Source file: <code className="break-all text-xs">{row.sourceFile}</code>.</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><h3 className="text-xs font-semibold">{row.currentEnglish === null ? 'Frozen English snapshot — current source unavailable' : 'Current English'}</h3>
              <p className="mt-1 min-w-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]" lang="en" dir="ltr"><bdi dir="auto">{row.currentEnglish ?? row.frozenEnglish}</bdi></p>
              {row.currentEnglish === null && <p className={note}>This frozen wording is not verified as the current English source.</p>}
              {row.currentEnglish !== null && row.currentEnglish !== row.frozenEnglish && <p className={note}>Frozen English snapshot: <bdi lang="en" dir="ltr">{row.frozenEnglish}</bdi>.</p>}
            </div>
            <div className="min-w-0"><h3 className="text-xs font-semibold">Inactive AI draft · {language.label}</h3>
              {/* DEMO/UTC can precede Arabic or Urdu. First-strong auto would then choose LTR inside the isolated draft. */}
              <p className="mt-1 min-w-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]" lang={row.translation === null ? 'en' : locale}
                dir={row.translation === null ? 'ltr' : language.direction}><bdi dir={row.translation === null ? 'ltr' : language.direction === 'rtl' ? 'rtl' : 'auto'}>{row.translation ?? 'No draft text is available for comparison.'}</bdi></p>
            </div>
          </div>
          {row.issues.length > 0 && <ul aria-label={`Issues for ${row.key}`} className="list-disc space-y-1 pl-5 text-sm">{row.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
          <p className={note}>AI draft, not fluent human approval. This worksheet does not save an approval or publish this wording.</p>
        </article>)}
      </section>
    </div>
  </main>;
}
