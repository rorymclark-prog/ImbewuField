#!/usr/bin/env node
// How much of the course a farmer can READ in their own language — as opposed to hear.
//
// WHY THIS EXISTS: a translated UI dictionary can hide English lesson bodies and quizzes.
//
// A .zu.md draft is not a recording. Count actual audio files separately from scripts.
//
// This measures it rather than asserting it, and it re-measures as the course grows, because the
// untranslated surface grows with the curriculum.
//
// USAGE
//   npm run course:i18n-status

import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// Count direct literal keys from the English and isiZulu source chunks. Both also spread
// English-pending groups, which are deliberately omitted from this direct-key measure.
// Importing i18n.tsx here would drag a client component and React into a CLI report.
function dictionaryCoverage() {
  function directKeys(path, marker) {
    const src = readFileSync(join(ROOT, path), 'utf8');
    const start = src.indexOf(marker);
    if (start < 0) throw new Error(`Locale source marker missing: ${path}`);
    const chunk = src.slice(start + marker.length).split('\n};', 1)[0];
    const d = {};
    for (const m of chunk.matchAll(/^ {2}([A-Za-z0-9_]+): ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/gm)) {
      d[m[1]] = m[2].slice(1, -1);
    }
    return d;
  }
  return {
    en: directKeys('lib/i18n.tsx', 'const T_en: Dict = {'),
    zu: directKeys('lib/locales/zu.ts', 'const dict: Dict = {'),
  };
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
console.log('  These are the English source strings. Learner-visible localized data and');
console.log('  its review status must be measured separately from the UI dictionary.');

const dict = dictionaryCoverage();
const en = dict.en ?? {};
console.log('');
console.log('  UI DICTIONARY — direct literal keys, excluding English-pending spreads');
console.log('');
console.log(`   en    ${String(Object.keys(en).length).padStart(4)} keys`);
for (const [code, d] of Object.entries(dict)) {
  if (code === 'en') continue;
  const keys = Object.keys(d);
  const same = keys.filter((k) => en[k] !== undefined && en[k] === d[k]).length;
  const pct = keys.length ? Math.round(((keys.length - same) / keys.length) * 100) : 0;
  console.log(`   ${code.padEnd(5)} ${String(keys.length).padStart(4)} keys  ${String(pct).padStart(3)}% of these values differ from English`);
}

const zuAudio = COURSE_MODULES.map((m) => {
  const dir = join(ROOT, 'public/course-audio', m.id, 'zu');
  const clips = existsSync(dir) ? readdirSync(dir).filter((f) => /^slide-\d+\.mp3$/.test(f)).length : 0;
  return { id: m.id, clips };
});
const recorded = zuAudio.filter((r) => r.clips > 0);
console.log('');
console.log(`  ISIZULU AUDIO — ${recorded.length}/${COURSE_MODULES.length} modules have recorded slide clips`);
for (const row of recorded) console.log(`   ${row.id}: ${row.clips} clips`);
console.log('  A narration draft alone is neither a reviewed translation nor learner audio.');
console.log('');
