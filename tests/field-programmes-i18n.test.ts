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
  // This English reference line is unchanged: only the on-screen label picked up isiZulu. (The report
  // body itself is now worded by buildFieldReport for isiXhosa readers — see the next test.)
  const src = source();
  assert.match(src, /const programmeLabel=programmeKeys\.length\?programmeKeys\.map\(p=>FIELD_PROGRAMMES\[p\]\)\.join\(' \/ '\):'Garden mentoring'/,
    'the report\'s English programmeLabel computation changed shape');
});

test('the field report is built in the reader\'s language and shows the unreviewed isiXhosa draft notice', () => {
  // The report body is no longer English for isiXhosa: FieldTeams.tsx passes the language to
  // buildFieldReport / fieldVisitReportLines and shows the same notice as the other reports. English
  // and every other language still build the English report (see tests/staff-report.test.ts).
  const src = source();
  assert.match(src, /const reportLanguage=lang==='xh'\?'xh':'en';/, 'only isiXhosa gets a translated report body');
  assert.match(src, /buildFieldReport\(data,\{[^}]*language:reportLanguage\}\)/, 'the aggregate report no longer receives the language');
  assert.match(src, /fieldVisitReportLines\(visitReport,reportName\(visitReport\.farmerId\),reportName\(visitReport\.mentorId\),reportLanguage\)/, 'the saved-visit report no longer receives the language');
  const notice = "The controls, analysis text, tables and PDF here are an unreviewed isiXhosa draft. Names and recorded evidence are kept as recorded.";
  assert.equal(src.split(`lang==='xh'&&<p role="note" className={styles.notice}>{inlineText(lang,'${notice}')}</p>`).length - 1, 2, 'both the aggregate and the saved-visit report show the draft notice');
  assert.match(src, /const reportName = \(id: string\) => data\?\.people\.find\(p => p\.id === id\)\?\.name \?\? inlineText\(lang, 'Former team member'\)/, 'the report name fallback is no longer language-aware');
  for (const label of ['Field visit report', 'Visit details', 'Visit photographs', 'Visit photographs opened for this report', 'Field support records']) {
    assert.ok(src.includes(`inlineText(lang,'${label}')`), `${label} is no longer routed through inlineText`);
  }
  assert.doesNotMatch(src, /title="Field visit report"|photoHeading="Visit photographs|reportLabel="Field support records"/, 'a report heading went back to hard-coded English');
});

test('the saved-visit PDF keeps its English file name for every language', () => {
  // ReportComposer builds the name from the title when no filenameBase is given; the title is isiXhosa
  // for an isiXhosa reader, so FieldTeams.tsx passes the English one.
  assert.match(source(), /filenameTitle="Field visit report"/);
  const composer = readFileSync(new URL('../components/ReportComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /`ImbewuField-\$\{\(filenameTitle \?\? title\)\.replace\(\/\[\^a-zA-Z0-9\]\+\/g, '-'\)\}\.pdf`/);
});

test("/surveys' Learn lesson link label uses the translated pattern, like its siblings", () => {
  const surveys = readFileSync(new URL('../app/surveys/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(surveys, /<LessonLink id="surveys:overview" label="Learn" \/>/,
    'the Learn label on /surveys is still hardcoded English');
  assert.match(surveys, /<LessonLink id="surveys:overview" tone="chip" label=\{localUi\('Learn', 'Funda', lang\)\} \/>/,
    "the Learn label on /surveys no longer follows tr(lang, 'Learn', 'Funda')");
});
