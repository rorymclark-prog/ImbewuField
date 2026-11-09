'use client';

import { useId, useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import { downloadFile } from '@/lib/file-delivery';
import { learningRegionReviewCsv } from '@/lib/international/locales/learning-region-review-csv';
import type { LearningReviewData, LearningReviewRow } from '@/lib/international/locales/learning-region-review';
import { LEARNING_REGION_REVIEW_LOCALES, type LearningReviewLocale } from '@/lib/international/locales/learning-region-review-source';

const names: Record<LearningReviewLocale, string> = { fr: 'French · Français', es: 'Spanish · Español', 'pt-BR': 'Brazilian Portuguese · Português (Brasil)',
  sw: 'Swahili · Kiswahili', hi: 'Hindi · हिन्दी', bn: 'Bengali · বাংলা', id: 'Indonesian · Bahasa Indonesia', de: 'German · Deutsch',
  it: 'Italian · Italiano', nl: 'Dutch · Nederlands', pl: 'Polish · Polski' };
const states: Record<LearningReviewRow['state'], string> = { draft: 'Unreviewed AI draft · structural checks passed', reviewed: 'Review evidence needs separate checking',
  'fixed-literal': 'Fixed source literal · not translated', missing: 'Draft packet missing', invalid: 'Invalid packet or binding · held',
  stale: 'Current source changed · comparison held', 'source-missing': 'Current English unavailable · comparison held' };
const panel = 'min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 [overflow-wrap:anywhere]';
const note = 'text-sm text-[var(--text-secondary)]';
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-2';

export default function LearningRegionDraftReview({ data }: { data: LearningReviewData }) {
  useRegisterBackControl();
  const id = useId();
  const [locale, setLocale] = useState<LearningReviewLocale>('fr');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const mounted = useRef(false), rendered = useRef<object | null>(null);
  const handler = {}; rendered.current = handler;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; rendered.current = null; }; }, []);
  const selected = data.languages.find(language => language.locale === locale);
  const rows = selected?.rows ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return rows.filter(row => `${row.key} ${row.english} ${row.currentEnglish ?? ''} ${row.translation ?? ''} ${row.contextNote}`.toLocaleLowerCase(locale).includes(needle));
  }, [rows, query, locale]);
  const ai = rows.filter(row => row.kind === 'ai-draft'), fixed = rows.filter(row => row.kind === 'fixed-literal');
  const draftCount = ai.filter(row => row.state === 'draft').length;
  const fixedCount = fixed.filter(row => row.state === 'fixed-literal').length;
  function current() { return mounted.current && rendered.current === handler; }
  function download() {
    if (!current() || data.issue || !selected || selected.packetStatus !== 'valid' || !rows.length) return;
    try {
      const csv = learningRegionReviewCsv(locale, rows);
      if (!current()) return;
      const result = downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `learning-region-drafts-${locale}.csv`);
      if (current()) setMessage(result === 'downloaded' ? 'Worksheet download requested. Check your downloads.' : 'Worksheet was not downloaded.');
    } catch { if (current()) setMessage('The worksheet could not be downloaded. No review was saved.'); }
  }
  return <main lang="en" className="min-h-screen bg-[var(--bg-0)] p-4 text-[var(--text-primary)] sm:p-6">
    <div className="mx-auto min-w-0 max-w-5xl space-y-5 font-sans [overflow-wrap:anywhere]">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-3"><MenuButton /><Link href="/international/locales" prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Language draft review</Link></div>
        <h1 className="font-display text-2xl font-semibold">Learning-region language worksheet</h1>
        <p className={note}>Compare 26 AI draft phrases and 2 fixed source literals per language. The captured collection has 11 inactive draft packets: 286 AI phrases and 22 fixed copies across 308 bindings.</p>
        <p className={panel}>For human language review, not app language adoption. Nothing here records a reviewer’s identity, saves an approval, changes lessons or establishes local farming suitability. Add a named reviewer and notes in your own downloaded worksheet; a name is not verified identity or qualification.</p>
      </header>
      <section className={panel} aria-labelledby={`${id}-source`}>
        <h2 id={`${id}-source`} className="font-display text-lg font-semibold">English source and context</h2>
        <p className={note}>Core farming has South African source material. Design uses Southern African and other teaching sources. Finance’s classroom wording asserts no source geography. Country, agricultural region, interface language and local suitability remain separate.</p>
        <p role="status" className="text-sm">{data.source.status === 'matched' ? 'Current component bytes and all captured AST nodes match. This is not language or curriculum approval.'
          : data.source.status === 'changed' ? 'Current component changed. Current English is unverified; comparisons are held against the frozen snapshot.'
            : 'Current component or its binding is unavailable. Frozen English is not verified current wording.'}</p>
        <p className={note}>Historical capture: {data.capturedOn} · uncommitted source, no historical Git commit recorded.</p>
        <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Source fingerprints</summary>
          <p className="break-all">Packet SHA256: {data.sourceSha256}</p><p className="break-all">Component: {data.source.path}</p>
          <p className="break-all">Captured component SHA256: {data.source.capturedSha256}</p>
          <p className="break-all">Current component SHA256: {data.source.currentSha256 ?? 'Unavailable'}</p>
        </details>
        {data.issue && <p role="status">{data.issue}</p>}
      </section>
      <section className={panel} aria-labelledby={`${id}-choose`}>
        <h2 id={`${id}-choose`} className="font-display text-lg font-semibold">Choose an inactive draft</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm">Draft language<select className={field} value={locale} onChange={event => {
            if (!current()) return;
            const value = LEARNING_REGION_REVIEW_LOCALES.find(choice => choice === event.target.value);
            if (value) { setLocale(value); setMessage(''); }
          }}>{LEARNING_REGION_REVIEW_LOCALES.map(choice => <option key={choice} value={choice}>{names[choice]}</option>)}</select></label>
          <label className="min-w-0 text-sm">Find a key or wording<input type="search" className={field} value={query} onChange={event => { if (current()) setQuery(event.target.value); }} /></label>
        </div>
        <p className="text-sm">{draftCount} of {ai.length} AI phrases passed structural checks · {fixedCount} of {fixed.length} fixed literals matched · 0 human approvals recorded.</p>
        <p className={note}>Fixed literals are copied punctuation or DEMO text, not AI-authored translations or reviewed coverage. Changing this comparison changes no app language, country, formatting, units or account records.</p>
        {selected?.issue && <p role="status">{selected.issue}</p>}
        {!selected && <p role="status">No comparison is available for {names[locale]}. Check the source packet above.</p>}
        <button type="button" disabled={!!data.issue || !rows.length || selected?.packetStatus !== 'valid'} onClick={download} className="min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">Download review worksheet (CSV)</button>
        <p className={note}>Exports every selected-language row, including rows hidden by search, with source/context bindings and blank reviewer-name/notes cells. Unverified current English stays blank. Downloading does not approve or publish wording.</p>
        {message && <p role="status">{message}</p>}
        <p role="status" aria-live="polite" className={note}>Showing {filtered.length} of {rows.length} rows · {names[locale]}.</p>
      </section>
      <section aria-label="Learning-region draft comparisons" className="space-y-3">
        {selected && filtered.length === 0 && <p role="status">No messages match this search.</p>}
        {filtered.map(row => <article key={row.key} data-learning-region-draft-comparison className={`${panel} break-inside-avoid`} aria-label={`Draft comparison for ${row.key}`}>
          <h2 className="font-mono text-sm font-semibold">{row.key}</h2><p className="text-sm">{states[row.state]}</p>
          <p className={note}>{row.fragment ? 'Fragment · read with its context; not a complete standalone sentence.' : 'Standalone source message.'}</p>
          <p className={note}>Context: {row.contextNote}</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><h3 className="text-sm font-semibold">{row.currentEnglish === null ? 'Frozen English snapshot · current English unverified' : 'Current English'}</h3>
              <p lang="en" className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"><bdi dir="auto">{row.currentEnglish ?? row.english}</bdi></p>
              {row.currentEnglish === null && <p className={note}>Historical snapshot only; not verified as the current interface.</p>}
            </div>
            <div className="min-w-0"><h3 className="text-sm font-semibold">{row.kind === 'fixed-literal' ? 'Fixed source literal · not an AI translation' : `Inactive AI draft · ${names[locale]}`}</h3>
              <p lang={row.translation === null ? 'en' : locale} className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"><bdi dir="auto">{row.translation ?? 'Draft text withheld or unavailable.'}</bdi></p>
            </div>
          </div>
          {row.issues.length > 0 && <ul aria-label={`Issues for ${row.key}`} className="list-disc pl-5 text-sm">{row.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
          <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Captured binding details</summary>
            <p className="break-all">English SHA256: {row.sha256}</p><pre className="whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">{JSON.stringify(row.bindings, null, 2)}</pre>
          </details>
        </article>)}
      </section>
    </div>
  </main>;
}
