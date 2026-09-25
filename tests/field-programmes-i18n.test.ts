import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FIELD_PROGRAMMES } from '../lib/field-teams.ts';

// lib/field-teams.ts's FIELD_PROGRAMMES names were English-only next to the translated
// FIELD_FOCUS tags this same component (components/FieldTeams.tsx) already renders with ui().
// Fixed the same way FIELD_FOCUS's own isiZulu strings are kept — a local map in the component,
// not in the English source of truth.

const source = () => readFileSync(new URL('../components/FieldTeams.tsx', import.meta.url), 'utf8');

test('every FIELD_PROGRAMMES key has an isiZulu label', () => {
  const src = source();
  const at = src.indexOf('const FIELD_PROGRAMMES_ZU');
  assert.ok(at > 0, 'FIELD_PROGRAMMES_ZU is gone');
  const decl = src.slice(at, src.indexOf('};', at) + 2);
  for (const key of Object.keys(FIELD_PROGRAMMES)) {
    assert.match(decl, new RegExp(`'?${key}'?:\\s*'[^']+'`), `FIELD_PROGRAMMES_ZU is missing a label for '${key}'`);
  }
});

test('the team card, the programme-focus picker and the hero eyebrow all render the isiZulu label', () => {
  const src = source();
  assert.match(src, /\{ui\(FIELD_PROGRAMMES\[t\.programme\?\?'general'\],FIELD_PROGRAMMES_ZU\[t\.programme\?\?'general'\]\)\}/,
    'the team card programme label is no longer isiZulu-aware');
  assert.match(src, /\{ui\(label,FIELD_PROGRAMMES_ZU\[key as FieldProgramme\]\)\}/,
    'the "Programme focus" picker options are no longer isiZulu-aware');
  assert.match(src, /programmeLabelUi=programmeKeys\.length\?programmeKeys\.map\(p=>ui\(FIELD_PROGRAMMES\[p\],FIELD_PROGRAMMES_ZU\[p\]\)\)/,
    'the hero eyebrow programme label is no longer isiZulu-aware');
  assert.match(src, /programmeLabelUi/, 'the isiZulu-aware programme label is no longer used in the hero');
});

test('the exported field report keeps its English-only programme label untouched', () => {
  // The report (ReportComposer sections) stays English throughout regardless of `lang`, same as
  // the rest of its own text — only the on-screen label should have picked up isiZulu.
  const src = source();
  assert.match(src, /const programmeLabel=programmeKeys\.length\?programmeKeys\.map\(p=>FIELD_PROGRAMMES\[p\]\)\.join\(' \/ '\):'Garden mentoring'/,
    'the report\'s English programmeLabel computation changed shape');
});

test("/surveys' Learn lesson link label uses the translated pattern, like its siblings", () => {
  const surveys = readFileSync(new URL('../app/surveys/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(surveys, /<LessonLink id="surveys:overview" label="Learn" \/>/,
    'the Learn label on /surveys is still hardcoded English');
  assert.match(surveys, /<LessonLink id="surveys:overview" label=\{localUi\('Learn', 'Funda', lang\)\} \/>/,
    "the Learn label on /surveys no longer follows tr(lang, 'Learn', 'Funda')");
});
