import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/w4-vision-journal-simple: Simple / All tools for Lima Vision (/vision) and the Field
// Journal (FieldJournal + JournalEntrySheet). Source-text guard style, same as
// tests/design-simple-mode.test.ts: these screens are not pure functions of exported data, so the
// guard reads the real shipped file and asserts the wiring a farmer would actually hit.

const VISION = readFileSync(new URL('../app/vision/page.tsx', import.meta.url), 'utf8');
const JOURNAL = readFileSync(new URL('../components/journal/FieldJournal.tsx', import.meta.url), 'utf8');
const SHEET = readFileSync(new URL('../components/journal/JournalEntrySheet.tsx', import.meta.url), 'utf8');

test('/vision, FieldJournal and JournalEntrySheet all read Simple / All tools from lib/app-level.ts', () => {
  for (const [name, src] of [['vision', VISION], ['FieldJournal', JOURNAL], ['JournalEntrySheet', SHEET]] as const) {
    assert.match(src, /from '@\/lib\/app-level'/, `${name} must import useAppLevel`);
    assert.match(src, /const simple = useAppLevel\(\) === 'simple'/, `${name} must compute a \`simple\` flag from useAppLevel()`);
  }
});

test('/vision: the confidence pill is collapsed behind a More detail toggle in Simple', () => {
  assert.match(
    VISION,
    /\{\(!simple \|\| showDetail\) && <ConfidencePill level=\{cropResult\.confidence\} zu=\{zu\} \/>\}/,
    'the crop result must not show ConfidencePill in Simple until showDetail is set',
  );
  assert.match(
    VISION,
    /\{\(!simple \|\| showDetail\) && <ConfidencePill level=\{weighResult\.confidence\} zu=\{zu\} \/>\}/,
    'the weigh result must not show ConfidencePill in Simple until showDetail is set',
  );
  assert.match(
    VISION,
    /\{simple && !showDetail && \(\s*<button[\s\S]{0,200}setShowDetail\(true\)/,
    'Simple must offer a "More detail" control that reveals the confidence pill',
  );
  // Hiding the pill must never change the underlying result data — both branches read the
  // same cropResult/weighResult.confidence, only the *display* is gated.
  assert.match(VISION, /setShowDetail\(false\)/, 'a new photo or mode switch must reset the disclosure, not leave stale detail showing');
});

test('/vision: the mode picker (only two everyday modes) and the capture action stay in every mode', () => {
  assert.doesNotMatch(VISION, /simple[^\n]*mode ===/, 'the two-mode toggle (crop/weigh) is already the "everyday one or two" and must not be hidden');
  assert.match(
    VISION,
    /aria-label=\{t\('Take or choose a photo', 'Thatha noma khetha isithombe'\)\}/,
    'the take/choose-a-photo capture action must exist unconditionally',
  );
});

test('FieldJournal: Simple leads with entries and one add-note action, hiding the stat row, storage note and category filter', () => {
  assert.match(JOURNAL, /\{!simple && \(\s*<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(3, 1fr\)'/, 'the entries/this-month/since-last-note stat row must not render in Simple');
  assert.match(JOURNAL, /\{!simple && \(\s*<p style=\{\{\s*margin: '8px 2px 0'/, 'the "where this goes" storage explainer must not render in Simple');
  assert.match(JOURNAL, /\{!simple && usedCategories\.length > 1 && \(/, 'the category filter chips must not render in Simple');
  assert.match(
    JOURNAL,
    /\{simple \? ui\('Add a note', 'Faka inothi'\) : ui\('New entry', 'Faka okusha'\)\}/,
    'the primary action must read "Add a note" in Simple and "New entry" in All tools',
  );
});

test('FieldJournal: the primary add-note/new-entry action opens the same entry sheet in both modes', () => {
  const opens = [...JOURNAL.matchAll(/onClick=\{\(\) => setSheet\(\{ open: true, entry: null \}\)\}/g)];
  assert.ok(opens.length >= 1, 'at least one control must open a blank entry via setSheet({ open: true, entry: null })');
  // The primary sticky action button (not the empty-state example CTA) must be reachable
  // regardless of simple — it is not wrapped in any !simple/simple-only guard of its own.
  assert.match(JOURNAL, /<Plus size=\{20\} \/>\s*\{simple \? ui\('Add a note'/, 'the sticky primary button must render its icon + label pair unconditionally');
});

test('JournalEntrySheet: what (title/notes), photo and save stay in both modes; category, date, bed and crop collapse in Simple', () => {
  // Proximity check rather than a bare doesNotMatch: prove there is no "{!simple" gate anywhere
  // in the run-up to each field's own <Label>, not just that some unrelated pattern is absent.
  for (const [field, needle] of [
    ['Title', "ui('Title', 'Isihloko')"],
    ['Notes', "ui('Notes', 'Amanothi')"],
    ['Photos', "ui('Photos', 'Izithombe')"],
  ] as const) {
    const idx = SHEET.indexOf(needle);
    assert.ok(idx > 0, `${field} field must exist`);
    const before = SHEET.slice(Math.max(0, idx - 80), idx);
    assert.doesNotMatch(before, /!simple/, `the ${field} field must not be hidden behind !simple`);
  }
  assert.match(SHEET, /type="submit"[\s\S]{0,400}\{entry \? ui\('Save changes'/, 'the Save button must be unconditional');

  assert.match(SHEET, /\{!simple && \(\s*<div>\s*<Label>\{ui\('What kind of note\?'/, 'the category picker must collapse behind !simple');
  assert.match(SHEET, /\{!simple && \(\s*<div>\s*<Label>\{ui\('Date'/, 'the Date field must collapse behind !simple');
  assert.match(SHEET, /\{!simple && \(\s*<div style=\{\{ display: 'flex', gap: 10 \}\}>\s*<div style=\{\{ flex: 1 \}\}>\s*<Label>\{ui\('Bed \/ plot'/, 'the Bed/plot + Crop row must collapse behind !simple');

  // Collapsing a field must not change what gets saved: category/date keep their existing
  // defaults (entry's own value, or 'planting' / today), and bed/crop default to null exactly
  // as they did before Simple existed — none of those defaults were touched by this change.
  assert.match(SHEET, /useState<JournalCategory>\(entry\?\.category \?\? 'planting'\)/);
  assert.match(SHEET, /useState\(entry\?\.date \?\? todayISODate\(\)\)/);
});
