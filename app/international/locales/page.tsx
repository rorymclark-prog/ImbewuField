'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import { T_en } from '@/lib/i18n';
import { DRAFT_LANGUAGES } from '@/lib/international/locales/metadata';
import { DRAFT_DICTIONARIES } from '@/lib/international/locales/dictionaries';
import { SOURCE_MESSAGES } from '@/lib/international/locales/source';
import { coverageReport, placeholders, resolveMessage } from '@/lib/international/locales/coverage';
import { calendarDateParts, formatCalendarDate, formatNumber, formatRecordedMoney, formattingContext, totalRecordedMoney } from '@/lib/international/locales/formatting';
import type { DraftLanguage } from '@/lib/international/locales/types';

const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';
const note = 'text-sm text-[var(--text-secondary)]';
const examples = { percent: 50, done: 2, total: 4 };

export default function InternationalLocaleReviewPage() {
  // This page already has an in-flow return link; the floating Back covered it on phones.
  useRegisterBackControl();
  const [language, setLanguage] = useState<DraftLanguage>('fr');
  const [locale, setLocale] = useState('fr');
  const [query, setQuery] = useState('');
  const [previewDraft, setPreviewDraft] = useState(false);
  const [count, setCount] = useState('2');
  const current = useMemo(() => Object.fromEntries(SOURCE_MESSAGES.map((message) => [message.key, Object.hasOwn(T_en, message.key) ? T_en[message.key] : undefined])), []);
  const dictionary = DRAFT_DICTIONARIES[language];
  const report = coverageReport(SOURCE_MESSAGES, current, dictionary, language);
  const formatting = formattingContext(locale);
  const decimal = formatNumber(12345.67, formatting);
  const money = formatRecordedMoney({ amount: 1234.5, currency: 'ZAR' }, formatting);
  const mixed = totalRecordedMoney([{ amount: 10, currency: 'ZAR' }, { amount: 10, currency: 'USD' }]);
  const filtered = report.rows.filter((row) => `${row.key} ${row.source ?? ''} ${row.draft?.text ?? ''}`.toLocaleLowerCase(language).includes(query.toLocaleLowerCase(language)));
  const dateParts = calendarDateParts('2026-11-03', formatting);

  return <main className="min-h-screen bg-[var(--bg-0)] p-4 text-[var(--text-primary)] sm:p-6">
    <div className="mx-auto max-w-5xl space-y-5 font-sans">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3"><MenuButton /><Link href="/international" className="inline-flex min-h-11 items-center text-sm underline">International reference tools</Link></div>
        <h1 className="font-display text-2xl font-semibold">Language draft review</h1>
        <p className={note}>French, Spanish, Portuguese and Swahili drafts for {SOURCE_MESSAGES.length} existing interface messages. Every draft needs fluent human review. This route compares them with the current English source.</p>
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3 text-sm">Review workspace only. The app’s existing language choices, lessons, reports and offline packs retain their current support. Translated labels do not establish locally reviewed farming guidance.</p>
      </header>
      <section className="grid gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
        <label className="text-sm">Draft language<select className={field} value={language} onChange={(event) => setLanguage(event.target.value as DraftLanguage)}>{DRAFT_LANGUAGES.map((item) => <option key={item.language} value={item.language}>{item.nativeName} · {item.englishName}</option>)}</select></label>
        <label className="text-sm">Formatting locale (independent choice)<input className={field} value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="For example fr-CA or es-ES" spellCheck={false} /></label>
        <p className={`${note} sm:col-span-2`}>Country/jurisdiction: not selected. Choosing a language does not select a country, currency or measurement system. Portuguese wording here is a draft with European Portuguese preferences; other regional wording needs its own review.</p>
      </section>
      <section aria-label="Coverage" className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3">
        <h2 className="font-display text-lg font-semibold">Bounded coverage · {report.total} source keys</h2>
        <p className="text-sm"><strong>{report.counts.reviewed} human reviewed</strong> · {report.counts.draft} structurally valid drafts · {report.counts.stale} stale · {report.counts.missing} missing · {report.counts['source-missing']} missing source · {report.counts.invalid} invalid</p>
        <p className={note}>Draft coverage and English fallback do not count as reviewed translation. A changed or removed English source invalidates its binding. Human-review records must name the reviewer, date and exact source.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Find a key or wording<input className={field} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="text-sm">Synthetic photo count<input className={field} type="number" min="0" step="any" value={count} onChange={(event) => setCount(event.target.value)} /></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={previewDraft} onChange={(event) => setPreviewDraft(event.target.checked)} />Preview unreviewed drafts in the resolved-text examples</label>
        <p className={note}>Resolved-text examples use English by default. Previewing a draft keeps its unreviewed status.</p>
      </section>
      <section aria-label="Source-paired drafts" className="space-y-3">
        {filtered.length === 0 && <p className={note}>No messages match this search.</p>}
        {filtered.map((row) => {
          const source = SOURCE_MESSAGES.find((message) => message.key === row.key)!;
          const resolved = resolveMessage(source, current, dictionary, language, { previewDraft, values: examples, count: count.trim() ? Number(count) : NaN });
          return <article key={row.key} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-all font-mono text-sm font-semibold">{row.key}</h2><span className="text-xs">{row.state === 'draft' ? 'Unreviewed AI draft' : row.state}</span></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><h3 className="text-xs font-semibold">Current English · lib/i18n.tsx</h3><p className="mt-1 break-words text-sm" lang="en" dir="ltr">{row.source ?? 'Source missing'}</p></div><div><h3 className="text-xs font-semibold">Draft · {language}</h3><p className="mt-1 break-words text-sm" lang={language} dir="ltr">{row.draft?.text ?? 'No draft'}</p></div></div>
            <p className="text-xs text-[var(--text-secondary)]">Source binding: {row.draft?.sourceEnglish ?? 'None'}. Tokens: {row.source ? placeholders(row.source).join(', ') || 'None' : 'Unknown'}.</p>
            {row.draft?.pluralForms && <dl className="grid gap-2 text-xs sm:grid-cols-3">{Object.entries(row.draft.pluralForms).map(([category, form]) => <div key={category}><dt className="font-semibold">Plural: {category}</dt><dd lang={language} dir="ltr">{form}</dd></div>)}</dl>}
            <p className="text-sm"><span className="text-xs text-[var(--text-secondary)]">Resolved text · {resolved.origin}: </span><bdi dir="auto">{resolved.text}</bdi></p>
            {[...row.issues, ...resolved.issues].map((issue, index) => <p key={index} className="text-sm text-[var(--gold)]">{issue}</p>)}
            <p className="text-xs text-[var(--text-secondary)]">{row.draft?.provenance.executor} · {row.draft?.provenance.method} · {row.draft?.provenance.createdOn}. Fluent human review: {row.draft?.review.status === 'human-reviewed' ? `${row.draft.review.reviewer} · ${row.draft.review.reviewedOn}` : 'Not recorded'}.</p>
          </article>;
        })}
      </section>
      <section className="space-y-2 rounded-xl border border-[var(--border)] p-3" aria-label="Formatting and direction examples">
        <h2 className="font-display text-lg font-semibold">Synthetic formatting and direction checks</h2>
        <p className={note}>Requested: <bdi>{locale || '(empty)'}</bdi> · status: {formatting.status}. Actual runtime number/date/plural locales: {formatting.numberLocale} / {formatting.dateLocale} / {formatting.pluralLocale}.</p>
        {formatting.reason && <p role="status" className="text-sm text-[var(--gold)]">{formatting.reason}</p>}
        <p className="text-sm">Number 12345.67 → <bdi>{decimal}</bdi></p>
        <p className="text-sm">Calendar date 2026-11-03 → <bdi>{formatCalendarDate('2026-11-03', formatting)}</bdi> · parts: {dateParts?.filter((part) => part.type !== 'literal').map((part) => part.type).join(' → ')} · UTC calendar date</p>
        <p className="text-sm">Recorded 1234.50 ZAR → <bdi>{money?.text}</bdi>. Denomination preserved: {money?.currency}. No currency conversion is applied.</p>
        <p className="text-sm">10 ZAR + 10 USD → {mixed.status}; separate subtotals only.</p>
        <p className={note}>A quantity labelled kg stays kg. Unit conversion needs its own explicit quantity/unit contract.</p>
        <p className="rounded-lg bg-[var(--bg-1)] p-3 text-sm" dir="rtl" lang="ar">مثال <bdi dir="ltr">ZAR 123.45</bdi> <bdi dir="auto">Site A / 12</bdi></p>
        <p className={note}>Direction/isolation fixture only; Arabic is not one of the four draft dictionaries. Formatting follows this runtime’s ICU data and can differ between browser and server versions.</p>
      </section>
    </div>
  </main>;
}
