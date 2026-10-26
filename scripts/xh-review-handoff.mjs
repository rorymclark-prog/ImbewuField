#!/usr/bin/env node
// Writes a dated hand-off list of every isiXhosa UI draft for a fluent reviewer, safety and money
// first. A snapshot for people, not a source the app reads: re-run it to refresh.
//
// USAGE
//   node --import ./tests/register-alias.mjs scripts/xh-review-handoff.mjs [out.csv]
//
// Sources: the interface dictionary (lib/locales/xh.ts against T_en in lib/i18n.tsx), the
// English-keyed inline drafts (lib/locales/xh-inline/*), and the money-book drafts
// (lib/records-regional-drafts-data.ts, xh column). Lessons, slides and the Manual have their own
// source-paired review packets under docs/study-translation-reviews/ and research/manual/.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const out = process.argv[2] ?? 'docs/translation-reviews/xhosa-ui-2026-10-23/fluent-review-handoff-2026-10-26.csv';

// lib/i18n.tsx returns JSX, so Node cannot import it; T_en is a plain object literal, rebuilt
// from the file's text exactly as tests/lang-coverage.test.ts does.
const pending = await import('../lib/i18n-pending.ts');
const { LEARNER_UI_ENGLISH } = await import('../lib/learner-ui-english.ts');
const i18nSource = readFileSync(join(ROOT, 'lib/i18n.tsx'), 'utf8');
const start = i18nSource.indexOf('export const T_en: Dict = {');
if (start < 0) throw new Error('lib/i18n.tsx no longer exports T_en as a literal');
const literal = i18nSource.slice(start, i18nSource.indexOf('\n};', start) + 3).replace('export const T_en: Dict = ', 'return ');
const T_en = new Function('DESIGN_STUDIO_ENGLISH_PENDING', 'JOURNAL_ENGLISH_PENDING', 'LIMA_ENGLISH_PENDING', 'MENTOR_ENGLISH_PENDING', 'REPORT_FOOTNOTE_ENGLISH_PENDING', 'LEARNER_UI_ENGLISH', literal)(
  pending.DESIGN_STUDIO_ENGLISH_PENDING, pending.JOURNAL_ENGLISH_PENDING, pending.LIMA_ENGLISH_PENDING, pending.MENTOR_ENGLISH_PENDING, pending.REPORT_FOOTNOTE_ENGLISH_PENDING, LEARNER_UI_ENGLISH);
const xh = (await import('../lib/locales/xh.ts')).default;
const { RECORDS_DRAFTS } = await import('../lib/records-regional-drafts-data.ts');

// The first match wins; the order is the review order.
const PRIORITY = [
  ['1-safety', /frost|poison|toxic|chemical|pesticid|herbicid|spray|greywater|grey water|sewage|pit toilet|borehole|well\b|drinking|livestock|disease|vaccin|avian|influenza|report (it )?at once|vet\b|burn|fire|electric|dig|trench|earthwork|slope|flood|carbon monoxide|food safety|mould|rot\b|ferment|storage|store\b|unsupervised|supervis|warning|danger|unsafe/i],
  ['2-money', /\bR ?\d|money|cost|profit|margin|loan|interest|invoice|price|payment|paid|unpaid|income|expense|budget|grant|disburse|tax|SARS|deposit|bank|cash|sale|sold|buyer/i],
  ['3-consent-privacy', /consent|permission|privacy|private|POPIA|share|signature|sign\b|delete|personal|identif/i],
];
const priority = (english) => (PRIORITY.find(([, re]) => re.test(english)) ?? ['4-other'])[0];
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

const rows = [];
for (const [key, english] of Object.entries(T_en)) {
  const draft = xh[key];
  if (typeof english === 'string' && typeof draft === 'string' && draft !== english) rows.push(['dictionary', key, english, draft]);
}
const dir = join(ROOT, 'lib/locales/xh-inline');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort()) {
  const shard = (await import(join(dir, file))).default;
  for (const [english, draft] of Object.entries(shard)) rows.push([file.replace(/\.ts$/, ''), '', english, draft]);
}
for (const [english, row] of Object.entries(RECORDS_DRAFTS)) if (row.xh) rows.push(['money-book', '', english, row.xh]);

// The same English and draft in several places is reviewed once; the row names every source.
const merged = new Map();
for (const [source, key, english, draft] of rows) {
  const id = english + '\u0000' + draft, seen = merged.get(id);
  if (seen) { if (!seen[0].split(' ').includes(source)) seen[0] += ' ' + source; if (key && !seen[1]) seen[1] = key; }
  else merged.set(id, [source, key, english, draft]);
}
const ranked = [...merged.values()].map((r) => [priority(r[2]), ...r]).sort((a, b) => a[0].localeCompare(b[0]));
const lines = ['priority,source,key,english,isixhosa_draft,fluent_reviewer_verdict,fluent_reviewer_correction'];
for (const [p, source, key, english, draft] of ranked) lines.push([p, source, key, q(english), q(draft), '', ''].join(','));
writeFileSync(join(ROOT, out), lines.join('\n') + '\n');
const counts = Object.fromEntries(['1-safety', '2-money', '3-consent-privacy', '4-other'].map((p) => [p, ranked.filter((r) => r[0] === p).length]));
console.log(`wrote ${ranked.length} rows to ${out}`, counts);
