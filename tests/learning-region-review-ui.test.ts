import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { loadLearningRegionReviewData } from '../lib/international/locales/learning-region-review-server.ts';
import { buildLearningRegionReviewData } from '../lib/international/locales/learning-region-review.ts';
import { LEARNING_REGION_REVIEW_LOCALES, LEARNING_REGION_REVIEW_SOURCE as binding } from '../lib/international/locales/learning-region-review-source.ts';
import { learningRegionReviewCsv } from '../lib/international/locales/learning-region-review-csv.ts';
import type { LearningReviewData } from '../lib/international/locales/learning-region-review.ts';

// Actual packets, adapter, source reader, CSV and React worksheet execute.
// Only navigation chrome, download handoff and browser side effects are bounded.
const effects = { network: 0, storage: 0, serverImport: 0, downloads: [] as { blob: Blob; name: string }[], failDownload: false, delivery: 'downloaded' };
const original = new Map(['window', 'fetch', 'localStorage', 'sessionStorage', '__learningWorksheetDelivery', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const storage = () => { effects.storage++; throw Error('A worksheet cannot read or save account/language/review state'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
Object.defineProperty(globalThis, '__learningWorksheetDelivery', { configurable: true, value: (blob: Blob, name: string) => {
  effects.downloads.push({ blob, name }); if (effects.failDownload) throw Error('Download boundary unavailable'); return effects.delivery;
} });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'fetch', { configurable: true, value: () => { effects.network++; throw Error('No worksheet network request'); } });
for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get: storage });
const root = new URL('../', import.meta.url).href;
const module = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/international/locales/LearningRegionDraftReview.tsx')) {
      if (specifier === '@/lib/international/locales/learning-region-review' || specifier.includes('review-server') || specifier === '@/lib/international/locales/source-reader' || specifier.startsWith('node:')) {
        effects.serverImport++; throw Error('Client may import server review types only');
      }
      if (specifier === 'next/link') return module(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children);}`);
      if (specifier === '@/components/MenuButton') return module('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return module('export function useRegisterBackControl(){}');
      if (specifier === '@/lib/file-delivery') return module('export function downloadFile(blob,name){return globalThis.__learningWorksheetDelivery(blob,name);}');
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Worksheet } = await import('../components/international/locales/LearningRegionDraftReview.tsx');
const { default: Route, runtime, dynamic } = await import('../app/international/locales/learning-region/page.tsx');
const actual = loadLearningRegionReviewData();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
const mounted = new Set<ReactTestRenderer>();
function mount(data = actual) {
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(Worksheet, { data })); }); mounted.add(renderer);
  const label = (prefix: string) => { const row = renderer.root.findAllByType('label').find(row => text(row).startsWith(prefix)); assert.ok(row); return row; };
  const ui = { renderer, text: () => text(renderer.root),
    language: () => label('Draft language').findByType('select'), search: () => label('Find a key').findByType('input'),
    article: (key: string) => renderer.root.findByProps({ 'aria-label': `Draft comparison for ${key}` }),
    downloadButton: () => renderer.root.findAllByType('button').find(row => text(row) === 'Download review worksheet (CSV)')!,
    choose(value: string) { act(() => ui.language().props.onChange({ target: { value } })); },
    find(value: string) { act(() => ui.search().props.onChange({ target: { value } })); },
    download() { act(() => ui.downloadButton().props.onClick()); },
    update(data: LearningReviewData) { act(() => renderer.update(React.createElement(Worksheet, { data }))); },
    unmount() { act(() => renderer.unmount()); mounted.delete(renderer); },
  };
  return ui;
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.serverImport = 0; effects.downloads.length = 0; effects.failDownload = false; effects.delivery = 'downloaded'; });
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); assert.equal(effects.network, 0); assert.equal(effects.storage, 0); assert.equal(effects.serverImport, 0); });
after(() => { hooks.deregister(); for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('the actual client exposes eleven review-only comparisons, 26 AI phrases and two fixed literals without app language or approval controls', () => {
  const ui = mount(); assert.equal(actual.source.status, 'matched'); assert.equal(ui.language().props.value, 'fr');
  assert.deepEqual(ui.language().findAllByType('option').map(node => node.props.value), [...LEARNING_REGION_REVIEW_LOCALES]);
  assert.match(ui.text(), /26 of 26 AI phrases passed structural checks/); assert.match(ui.text(), /2 of 2 fixed literals matched/);
  assert.match(ui.text(), /0 human approvals recorded/); assert.match(ui.text(), /not verified identity or qualification/);
  assert.equal(ui.renderer.root.findAllByType('article').length, 28);
  assert.equal(ui.renderer.root.findAllByType('input').length, 1, 'search is the only input; no name, identity or approval form is stored');
  assert.equal(ui.renderer.root.findAllByType('button').length, 1, 'download is the only worksheet action');
  assert.match(ui.text(), /source, no historical Git commit recorded/);
  for (const locale of LEARNING_REGION_REVIEW_LOCALES) {
    ui.choose(locale); assert.equal(ui.language().props.value, locale);
    const row = ui.article('learningRegionUi001'), expected = actual.languages.find(row => row.locale === locale)!.rows[0].translation!;
    assert.ok(text(row).includes(expected)); assert.equal(row.findAllByType('p').find(node => node.props.lang === locale)!.findByType('bdi').props.dir, 'auto');
    assert.match(text(ui.article('learningRegionUi014')), /Fixed source literal · not an AI translation/);
    assert.doesNotMatch(text(ui.article('learningRegionUi014')), /Inactive AI draft/);
  }
  ui.choose('pt'); assert.equal(ui.language().props.value, 'pl', 'general Portuguese cannot replace a packet or become a runtime setting');
});

test('fragments retain raw edge whitespace and readable context rather than being assembled into an invented sentence', () => {
  const ui = mount(), row = ui.article('learningRegionUi023'); assert.match(text(row), /Fragment · read with its context/);
  const English = row.findAllByType('p').find(node => node.props.lang === 'en')!;
  assert.equal(text(English), 'Saved site (optional)\n        '); assert.match(English.props.className, /whitespace-pre-wrap/);
  assert.ok(text(ui.article('learningRegionUi010')).includes(actual.languages[0].rows[9].contextNote));
  assert.match(ui.text(), /Core farming has South African source material/); assert.match(ui.text(), /Design uses Southern African and other teaching sources/);
  assert.match(ui.text(), /Finance’s classroom wording asserts no source geography/);
});

test('search filters comparisons only, while CSV retains every selected-language source/context binding and blank reviewer cells', async () => {
  const ui = mount(); ui.choose('bn'); ui.find('learningRegionUi023'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  ui.download(); assert.equal(effects.downloads.length, 1); assert.equal(effects.downloads[0].name, 'learning-region-drafts-bn.csv');
  const selected = actual.languages.find(row => row.locale === 'bn')!;
  assert.deepEqual(Buffer.from(await effects.downloads[0].blob.arrayBuffer()), Buffer.from(learningRegionReviewCsv('bn', selected.rows)), 'the downloaded bytes include the CSV authority’s UTF-8 BOM');
  assert.match(ui.text(), /Worksheet download requested/); assert.match(ui.text(), /0 human approvals recorded/);
  assert.equal(ui.language().props.value, 'bn');
});

for (const mode of ['unavailable', 'changed'] as const) test(`${mode} current source is visibly historical and never labelled current English`, async () => {
  const data = loadLearningRegionReviewData(path => path === binding.sourceFile ? mode === 'unavailable' ? undefined : readFileSync(new URL('../' + path, import.meta.url), 'utf8') + '\n// Changed source' : readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
  const ui = mount(data); assert.match(ui.text(), /Frozen English snapshot · current English unverified/);
  assert.match(ui.text(), /Historical snapshot only; not verified as the current interface/);
  assert.equal(ui.renderer.root.findAllByType('h3').some(node => text(node) === 'Current English'), false);
  assert.match(ui.text(), /0 of 26 AI phrases passed structural checks/);
  ui.download(); const csv = await effects.downloads[0].blob.text(); assert.ok(csv.includes('"Current English (blank if unverified)"'));
  assert.match(csv, /"source-missing"|"stale"/); assert.match(csv, /"Not recorded","",""/);
});

test('a changed or missing packet withholds its text and download without falling back to an earlier locale draft', () => {
  const ui = mount(); const native = actual.languages[0].rows[0].translation!; assert.notEqual(native, actual.languages[0].rows[0].english);
  const data = structuredClone(actual); data.languages[0].packetStatus = 'invalid'; data.languages[0].issue = 'Engineering invalid packet';
  data.languages[0].rows = data.languages[0].rows.map(row => ({ ...row, translation: null, state: 'invalid', issues: ['Engineering invalid packet'] }));
  ui.update(data); assert.match(ui.text(), /Engineering invalid packet/); assert.doesNotMatch(ui.text(), new RegExp(native.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(ui.text().includes('Draft text withheld or unavailable.')); assert.equal(ui.downloadButton().props.disabled, true); ui.download(); assert.equal(effects.downloads.length, 0);
  ui.choose('es'); assert.equal(ui.downloadButton().props.disabled, false); ui.choose('fr'); assert.equal(ui.downloadButton().props.disabled, true);
});

test('an unverified source packet yields no comparisons or export rather than a frozen-source fallback', () => {
  const data = buildLearningRegionReviewData({ sourceText: undefined, currentSourceText: undefined, packets: {} }); const ui = mount(data);
  assert.match(ui.text(), /Frozen English source packet could not be verified/); assert.equal(ui.renderer.root.findAllByType('article').length, 0);
  assert.doesNotMatch(ui.text(), /Current component bytes and all captured AST nodes match/);
  assert.equal(ui.downloadButton().props.disabled, true); ui.download(); assert.equal(effects.downloads.length, 0);
});

for (const outcome of ['cancelled', 'throw'] as const) test(`a ${outcome} download cannot claim a successful worksheet or any saved review`, () => {
  const ui = mount(); effects.delivery = outcome; effects.failDownload = outcome === 'throw'; ui.download();
  assert.match(ui.text(), outcome === 'throw' ? /could not be downloaded. No review was saved/ : /Worksheet was not downloaded/);
  assert.doesNotMatch(ui.text(), /Worksheet download requested/); assert.match(ui.text(), /0 human approvals recorded/);
});

test('old-render and unmounted download callbacks cannot export a different language or a withdrawn worksheet', () => {
  const ui = mount(), old = ui.downloadButton().props.onClick; ui.choose('hi'); act(() => old()); assert.equal(effects.downloads.length, 0);
  const retained = ui.downloadButton().props.onClick; ui.unmount(); act(() => retained()); assert.equal(effects.downloads.length, 0);
});

test('the actual dynamic node route supplies current source checks to its readonly client', () => {
  assert.equal(runtime, 'nodejs'); assert.equal(dynamic, 'force-dynamic'); const element = Route();
  assert.equal(element.type, Worksheet); assert.equal(element.props.data.source.status, 'matched'); assert.equal(element.props.data.languages.length, 11);
  const index = readFileSync(new URL('../app/international/locales/page.tsx', import.meta.url), 'utf8');
  assert.match(index, /href="\/international\/locales\/learning-region"/);
});
