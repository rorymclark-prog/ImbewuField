import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { mountJournal, renderedText, renderedButton, journalFixture } from './journal-workflow-renderer.ts';
import { FARM_MEMORY_EN, FARM_MEMORY_ZU, farmMemoryText } from '../lib/farm-memory-copy.ts';
import type { JournalEntry } from '../lib/field-journal.ts';

const rows: JournalEntry[] = [
  { ...journalFixture('old-river', 'My original English note', '2025-01-02', 'Lettuce'), bedId: 'river', bedLabel: 'River bed', notes: 'The original words must remain.' },
  { ...journalFixture('renamed-river', 'Umbhede wami', '2026-04-02', 'Carrots'), bedId: 'river', bedLabel: 'New river label', notes: 'Amanothi ami.' },
  { ...journalFixture('other-river', 'Different physical bed', '2026-04-02', 'Lettuce'), bedId: 'other-river', bedLabel: 'River bed', notes: '' },
];

function historyButton(app: Awaited<ReturnType<typeof mountJournal>>, kind: 'bed' | 'crop', value: string) {
  const label = farmMemoryText('zu', kind === 'bed' ? 'bedHistory' : 'cropHistory', { value });
  return app.renderer.root.findAllByType('button').find(node => node.props['aria-label'] === label)!;
}

test('isiZulu search and filter controls, result counts and errors render in isiZulu while farmer notes stay exact', async () => {
  const original = structuredClone(rows);
  const app = await mountJournal({ entries: rows, lang: 'zu' });
  try {
    const controls = app.renderer.root.findByProps({ 'aria-label': FARM_MEMORY_ZU.findEntries });
    assert.equal(controls.props.lang, 'zu');
    assert.equal(app.renderer.root.findByProps({ type: 'search' }).props.placeholder, FARM_MEMORY_ZU.searchPlaceholder);
    assert.match(renderedText(controls), new RegExp(FARM_MEMORY_ZU.title));
    assert.doesNotMatch(renderedText(controls), /Search, filters and export controls are currently in English/);
    assert.match(renderedText(app.renderer.root), /My original English note/);
    assert.match(renderedText(app.renderer.root), /The original words must remain\./);
    await act(async () => app.renderer.root.findByProps({ 'aria-controls': 'journal-memory-filters' }).props.onClick());
    assert.match(renderedText(controls), new RegExp(FARM_MEMORY_ZU.fromDate));
    assert.match(renderedText(controls), new RegExp(FARM_MEMORY_ZU.cropOrProduct));
    const dates = app.renderer.root.findAllByProps({ type: 'date' });
    await act(async () => dates[0].props.onChange({ target: { value: '2026-04-03' } }));
    await act(async () => dates[1].props.onChange({ target: { value: '2026-04-01' } }));
    assert.equal(renderedText(app.renderer.root.findByProps({ role: 'alert' })), FARM_MEMORY_ZU.invalidRange);
    assert.equal(renderedButton(app.renderer, FARM_MEMORY_ZU.csv).props.disabled, true);
    assert.match(renderedText(app.renderer.root), new RegExp(FARM_MEMORY_ZU.noMatches));
    assert.deepEqual(rows, original);
    assert.equal(app.writes.length, 0);
  } finally { await app.close(); }
});

test('a bed-history tap clears search/date/crop limits and follows the stable identity across renamed beds', async () => {
  const app = await mountJournal({ entries: rows, lang: 'zu' });
  try {
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'Umbhede' } }));
    await act(async () => app.renderer.root.findByProps({ 'aria-controls': 'journal-memory-filters' }).props.onClick());
    const dates = app.renderer.root.findAllByProps({ type: 'date' });
    await act(async () => dates[0].props.onChange({ target: { value: '2026-01-01' } }));
    const selects = app.renderer.root.findAllByType('select');
    await act(async () => selects[1].props.onChange({ target: { value: 'Carrots' } }));
    assert.equal(app.renderer.root.findAllByType('article').length, 1);
    await act(async () => historyButton(app, 'bed', 'New river label').props.onClick());
    const articles = app.renderer.root.findAllByType('article');
    assert.equal(articles.length, 2, 'history includes the older note outside the former date/search/crop filters');
    assert.ok(articles.some(article => renderedText(article).includes('My original English note')));
    assert.ok(articles.some(article => renderedText(article).includes('Umbhede wami')));
    assert.ok(articles.every(article => !renderedText(article).includes('Different physical bed')), 'another physical bed with the same label must stay separate');
    assert.equal(app.renderer.root.findByProps({ type: 'search' }).props.value, '');
    assert.match(renderedText(app.renderer.root), new RegExp(farmMemoryText('zu', 'resultFilteredMany', { n: 2, total: 3 })));
    assert.equal(app.writes.length, 0, 'reading history must not rewrite any note');
  } finally { await app.close(); }
});

test('a crop-history tap replaces the bed selection and includes that exact recorded crop across the farm', async () => {
  const app = await mountJournal({ entries: rows, lang: 'zu', simple: true });
  try {
    await act(async () => historyButton(app, 'bed', 'New river label').props.onClick());
    assert.equal(app.renderer.root.findAllByType('article').length, 2);
    await act(async () => historyButton(app, 'crop', 'Lettuce').props.onClick());
    const articles = app.renderer.root.findAllByType('article');
    assert.equal(articles.length, 2);
    assert.ok(articles.some(article => renderedText(article).includes('Different physical bed')));
    assert.ok(articles.every(article => !renderedText(article).includes('Umbhede wami')));
    assert.equal(app.writes.length, 0);
    const css = readFileSync(new URL('../components/journal/JournalExplore.module.css', import.meta.url), 'utf8');
    assert.match(css, /\.historyTag\s*\{[^}]*min-height:\s*44px/, 'history actions need usable outdoor touch targets');
  } finally { await app.close(); }
});

