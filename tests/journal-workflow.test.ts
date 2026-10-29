import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import * as journal from '../lib/field-journal.ts';
import * as view from '../lib/journal-view.ts';
import * as taskLinks from '../lib/task-record-link.ts';

const require = createRequire(import.meta.url);
const css = new Proxy({}, { get: (_target, key) => String(key) });

// Exercise the shipped component handlers and effects. Only browser/framework
// boundaries are replaced; parsing, filtering and journal entry creation stay real.
function component(path: string, dependencies: Record<string, unknown>): React.ComponentType<any> {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', javascript)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith('.module.css')) return css;
    return require(name);
  }, module, module.exports);
  return module.exports.default;
}

async function mount(options: { url?: string; entries?: journal.JournalEntry[]; simple?: boolean; failSave?: boolean; beds?: Array<{ id: string; label: string }> } = {}) {
  let stored = options.entries ?? [];
  const writes: journal.JournalEntry[][] = [];
  const exports: Array<{ format: string; entries: journal.JournalEntry[] }> = [];
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let url = new URL(options.url ?? 'https://farm.example/journal');
  const location = { get href() { return url.href; } };
  const router = { replace: (target: string) => { url = new URL(target, url); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location, addEventListener: () => {}, removeEventListener: () => {},
    history: { state: {}, replaceState: (_state: unknown, _title: string, target: string) => { url = new URL(target, url); } },
  } });
  const dependencies: Record<string, unknown> = {
    'next/navigation': { useRouter: () => router },
    '@/lib/i18n': { useLanguage: () => ({ lang: 'en', t: (key: string) => key }) },
    '@/lib/app-level': { useAppLevel: () => options.simple ? 'simple' : 'full' },
    '@/lib/field-journal': { ...journal, loadJournal: () => stored, saveJournal: (entries: journal.JournalEntry[]) => {
      writes.push(entries);
      if (!options.failSave) stored = entries;
      return { ok: !options.failSave, entries, trimmed: false };
    } },
    '@/lib/site-evidence': { resizeForStorage: async () => '' },
    '@/lib/design-beds-bridge': { bedsFromDesignCanvas: () => options.beds ?? [] },
    '@/lib/design-canvas': { loadCanvasState: () => null },
    '@/lib/saved-places': { loadPlaces: () => [], resolveMainSite: () => options.beds ? { lat: -28, lon: 30 } : null },
    '@/lib/crop-plan': { loadCropPlan: () => ({ plantings: [] }) },
    '@/lib/crop-catalog': { cropByKey: () => undefined },
    '@/lib/element-art-2': { getElementArt2: () => undefined },
    '@/lib/journal-view': view,
    '@/lib/task-record-link': taskLinks,
    '@/lib/sample-mode': { isSampleMode: () => false },
    '@/lib/journal-export': {
      downloadJournalCsv: async (entries: journal.JournalEntry[]) => { exports.push({ format: 'csv', entries }); return 'downloaded'; },
      downloadJournalHtml: async (entries: journal.JournalEntry[]) => { exports.push({ format: 'html', entries }); return 'downloaded'; },
    },
    '@/lib/use-escape-close': { useEscapeClose: () => {} },
    '@/lib/use-dialog-focus': { useDialogFocus: () => {} },
    './journal-labels': { formatZuluJournalDate: journal.formatJournalDate, formatZuluMonth: journal.monthLabelOf, journalCategoryLabel: (key: string) => key },
    './JournalPhotoReview': { __esModule: true, default: () => null },
    'next/link': { __esModule: true, default: ({ children, ...props }: any) => React.createElement('a', props, children) },
  };
  const Sheet = component('components/journal/JournalEntrySheet.tsx', dependencies);
  dependencies['./JournalEntrySheet'] = { __esModule: true, default: Sheet };
  const FieldJournal = component('components/journal/FieldJournal.tsx', dependencies);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(FieldJournal)); });
  } catch (error) {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    throw error;
  }
  return {
    renderer, Sheet, writes, exports,
    get url() { return url; },
    get stored() { return stored; },
    async close() {
      await act(async () => renderer.unmount());
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}

function text(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
}
function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAllByType('button').find(node => text(node) === label)!;
}
function entry(id: string, title: string, date: string, cropName: string): journal.JournalEntry {
  return { id, title, date, cropName, notes: '', category: 'planting', createdAt: 1, updatedAt: 1 };
}
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
