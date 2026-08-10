#!/usr/bin/env node
// How much of the course a farmer can READ in their own language — as opposed to hear.
//
// WHY THIS EXISTS: the app's UI dictionary is in good shape (lib/i18n.tsx carries eleven
// languages and 95-98% of each locale's keys are genuinely translated). That healthy number hides
// the actual gap, because the course does not go through the dictionary at all: every module
// title, lesson title, lesson body, key point, quiz question, option and rationale is a plain
// English string in lib/course-modules.ts.
//
// The asymmetry is the point. What a farmer HEARS is translated — docs/narration/<module>.zu.md
// exists for all ten modules. What a farmer READS on the same screen is English.
//
// This measures it rather than asserting it, and it re-measures as the course grows, because the
// untranslated surface grows with the curriculum.
//
// USAGE
//   npm run course:i18n-status

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';

// fileURLToPath, not .pathname — .pathname keeps percent-encoding, so a path with a space in it
// silently resolves to nothing and the script no-ops.
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const words = (s) => (String(s ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;

const buckets = {
  'module titles': [],
  'lesson titles': [],
  'lesson bodies': [],
  'key points': [],
  'quiz questions': [],
  'quiz options': [],
  'quiz rationales': [],
};

for (const m of COURSE_MODULES) {
  buckets['module titles'].push(m.title);
  if (m.summary) buckets['module titles'].push(m.summary);
  for (const l of m.lessons) {
    buckets['lesson titles'].push(l.title);
    if (l.body) buckets['lesson bodies'].push(l.body);
    for (const k of l.keyPoints ?? []) buckets['key points'].push(k);
    for (const q of l.quiz ?? []) {
      buckets['quiz questions'].push(q.q);
      for (const o of q.options) buckets['quiz options'].push(o);
      if (q.rationale) buckets['quiz rationales'].push(q.rationale);
    }
  }
}

// Locale coverage in the UI dictionary, read from the source rather than imported: i18n.tsx is a
// client component and importing it here would drag React in for no reason.
function dictionaryCoverage() {
  const src = readFileSync(join(ROOT, 'lib/i18n.tsx'), 'utf8');
  const body = src.slice(src.indexOf('const T: Record<string, Dict> = {'));
  const heads = [...body.matchAll(/^ {2}([a-z]{2,3}): \{/gm)].map((m) => ({ code: m[1], at: m.index }));
  const out = {};
  for (let i = 0; i < heads.length; i++) {
    const end = i + 1 < heads.length ? heads[i + 1].at : body.length;
    const chunk = body.slice(heads[i].at, end);
    const d = {};
    for (const m of chunk.matchAll(/^ {4}([A-Za-z0-9_]+): ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/gm)) {
      d[m[1]] = m[2].slice(1, -1);
    }
    out[heads[i].code] = d;
  }
  return out;
}

console.log('');
console.log('  What a farmer can READ in their own language');
console.log('');

let totalStrings = 0;
let totalWords = 0;
console.log('  COURSE CONTENT — lib/course-modules.ts, outside the i18n dictionary entirely');
console.log('');
for (const [name, list] of Object.entries(buckets)) {
  const w = list.reduce((s, t) => s + words(t), 0);
  totalStrings += list.length;
  totalWords += w;
  console.log(`   ${name.padEnd(18)} ${String(list.length).padStart(4)} strings  ${String(w).padStart(6)} words`);
}
console.log(`   ${'TOTAL'.padEnd(18)} ${String(totalStrings).padStart(4)} strings  ${String(totalWords).padStart(6)} words`);
console.log('');
console.log('  Every one of those is English only. There is no per-language field on a module,');
console.log('  a lesson or a quiz, so no translation of them can be stored even if one existed.');

const dict = dictionaryCoverage();
const en = dict.en ?? {};
console.log('');
console.log('  UI DICTIONARY — lib/i18n.tsx, for comparison');
console.log('');
console.log(`   en    ${String(Object.keys(en).length).padStart(4)} keys`);
for (const [code, d] of Object.entries(dict)) {
  if (code === 'en') continue;
  const keys = Object.keys(d);
  const same = keys.filter((k) => en[k] !== undefined && en[k] === d[k]).length;
  const pct = keys.length ? Math.round(((keys.length - same) / keys.length) * 100) : 0;
  console.log(`   ${code.padEnd(5)} ${String(keys.length).padStart(4)} keys  ${String(pct).padStart(3)}% carry a value different from English`);
}

console.log('');
console.log('  THE ASYMMETRY: docs/narration/<module>.zu.md exists for all ten modules, so what a');
console.log('  farmer HEARS is translated. What they READ on the same screen is not.');
console.log('');