test('each history-tag tap reaches the results even when that bed or crop is already selected', async () => {
  const app = await mountJournal({ entries: rows, lang: 'zu' });
  try {
    assert.equal(app.historyScrolls.length, 0, 'opening the journal must not move the reader');
    await act(async () => historyButton(app, 'bed', 'New river label').props.onClick());
    assert.equal(app.historyScrolls.length, 1);
    await act(async () => historyButton(app, 'bed', 'New river label').props.onClick());
    assert.equal(app.historyScrolls.length, 2, 'the already-selected bed must still take the farmer back to its history');
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'Umbhede' } }));
    assert.equal(app.historyScrolls.length, 2, 'ordinary searching must not inherit a delayed scroll from the earlier tap');
    await act(async () => historyButton(app, 'crop', 'Carrots').props.onClick());
    assert.equal(app.historyScrolls.length, 3);
    await act(async () => historyButton(app, 'crop', 'Carrots').props.onClick());
    assert.equal(app.historyScrolls.length, 4, 'the already-selected crop must still take the farmer back to its history');
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'not here' } }));
    assert.equal(app.historyScrolls.length, 4);
    assert.ok(app.historyScrolls.every(scroll => scroll.block === 'start'));
    assert.equal(app.writes.length, 0, 'navigating history never writes a saved note');
  } finally { await app.close(); }
});

test('isiZulu exports carry the selected locale and localized scope without translating a farmer’s crop or notes', async () => {
  const app = await mountJournal({ entries: rows, lang: 'zu' });
  try {
    await act(async () => historyButton(app, 'crop', 'Carrots').props.onClick());
    await act(async () => renderedButton(app.renderer, FARM_MEMORY_ZU.printableCopy).props.onClick());
    assert.equal(app.exports.length, 1);
    assert.equal(app.exports[0].options.lang, 'zu');
    assert.equal(app.exports[0].options.selection, farmMemoryText('zu', 'cropScope', { value: 'Carrots' }));
    assert.deepEqual(app.exports[0].entries.map(row => row.id), ['renamed-river']);
    assert.equal(app.exports[0].entries[0].cropName, 'Carrots');
    assert.equal(app.exports[0].entries[0].notes, 'Amanothi ami.');
    assert.match(renderedText(app.renderer.root), new RegExp(FARM_MEMORY_ZU.downloadedHtml));
  } finally { await app.close(); }
});

test('a task draft explains its unsaved status in isiZulu and a failed export reports its error in isiZulu', async () => {
  const url = 'https://farm.example/journal?task=1&crop=lettuce&action=sow&title=Keep%20this%20source%20title&bed=river&bedLabel=River%20bed';
  const app = await mountJournal({ entries: rows, lang: 'zu', url, exportError: true });
  try {
    const sheet = app.renderer.root.findByType(app.Sheet);
    assert.match(renderedText(sheet), new RegExp(FARM_MEMORY_ZU.taskDraftNotice));
    const draftNote = sheet.findAllByProps({ role: 'note' }).find(node => renderedText(node) === FARM_MEMORY_ZU.taskDraftNotice)!;
    assert.equal(draftNote.props.lang, 'zu');
    assert.equal(sheet.findAllByType('input').find(node => node.props.value === 'Keep this source title')!.props.value, 'Keep this source title');
    await act(async () => app.renderer.root.findByProps({ 'aria-label': 'Vala' }).props.onClick());
    await act(async () => renderedButton(app.renderer, FARM_MEMORY_ZU.csv).props.onClick());
    assert.match(renderedText(app.renderer.root), new RegExp(FARM_MEMORY_ZU.exportFailed));
    assert.equal(app.writes.length, 0);
  } finally { await app.close(); }
});

test('English remains a supported control language after adding isiZulu', async () => {
  const app = await mountJournal({ entries: rows, lang: 'en' });
  try {
    assert.equal(app.renderer.root.findByProps({ type: 'search' }).props.placeholder, FARM_MEMORY_EN.searchPlaceholder);
    assert.equal(app.renderer.root.findByProps({ 'aria-label': FARM_MEMORY_EN.findEntries }).props.lang, 'en');
    assert.ok(renderedButton(app.renderer, FARM_MEMORY_EN.printableCopy));
  } finally { await app.close(); }
});

test('printable photos are included by default and can be omitted without changing the selected notes or CSV', async () => {
  const app = await mountJournal({ entries: rows, lang: 'zu' });
  try {
    await act(async () => historyButton(app, 'crop', 'Carrots').props.onClick());
    assert.equal(app.renderer.root.findByProps({ type: 'checkbox' }).props.checked, true);
    await act(async () => renderedButton(app.renderer, FARM_MEMORY_ZU.printableCopy).props.onClick());
    assert.equal(app.exports[0].options.includePhotos, true);
    await act(async () => app.renderer.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: false } }));
    await act(async () => renderedButton(app.renderer, FARM_MEMORY_ZU.printableCopy).props.onClick());
    assert.equal(app.exports[1].options.includePhotos, false);
    assert.deepEqual(app.exports[0].entries.map(row => row.id), ['renamed-river']);
    assert.deepEqual(app.exports[1].entries.map(row => row.id), ['renamed-river']);
    await act(async () => renderedButton(app.renderer, FARM_MEMORY_ZU.csv).props.onClick());
    assert.equal(Object.hasOwn(app.exports[2].options, 'includePhotos'), false, 'photo embedding is only a printable-file choice');
    assert.deepEqual(app.exports[2].entries.map(row => row.id), ['renamed-river']);
    assert.equal(app.writes.length, 0);
  } finally { await app.close(); }
});
