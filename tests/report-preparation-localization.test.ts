import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import typescript from 'typescript';
import { REPORT_PREPARATION_COPY, reportPreparation, reportPreparationText } from '../lib/report-readiness.ts';
import type { ReportDesignRecords } from '../lib/report-readiness.ts';
import type { CompletionScoreInputs } from '../lib/completion-score.ts';
import type { EvidenceItem } from '../lib/site-evidence.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { recordsDate } from '../lib/records-months.ts';

const languages = ['zu', 'st', 'ts', 've'] as const;
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/report-preparation-translation/source-cases.json')) as { cases: Array<{
  name: string; inputs: CompletionScoreInputs; evidence: Record<string, EvidenceItem[]>;
  records: ReportDesignRecords; english: ReturnType<typeof reportPreparation>;
}> };
const tokens = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
const digits = (text: string) => (text.match(/\d+/g) ?? []).sort();

test('preparation drafts retain every source placeholder, figure and measurement unit', () => {
  const sources = new Set<string>();
  for (const row of REPORT_PREPARATION_COPY) {
    assert.ok(!sources.has(row.english), `duplicate authority: ${row.english}`);
    sources.add(row.english);
    for (const language of languages) {
      assert.ok(row[language].trim());
      assert.notEqual(row[language], row.english, `${language}: English fallback for ${row.english}`);
      assert.deepEqual(tokens(row[language]), tokens(row.english), `${language}: placeholder changed`);
      assert.deepEqual(digits(row[language]), digits(row.english), `${language}: figure changed`);
      if (row.english.includes('m²')) assert.ok(row[language].includes('m²'));
      if (row.english.includes('{perimeter} m')) assert.ok(row[language].includes('{perimeter} m'));
      if (row.english.includes('{length} m')) assert.ok(row[language].includes('{length} m'));
    }
  }
  assert.equal(reportPreparationText('{count} of 7 areas have records · see what to add or review', 'en', {count:'Original {total} label'}), 'Original {total} label of 7 areas have records · see what to add or review', 'replacement values are never interpreted as templates');
});

