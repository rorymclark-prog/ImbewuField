import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import * as journal from '../lib/field-journal.ts';
import { mountJournal as mount, renderedText as text, renderedButton as button, journalFixture as entry } from './journal-workflow-renderer.ts';

const TASK_URL = 'https://farm.example/journal?task=1&crop=lettuce&action=sow&title=Sow%20lettuce&bed=older-site-bed&bedLabel=River%20bed&keep=1#history';

test('a plan handoff is an unsaved observation dated today; closing it records no work', async () => {
  const app = await mount({ url: TASK_URL });
  try {
    const sheet = app.renderer.root.findByType(app.Sheet);
    assert.equal(sheet.props.initialDraft.date, journal.todayISODate());
    assert.equal(sheet.props.initialDraft.notes, '');
    assert.equal(app.renderer.root.findByProps({ type: 'date' }).props.value, journal.todayISODate());
    assert.equal(app.writes.length, 0, 'following a task link must not claim completed work');
    assert.equal(app.url.search, '?keep=1', 'consuming the draft preserves unrelated navigation state');
    assert.equal(app.url.hash, '#history');
    await act(async () => app.renderer.root.findByProps({ 'aria-label': 'Close' }).props.onClick());
    assert.equal(app.renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    assert.equal(app.writes.length, 0, 'dismissing a suggested draft must never create an entry');
  } finally { await app.close(); }
});

test('saving a task observation keeps its original bed identity even without a main-site design', async () => {
  const app = await mount({ url: TASK_URL, simple: true });
  try {
    assert.equal(app.renderer.root.findByProps({ list: 'journal-crop-options' }).props.value, 'Lettuce');
    await act(async () => app.renderer.root.findByType('textarea').props.onChange({ target: { value: 'Sowed after the rain.' } }));
    await act(async () => app.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored.length, 1);
    assert.equal(app.stored[0].bedId, 'older-site-bed');
    assert.equal(app.stored[0].bedLabel, 'River bed');
    assert.equal(app.stored[0].cropName, 'Lettuce');
    assert.equal(app.stored[0].date, journal.todayISODate());
    assert.equal(app.stored[0].notes, 'Sowed after the rain.');
    assert.equal(app.renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
  } finally { await app.close(); }
});

test('a task observation retains the recorded bed label after the current design renames that bed', async () => {
  const app = await mount({ url: TASK_URL, beds: [{ id: 'older-site-bed', label: 'New design label' }] });
  try {
    await act(async () => app.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored[0].bedId, 'older-site-bed');
    assert.equal(app.stored[0].bedLabel, 'River bed', 'saving a note without changing its bed must preserve its historical label');
  } finally { await app.close(); }
});

test('retagging an unavailable bed with free text does not keep the previous bed identity', async () => {
  const app = await mount({ url: TASK_URL });
  try {
    await act(async () => app.renderer.root.findByProps({ placeholder: 'e.g. Bed 4' }).props.onChange({ target: { value: 'New plot' } }));
    await act(async () => app.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored[0].bedId, null, 'a new free-text label cannot still point at the old saved bed');
    assert.equal(app.stored[0].bedLabel, 'New plot');
  } finally { await app.close(); }
});

test('a failed observation save leaves the farmer’s draft open and the saved history unchanged', async () => {
  const app = await mount({ url: TASK_URL, failSave: true });
  try {
    await act(async () => app.renderer.root.findByType('textarea').props.onChange({ target: { value: 'Keep these words.' } }));
    await act(async () => app.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored.length, 0);
    assert.equal(app.renderer.root.findByType('textarea').props.value, 'Keep these words.');
    assert.match(text(app.renderer.root.findByType(app.Sheet)), /could not be saved/);
  } finally { await app.close(); }
});

test('journal exports contain exactly the searched and date-filtered entries, and no-match exports stay disabled', async () => {
  const app = await mount({ entries: [
    entry('old-spinach', 'Spinach sowing', '2026-01-03', 'Spinach'),
    entry('new-spinach', 'Spinach picking', '2026-03-15', 'Spinach'),
    entry('other', 'Carrots sowing', '2026-03-15', 'Carrots'),
  ] });
  try {
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'spinach' } }));
    await act(async () => app.renderer.root.findByProps({ 'aria-controls': 'journal-memory-filters' }).props.onClick());
    const dates = app.renderer.root.findAllByProps({ type: 'date' });
    await act(async () => dates[0].props.onChange({ target: { value: '2026-03-15' } }));
    await act(async () => dates[1].props.onChange({ target: { value: '2026-03-15' } }));
    assert.equal(app.renderer.root.findAllByType('article').length, 1);
    await act(async () => button(app.renderer, 'CSV').props.onClick());
    await act(async () => button(app.renderer, 'Printable copy').props.onClick());
    assert.deepEqual(app.exports.map(item => [item.format, item.entries.map(row => row.id)]), [
      ['csv', ['new-spinach']], ['html', ['new-spinach']],
    ]);
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'no matching note' } }));
    assert.equal(app.renderer.root.findAllByType('article').length, 0);
    assert.equal(button(app.renderer, 'CSV').props.disabled, true);
    assert.equal(button(app.renderer, 'Printable copy').props.disabled, true);
    assert.match(text(app.renderer.root), /No matching entries/);
  } finally { await app.close(); }
});
