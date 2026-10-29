import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'react-test-renderer';
import { journalFixture, mountJournal, renderedButton, renderedText } from './journal-workflow-renderer.ts';
import { JOURNAL_CATEGORIES, todayISODate } from '../lib/field-journal.ts';

// swarm/w4-vision-journal-simple: Simple / All tools for Lima Vision (/vision) and the Field
// Journal. Keep the Vision source guards, but exercise journal modes through the shipped
// components: the old source-shape checks rejected the task draft's legitimate editable date,
// bed and crop while failing to prove what a farmer could actually see or save.

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

for (const simple of [true, false]) {
  const mode = simple ? 'Simple' : 'All tools';

  test(`${mode} journal keeps both notes and one add action, with extra overview and category controls only in All tools`, async () => {
    const entries = [
      journalFixture('planting-note', 'Original planting note', '2026-03-01', 'Lettuce'),
      { ...journalFixture('harvest-note', 'Original harvest note', '2026-03-02', 'Lettuce'), category: 'harvest' as const },
    ];
    const app = await mountJournal({ simple, entries });
    try {
      assert.equal(app.renderer.root.findAllByType('article').length, 2);
      for (const label of ['entries', 'this month', 'since last note']) {
        assert.equal(app.renderer.root.findAllByProps({ label }).length, simple ? 0 : 1, `${label} is extra overview detail`);
      }
      assert.equal(renderedText(app.renderer.root).includes('journalLocalOnlyNote'), !simple, 'the storage explainer follows the mode');
      assert.equal(renderedText(app.renderer.root).includes('journalWeightsLiveElsewhere'), !simple);
      const primary = simple ? 'Add a note' : 'New entry';
      assert.equal(app.renderer.root.findAllByType('button').filter(button => renderedText(button) === primary).length, 1);
      await act(async () => app.renderer.root.findByProps({ 'aria-controls': 'journal-memory-filters' }).props.onClick());
      for (const label of ['Planting', 'Harvest']) {
        const choices = app.renderer.root.findAllByType('button').filter(button => renderedText(button).trim() === label);
        assert.equal(choices.length, simple ? 0 : 1, 'category filtering must remain available only in All tools');
      }
      await act(async () => renderedButton(app.renderer, primary).props.onClick());
      assert.equal(app.renderer.root.findAllByType(app.Sheet).length, 1, 'both primary actions open the same real entry sheet');
      assert.equal(app.renderer.root.findByType(app.Sheet).props.entry, null);
      assert.equal(app.writes.length, 0, 'opening a sheet is not a saved observation');
      await act(async () => app.renderer.root.findByProps({ 'aria-label': 'Close' }).props.onClick());
      assert.equal(app.renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
      assert.equal(app.writes.length, 0, 'cancelling the primary action must not create a note');
    } finally { await app.close(); }
  });

  test(`${mode} blank notes keep title, notes, photos and save, and save the same hidden defaults`, async () => {
    const app = await mountJournal({ simple });
    try {
      await act(async () => renderedButton(app.renderer, simple ? 'Add a note' : 'New entry').props.onClick());
      const sheet = app.renderer.root.findByType(app.Sheet);
      assert.equal(sheet.findByProps({ 'aria-label': 'Title' }).props.value, '');
      assert.equal(sheet.findByProps({ 'aria-label': 'Notes' }).props.value, '');
      assert.equal(sheet.findAllByProps({ type: 'file' }).length, 1, 'photo capture stays available in both modes');
      assert.equal(sheet.findAllByType('button').filter(button => renderedText(button) === 'Add').length, 1, 'the hidden file input needs a visible photo action');
      assert.equal(sheet.findAllByProps({ type: 'date' }).length, simple ? 0 : 1);
      assert.equal(sheet.findAllByProps({ 'aria-label': 'Bed / plot' }).length, simple ? 0 : 1);
      assert.equal(sheet.findAllByProps({ 'aria-label': 'Crop' }).length, simple ? 0 : 1);
      assert.equal(renderedText(sheet).includes('What kind of note?'), !simple);
      const categoryButtons = sheet.findAllByType('button').filter(button => typeof button.props['aria-pressed'] === 'boolean');
      assert.deepEqual(categoryButtons.map(button => renderedText(button).trim()), simple ? [] : JOURNAL_CATEGORIES.map(category => category.label));
      assert.equal(sheet.findByProps({ type: 'submit' }).props.disabled, true, 'a blank note must not be saved');
      await act(async () => sheet.findByProps({ 'aria-label': 'Title' }).props.onChange({ target: { value: 'My original note' } }));
      await act(async () => sheet.findByProps({ 'aria-label': 'Notes' }).props.onChange({ target: { value: 'What I actually observed.' } }));
      assert.equal(sheet.findByProps({ type: 'submit' }).props.disabled, false);
      assert.equal(renderedText(sheet.findByProps({ type: 'submit' })), 'Save entry');
      assert.equal(app.writes.length, 0);
      await act(async () => sheet.findByType('form').props.onSubmit({ preventDefault() {} }));
      assert.equal(app.stored.length, 1);
      assert.equal(app.stored[0].date, todayISODate());
      assert.equal(app.stored[0].category, 'planting');
      assert.equal(app.stored[0].bedId, null);
      assert.equal(app.stored[0].bedLabel, null);
      assert.equal(app.stored[0].cropName, null);
      assert.equal(app.stored[0].title, 'My original note');
      assert.equal(app.stored[0].notes, 'What I actually observed.');
    } finally { await app.close(); }
  });

  test(`${mode} editing preserves the recorded date, category, bed and crop when only the note changes`, async () => {
    const entry = { ...journalFixture('original', 'Original note', '2025-09-04', 'Lettuce'),
      category: 'training' as const, bedId: 'original-bed', bedLabel: 'Original bed', notes: 'Original observation.' };
    const app = await mountJournal({ simple, entries: [entry] });
    try {
      await act(async () => app.renderer.root.findByProps({ 'aria-label': 'Edit entry: Original note' }).props.onClick());
      const sheet = app.renderer.root.findByType(app.Sheet);
      await act(async () => sheet.findByProps({ 'aria-label': 'Notes' }).props.onChange({ target: { value: 'My amended observation.' } }));
      assert.equal(app.writes.length, 0);
      await act(async () => sheet.findByType('form').props.onSubmit({ preventDefault() {} }));
      assert.equal(app.stored[0].id, entry.id);
      for (const field of ['date', 'category', 'bedId', 'bedLabel', 'cropName', 'title'] as const) {
        assert.equal(app.stored[0][field], entry[field], `${field} must survive hidden controls and an ordinary note edit`);
      }
      assert.equal(app.stored[0].notes, 'My amended observation.');
    } finally { await app.close(); }
  });
}

test('a Simple task draft exposes its date, bed and crop for correction without recording work until saved', async () => {
  // A task is a plan, not evidence. Hiding these values under the normal Simple rule would
  // silently record today's date and a planned bed even when the farmer did something else.
  const app = await mountJournal({ simple: true,
    url: 'https://farm.example/journal?task=1&crop=lettuce&action=harvest&title=Harvest%20lettuce&bed=planned-bed&bedLabel=Planned%20bed',
    beds: [{ id: 'planned-bed', label: 'Planned bed' }, { id: 'actual-bed', label: 'Actual bed' }],
  });
  try {
    const sheet = app.renderer.root.findByType(app.Sheet);
    assert.equal(sheet.findByProps({ 'aria-label': 'Date' }).props.value, todayISODate());
    assert.equal(sheet.findByProps({ 'aria-label': 'Bed / plot' }).props.value, 'planned-bed');
    assert.equal(sheet.findByProps({ 'aria-label': 'Crop' }).props.value, 'Lettuce');
    assert.equal(sheet.findByProps({ 'aria-label': 'Title' }).props.value, 'Harvest lettuce');
    assert.equal(renderedText(sheet).includes('What kind of note?'), false, 'the category picker remains extra detail');
    await act(async () => sheet.findByProps({ 'aria-label': 'Date' }).props.onChange({ target: { value: '2026-03-12' } }));
    await act(async () => sheet.findByProps({ 'aria-label': 'Bed / plot' }).props.onChange({ target: { value: 'actual-bed' } }));
    await act(async () => sheet.findByProps({ 'aria-label': 'Crop' }).props.onChange({ target: { value: 'Carrots' } }));
    assert.equal(app.writes.length, 0, 'reviewing and correcting the suggestion must not save it');
    await act(async () => sheet.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored.length, 1);
    assert.equal(app.stored[0].date, '2026-03-12');
    assert.equal(app.stored[0].category, 'harvest', 'the planned note category survives the collapsed picker');
    assert.equal(app.stored[0].bedId, 'actual-bed');
    assert.equal(app.stored[0].bedLabel, 'Actual bed');
    assert.equal(app.stored[0].cropName, 'Carrots');
  } finally { await app.close(); }
});