test('all preparation wording is source-paired and a new unregistered control fails the audit', () => {
  const sources = new Set(REPORT_PREPARATION_COPY.map(row => row.english));
  function audit(name: string, source: string) {
    const tree = typescript.createSourceFile(name, source, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
    function checkLiteral(node: typescript.Node) {
      if (typescript.isStringLiteral(node)) assert.ok(sources.has(node.text), `unregistered preparation control: ${node.text}`);
      else if (typescript.isConditionalExpression(node)) { checkLiteral(node.whenTrue); checkLiteral(node.whenFalse); }
    }
    function visit(node: typescript.Node) {
      if (typescript.isCallExpression(node) && typescript.isIdentifier(node.expression) && node.expression.text === 'copy' && node.arguments[0]) checkLiteral(node.arguments[0]);
      typescript.forEachChild(node, visit);
    }
    visit(tree);
  }
  audit('preparation.tsx', read('components/report/ReportPreparation.tsx'));
  audit('readiness.ts', read('lib/report-readiness.ts'));
  const component = read('components/report/ReportPreparation.tsx');
  assert.ok(component.includes("setError('The site could not be saved. Keep this page open and try again.')"));
  assert.ok(sources.has('The site could not be saved. Keep this page open and try again.'));
  assert.throws(() => audit('broken.tsx', "copy('New unregistered instruction')"), /unregistered preparation control/);
});

test('translated preparation preserves prior English behavior, evidence presence and saved measurements in every state', () => {
  for (const row of fixture.cases) {
    const before = JSON.stringify(row);
    const english = reportPreparation(row.inputs, row.evidence, row.records);
    assert.deepEqual(english, row.english, `${row.name}: original English behavior changed`);
    assert.deepEqual(reportPreparation(row.inputs, row.evidence, row.records, 'unsupported'), english);
    for (const language of languages) {
      const native = reportPreparation(row.inputs, row.evidence, row.records, language);
      assert.deepEqual(native.map(item => [item.id, item.hasRecord]), english.map(item => [item.id, item.hasRecord]), `${language}/${row.name}: translation changed readiness`);
      for (const [at, item] of native.entries()) {
        for (const field of ['title', 'status', 'detail', 'action'] as const) {
          assert.notEqual(item[field], english[at][field], `${language}/${row.name}/${item.id}/${field}: English fallback`);
          assert.deepEqual(digits(item[field]), digits(english[at][field]), `${language}/${row.name}/${item.id}/${field}: lost a source figure`);
          assert.doesNotMatch(item[field], /\{\w+\}/, 'all presentation placeholders should be replaced');
        }
      }
      if (row.records.facts?.boundary) assert.ok(native.find(item => item.id === 'boundary')!.detail.includes(row.records.facts.boundary.source), 'recorded source labels stay verbatim');
      const latest = row.records.maps?.latestAt;
      if (latest && Number.isFinite(Date.parse(latest))) assert.ok(native.find(item => item.id === 'design')!.detail.includes(recordsDate(language, new Date(latest), true)));
    }
    assert.equal(JSON.stringify(row), before, `${row.name}: translating mutated saved input`);
  }
});

test('the real preparation panel follows app language, keeps typed names and repaints a storage failure without remounting', async () => {
  class MemoryStorage {
    rows = new Map<string, string>();
    throwOnWrite = false;
    getItem(key: string) { return this.rows.get(key) ?? null; }
    setItem(key: string, value: string) { if (this.throwOnWrite) throw new Error('quota exceeded'); this.rows.set(key, value); }
    removeItem(key: string) { this.rows.delete(key); }
    key(index: number) { return [...this.rows.keys()][index] ?? null; }
    get length() { return this.rows.size; }
  }
  const storage = new MemoryStorage();
  const browser = Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage });
  const savedGlobals = Object.fromEntries(['Storage', 'localStorage', 'sessionStorage', 'window', 'self', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ Storage: MemoryStorage, localStorage: storage, sessionStorage: storage, window: browser, self: globalThis, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const data = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.endsWith('.css')) return { url: data('export default new Proxy({}, { get: (_, key) => key });'), shortCircuit: true };
      // Dialog bodies are outside this checklist; the panel and its real stores/hooks remain mounted.
      if (context.parentURL?.endsWith('/components/report/ReportPreparation.tsx') && specifier === 'next/dynamic') return { url: data('export default function dynamic(){return function Dialog(){return null;};}'), shortCircuit: true };
      if (specifier === '@/lib/firebase/init' || specifier === './firebase/init') return { url: data('export const getFirebase=()=>({auth:{currentUser:null}});export const isBackendConfigured=()=>false;'), shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: typescript.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: typescript.JsxEmit.ReactJSX, module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
      }).outputText };
      return next(url, context);
    },
  });
  let view: any;
  const { act, create } = await import('react-test-renderer');
  try {
    const { Ctx } = await import('../lib/i18n-context.ts');
    const Panel = (await import('../components/report/ReportPreparation.tsx')).default;
    const saved: unknown[] = [];
    const element = (lang: string) => React.createElement(Ctx.Provider, { value: { lang, setLang() {}, t: (key: string) => key, onboarded: true, completeOnboarding() {} } }, React.createElement(Panel, { location: DEMO_LOCATION, onSavedPlace: value => saved.push(value), onChanged() {}, snapshot: true, maps: {count:2,latestAt:'2026-10-21T08:00:00Z'}, onViewMaps() {} }));
    const textOf = (node: any): string => typeof node === 'string' ? node : node?.children?.map(textOf).join('') ?? '';
    await act(async () => { view = create(element('en')); });
    await act(async () => view.root.findByType('input').props.onChange({ target: { value: 'My original garden {count}' } }));
    storage.throwOnWrite = true;
    await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    storage.throwOnWrite = false;
    for (const lang of languages) {
      await act(async () => view.update(element(lang)));
      const copy = (source: string) => reportPreparationText(source, lang);
      const text = textOf(view.toJSON());
      assert.equal(view.root.findByType('section').props.lang, lang);
      assert.equal(view.root.findByType('section').props['aria-label'], copy('Improve this report'));
      assert.equal(view.root.findByType('input').props.value, 'My original garden {count}');
      assert.equal(view.root.findByType('input').props.placeholder, copy('Your garden or site name'));
      assert.equal(view.root.findAllByType('article').length, 7);
      assert.equal(textOf(view.root.findByProps({ role: 'alert' })), copy('The site could not be saved. Keep this page open and try again.'));
      for (const source of ['Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.', 'This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.', 'Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.']) assert.ok(text.includes(copy(source)), `${lang}: missing source limitation`);
      assert.ok(!text.includes('Test results not recorded'));
      assert.deepEqual(saved, [], 'failed saves must not report success');
    }
    await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal((saved[0] as {name:string}).name, 'My original garden {count}', 'saving must retain the typed name');
    assert.equal(view.root.findAllByProps({role:'alert'}).length, 0);
  } finally {
    if (view) await act(async () => view.unmount());
    hooks.deregister();
    for (const [key, descriptor] of Object.entries(savedGlobals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
