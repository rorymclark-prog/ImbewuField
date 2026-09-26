#!/usr/bin/env node
// Translator hand-off: every *_ENGLISH_PENDING dictionary in lib/i18n-pending.ts is English text
// waiting on a fluent isiZulu speaker (see that file's own header comment for why the pending
// pattern exists — a farming-facing pending key must never be filled with machine translation).
//
// This script has no opinion on what the English should say; it only mirrors lib/i18n-pending.ts
// into a spreadsheet a translator can work from. Regenerate it after editing that file — the
// tests/pending-translations-csv.test.ts guard fails the build if the CSV drifts out of date.
//
// USAGE
//   npm run i18n:pending

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname — .pathname keeps percent-encoding, so a path with a space in it
// silently resolves to nothing and the script no-ops.
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'docs/translation/pending-isizulu.csv');

const pending = await import('../lib/i18n-pending.ts');

function csvField(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const rows = [['group', 'key', 'english', 'isizulu']];
for (const [exportName, dict] of Object.entries(pending)) {
  if (!exportName.endsWith('_ENGLISH_PENDING') || typeof dict !== 'object' || dict === null) continue;
  const group = exportName.slice(0, -'_ENGLISH_PENDING'.length);
  for (const [key, english] of Object.entries(dict)) {
    rows.push([group, key, english, '']);
  }
}

const csv = rows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
writeFileSync(OUT_PATH, csv);
console.log(`Wrote ${rows.length - 1} pending keys to ${OUT_PATH.replace(ROOT + '/', '')}`);
