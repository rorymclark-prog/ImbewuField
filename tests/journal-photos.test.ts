import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import type { JournalEntry } from '../lib/field-journal.ts';
import { filterJournalEntries } from '../lib/journal-view.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/journal/JournalPhotoReview.tsx', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const componentModule = { exports: {} as any };
new Function('require', 'module', 'exports', javascript)((name: string) => name.endsWith('.module.css')
  ? { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }
  : require(name), componentModule, componentModule.exports);
const JournalPhotoReview = componentModule.exports.default as React.ComponentType<{ entries: readonly JournalEntry[] }>;

function photoEntry(id: string, date: string, title: string, bedLabel: string, cropName: string): JournalEntry {
  return { id, date, title, bedLabel, cropName, category: 'planting', notes: '',
    photos: [`data:image/png;base64,${Buffer.from(id).toString('base64')}`], createdAt: 1, updatedAt: 1 };
}
const entries = [
  photoEntry('old-west', '2025-03-02', 'Before planting', 'West bed', 'Lettuce'),
  photoEntry('middle-west', '2026-03-02', 'After planting', 'West bed', 'Lettuce'),
  photoEntry('new-east', '2026-05-10', 'East bed observation', 'East bed', 'Carrots'),
];

function text(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
}
function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAllByType('button').find(node => text(node) === label)!;
}
async function mount(initialEntries: readonly JournalEntry[]) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let focusCount = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    activeElement: { isConnected: true, focus: () => { focusCount++; } },
  } });
  let dialogProps: any;
  const dialog = {
    open: false, opened: 0, closed: 0,
    showModal() { this.open = true; this.opened++; },
    close() { if (!this.open) return; this.open = false; this.closed++; dialogProps.onClose(); },
  };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(JournalPhotoReview, { entries: initialEntries }), {
      createNodeMock(element) {
        if (element.type === 'dialog') { dialogProps = element.props; return dialog; }
        return null;
      },
    });
  });
  return {
    renderer, dialog,
    get focusCount() { return focusCount; },
    async update(next: readonly JournalEntry[]) {
      await act(async () => renderer.update(React.createElement(JournalPhotoReview, { entries: next })));
    },
    async cleanup() {
      await act(async () => renderer.unmount());
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else Reflect.deleteProperty(globalThis, 'document');
    },
  };
}

test('photo review contains only the notes selected by the journal filters, with full dates and original tags', async () => {
  const selected = filterJournalEntries(entries, { bed: 'label:West bed' });
  const app = await mount(selected);
  try {
    const photoButtons = app.renderer.root.findAllByType('button').filter(node => node.props['aria-label']?.startsWith('Open photo:'));
    assert.equal(photoButtons.length, 2);
    assert.match(photoButtons[0].props['aria-label'], /2026-03-02.*After planting.*West bed.*Lettuce/);
    assert.match(photoButtons[1].props['aria-label'], /2025-03-02.*Before planting.*West bed.*Lettuce/);
    assert.deepEqual(app.renderer.root.findAllByType('img').map(node => node.props.src), [entries[1].photos![0], entries[0].photos![0]]);
    assert.doesNotMatch(text(app.renderer.root), /East bed observation/);
  } finally { await app.cleanup(); }
});

test('opening and closing a saved photo restores focus without changing the journal observations', async () => {
  const snapshot = structuredClone(entries);
  const app = await mount(entries);
  try {
    const newest = app.renderer.root.findAllByType('button').find(node => node.props['aria-label']?.startsWith('Open photo:'))!;
    await act(async () => newest.props.onClick());
    assert.equal(app.dialog.open, true);
    assert.equal(app.dialog.opened, 1);
    const caption = app.renderer.root.findByType('figcaption');
    assert.match(text(caption), /2026-05-10.*East bed observation.*East bed.*Carrots/);
    assert.equal(app.renderer.root.findByType('time').props.dateTime, '2026-05-10');
    await act(async () => app.renderer.root.findByProps({ 'aria-label': 'Close journal photos' }).props.onClick());
    assert.equal(app.dialog.open, false);
    assert.equal(app.focusCount, 1);
    assert.equal(app.renderer.root.findAllByType('figure').length, 0);
    assert.deepEqual(entries, snapshot, 'viewing a photograph must never edit the farmer’s notes or timestamps');
  } finally { await app.cleanup(); }
});

test('comparison opens two distinct photos and keeps captions matched when another date is selected', async () => {
  const app = await mount(entries);
  try {
    await act(async () => button(app.renderer, 'Compare two photos').props.onClick());
    assert.equal(app.dialog.open, true);
    const selects = app.renderer.root.findAllByType('select');
    assert.notEqual(selects[0].props.value, selects[1].props.value);
    assert.equal(selects[0].findAllByType('option').find(option => option.props.value === selects[1].props.value)!.props.disabled, true);
    assert.equal(selects[1].findAllByType('option').find(option => option.props.value === selects[0].props.value)!.props.disabled, true);
    await act(async () => selects[1].props.onChange({ target: { value: 'old-west:0' } }));
    const frames = app.renderer.root.findAllByType('figure');
    assert.equal(frames.length, 2);
    assert.equal(frames[0].findByType('img').props.src, entries[2].photos![0]);
    assert.equal(frames[1].findByType('img').props.src, entries[0].photos![0]);
    assert.match(text(frames[1].findByType('figcaption')), /2025-03-02.*Before planting.*West bed.*Lettuce/);
    await act(async () => button(app.renderer, 'View one photo').props.onClick());
    assert.equal(app.renderer.root.findAllByType('figure').length, 1);
    assert.equal(app.renderer.root.findByType('figure').findByType('img').props.src, entries[2].photos![0]);
  } finally { await app.cleanup(); }
});

test('changing the journal selection closes a photo that no longer belongs to those notes', async () => {
  const app = await mount(entries);
  try {
    const newest = app.renderer.root.findAllByType('button').find(node => node.props['aria-label']?.startsWith('Open photo:'))!;
    await act(async () => newest.props.onClick());
    await app.update(filterJournalEntries(entries, { bed: 'label:West bed' }));
    assert.equal(app.dialog.open, false);
    assert.equal(app.renderer.root.findAllByType('figure').length, 0);
    assert.ok(app.renderer.root.findAllByType('img').every(node => node.props.src !== entries[2].photos![0]));
  } finally { await app.cleanup(); }
});

test('notes without saved photos do not display an empty gallery or comparison action', async () => {
  const app = await mount([{ ...entries[0], photos: [] }]);
  try {
    assert.equal(app.renderer.toJSON(), null);
    assert.equal(app.dialog.opened, 0);
  } finally { await app.cleanup(); }
});
