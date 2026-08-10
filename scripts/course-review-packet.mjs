// Build the per-module document a first-language isiZulu reviewer works from.
//
//   npm run course:review-packet            # every module with an isiZulu script
//   npm run course:review-packet soil-health
//
// Writes docs/narration/review/<module>.review.md. That directory is gitignored: the packet is
// derived from the two narration scripts, and a committed copy would quietly go stale against
// them — the same "two places disagree" failure this repo keeps meeting. Regenerate, never edit.
// The reviewer's ANSWERS come back as edits to docs/narration/<module>.zu.md, which is the source.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reviewModule, renderReviewPacket } from '../lib/narration-review.ts';

// fileURLToPath, never `new URL(...).pathname` — a repo checked out under a path containing a
// space silently resolves to a directory that does not exist, and the script no-ops instead of
// failing. That has cost a day before.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NARRATION = join(ROOT, 'docs', 'narration');
const OUT_DIR = join(NARRATION, 'review');

const requested = process.argv.slice(2);
const modules = requested.length
  ? requested
  : readdirSync(NARRATION)
      .filter((f) => f.endsWith('.zu.md'))
      .map((f) => f.replace(/\.zu\.md$/, ''))
      .sort();

mkdirSync(OUT_DIR, { recursive: true });

let totalFindings = 0;
const rows = [];

for (const module of modules) {
  const enPath = join(NARRATION, `${module}.en.md`);
  const zuPath = join(NARRATION, `${module}.zu.md`);
  if (!existsSync(enPath) || !existsSync(zuPath)) {
    console.error(`  ✗ ${module}: needs both ${module}.en.md and ${module}.zu.md`);
    process.exitCode = 1;
    continue;
  }

  const review = reviewModule(module, readFileSync(enPath, 'utf8'), readFileSync(zuPath, 'utf8'));
  const outPath = join(OUT_DIR, `${module}.review.md`);
  writeFileSync(outPath, renderReviewPacket(review), 'utf8');

  totalFindings += review.findings.length;
  rows.push({
    module,
    slides: review.pairs.length,
    terms: review.terms.length,
    findings: review.findings.length,
  });
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

console.log('');
console.log(`  isiZulu review packets — ${rows.length} module(s)`);
console.log('');
console.log(`  ${pad('MODULE', 22)}${lpad('SLIDES', 7)}${lpad('TERMS', 7)}${lpad('FLAGGED', 9)}`);
console.log(`  ${'─'.repeat(45)}`);
for (const r of rows) {
  console.log(`  ${pad(r.module, 22)}${lpad(r.slides, 7)}${lpad(r.terms, 7)}${lpad(r.findings, 9)}`);
}
console.log('');
console.log(`  Written to docs/narration/review/`);
console.log('');
console.log(`  ${totalFindings} thing(s) flagged mechanically. Everything else needs a first-language`);
console.log('  isiZulu speaker — these packets do not review the language, they only make it');
console.log('  reviewable in one sitting.');
console.log('');
