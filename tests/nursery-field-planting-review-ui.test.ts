import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { NurseryReviewData, NurseryReviewLocale, NurseryReviewRow } from '../lib/international/locales/nursery-field-planting-review';

const previous = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0, runtimeReaderImport: 0 };
const storage = () => { effects.storage++; throw Error('Reviewing drafts must not persist a language or an approval'); };
const request = () => { effects.network++; throw Error('The worksheet receives data; it must not fetch packets or publish them'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: request }, window: { value: browser }, localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const root = new URL('../', import.meta.url).href;
const asModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/international/locales/NurseryFieldPlantingDraftReview.tsx')) {
      // Data is supplied by the server. Pulling its crypto/filesystem reader into
      // this client import is a real bundle boundary regression, not a stubbed API.
      if (specifier === '@/lib/international/locales/nursery-field-planting-review' || specifier.startsWith('node:')) {
        effects.runtimeReaderImport++; throw Error('The client may import review data types only');
      }
      if (specifier === 'next/link') return asModule(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement("a",props,children);}`);
      if (specifier === '@/components/MenuButton') return asModule('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return asModule('export function useRegisterBackControl(){}');
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: Review } = await import('../components/international/locales/NurseryFieldPlantingDraftReview.tsx');
const { nurseryFieldPlantingReviewCsv } = await import('../lib/international/locales/nursery-field-planting-review-csv.ts');
const importEffects = { ...effects };
const locales: NurseryReviewLocale[] = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id'];
const sourceFiles: NurseryReviewRow['sourceFile'][] = [
  'components/crops/NurseryFieldPlantingObservationForm.tsx',
  'components/journal/JournalNurseryFieldPlantingSummary.tsx',
  'components/crops/SavedGrowerNurseryReviewPanel.tsx',
];
function data(): NurseryReviewData {
  return { sourceSha256: 'a'.repeat(64), capturedOn: '2026-11-05', issue: null,
    sources: sourceFiles.map(path => ({ path, status: 'matched' })),
    languages: locales.map(locale => ({ locale, rows: Array.from({ length: 26 }, (_, index) => ({
      key: `nurseryFieldPlanting.message.${String(index + 1).padStart(2, '0')}`,
      sourceFile: sourceFiles[index % sourceFiles.length],
      frozenEnglish: `Synthetic English review wording ${index + 1}`,
      currentEnglish: `Synthetic English review wording ${index + 1}`,
      translation: `${locale} synthetic draft wording ${index + 1}`,
      state: 'draft', issues: [],
    })) })),
  };
}
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
const mounted = new Set<ReactTestRenderer>();
function mount(input = data()) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Review, { data: input })); }); mounted.add(renderer);
  const label = (prefix: string) => {
    const found = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(found, prefix); return found;
  };
  return { renderer, text: () => text(renderer.root),
    language: () => label('Draft language').findByType('select'),
    search: () => label('Find a key').findByType('input'),
    article: (key: string) => renderer.root.findByProps({ 'aria-label': `Draft comparison for ${key}` }),
    downloadButton: () => renderer.root.findAllByType('button').find(node => text(node) === 'Download draft review worksheet (CSV)')!,
    choose(locale: string) { act(() => label('Draft language').findByType('select').props.onChange({ target: { value: locale } })); },
    find(value: string) { act(() => label('Find a key').findByType('input').props.onChange({ target: { value } })); },
    download() { act(() => renderer.root.findAllByType('button').find(node => text(node) === 'Download draft review worksheet (CSV)')!.props.onClick()); },
    update(next: NurseryReviewData) { act(() => renderer.update(React.createElement(Review, { data: next }))); },
  };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.runtimeReaderImport = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0, runtimeReaderImport: 0 });
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('the actual client compares seven inactive packets with Brazilian Portuguese kept distinct from the general Portuguese draft', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0, runtimeReaderImport: 0 }); const ui = mount();
  assert.equal(ui.language().props.value, 'fr'); assert.match(ui.language().props.className, /min-h-11/);
  const options = ui.language().findAllByType('option');
  assert.deepEqual(options.map(option => option.props.value), locales);
  assert.match(text(options.find(option => option.props.value === 'pt-BR')!), /Brazilian Portuguese/);
  assert.equal(options.some(option => option.props.value === 'pt'), false);
  assert.match(ui.text(), /26 structurally valid drafts/); assert.match(ui.text(), /not reviewed translation coverage/);
  for (const locale of locales) {
    ui.choose(locale); assert.equal(ui.language().props.value, locale);
    const first = ui.article('nurseryFieldPlanting.message.01');
    const translated = first.findAllByType('p').find(node => node.props.lang === locale)!;
    assert.ok(translated); assert.match(text(translated), new RegExp(`^${locale} synthetic draft wording 1$`));
    assert.equal(translated.findByType('bdi').props.dir, 'auto');
    assert.match(text(first), /AI draft, not fluent human approval/);
  }
  ui.choose('pt'); assert.equal(ui.language().props.value, 'id', 'unlisted locale cannot become a runtime-language choice');
  assert.match(ui.text(), /Fluent human approval is not recorded here/); assert.match(ui.text(), /no review decisions are saved/);
});

test('print comparisons keep their header, source and full wording together without clipping long cards', () => {
  // Actual A4 preview output stranded comparison14's header on page4 and its body on page5.
  // Mark the comparison box for the scoped print rule, while retaining oversized content so
  // the browser can fragment cards that cannot fit a whole page rather than hiding wording.
  const input = data();
  const longDraft = 'Synthetic long review wording. '.repeat(2000);
  input.languages[0].rows[13].translation = longDraft;
  const ui = mount(input);
  const articles = ui.renderer.root.findAllByType('article');
  assert.equal(articles.length, 26);
  for (const article of articles) {
    assert.equal(article.props['data-nursery-draft-comparison'], true);
    assert.doesNotMatch(article.props.className, /(?:^|\s)(?:h-\S+|max-h-\S+|overflow-hidden|line-clamp-\S+)(?:\s|$)/,
      'avoiding a page split must not truncate or fix the height of a comparison');
  }
  const longCard = ui.article('nurseryFieldPlanting.message.14');
  const translation = longCard.findAllByType('p').find(node => node.props.lang === 'fr')!;
  assert.equal(text(translation.findByType('bdi')), longDraft);
  assert.match(text(longCard), /nurseryFieldPlanting\.message\.14/);
  assert.match(text(longCard), /AI draft, not fluent human approval/);
});

test('changed and unavailable current files expose frozen English as a snapshot and never label it current verified wording', () => {
  const input = data(); input.sources[0].status = 'changed'; input.sources[1].status = 'unavailable';
  for (const language of input.languages) for (const row of language.rows) if (row.sourceFile !== sourceFiles[2]) {
    row.currentEnglish = null; row.state = 'source-missing'; row.issues = ['Current English source is missing; no translation can be certified.'];
  }
  const ui = mount(input);
  assert.match(ui.text(), /Current file changed · source binding unavailable/); assert.match(ui.text(), /Current file unavailable · source binding unavailable/);
  assert.match(ui.text(), /8 structurally valid drafts/); assert.match(ui.text(), /18 rows needing source or draft attention/);
  const row = ui.article('nurseryFieldPlanting.message.01');
  assert.match(text(row), /Frozen English snapshot — current source unavailable/); assert.match(text(row), /This frozen wording is not verified as the current English source/);
  assert.equal(row.findAllByType('h3').some(heading => text(heading) === 'Current English'), false);
  assert.match(text(row), /Synthetic English review wording 1/); assert.match(text(row), /Current English source is missing; no translation can be certified/);
  assert.equal(row.findAllByType('p').find(node => node.props.lang === 'en')!.findByType('bdi').props.dir, 'auto');
});

test('invalid or missing draft text stays visibly invalid and is not counted as structural or human-reviewed coverage', () => {
  const input = data(); const french = input.languages.find(language => language.locale === 'fr')!;
  for (const row of french.rows) { row.translation = null; row.state = 'invalid'; row.issues = ['The inactive draft packet is missing or does not match this source and locale.']; }
  const ui = mount(input);
  assert.match(ui.text(), /0 structurally valid drafts/); assert.match(ui.text(), /26 rows needing source or draft attention/);
  const row = ui.article('nurseryFieldPlanting.message.01'); assert.match(text(row), /Invalid draft packet or message/);
  assert.match(text(row), /The inactive draft packet is missing or does not match this source and locale/);
  const missing = row.findAllByType('p').find(node => text(node) === 'No draft text is available for comparison.')!;
  assert.equal(missing.props.lang, 'en', 'English absence wording must not masquerade as French');
  ui.choose('es'); assert.match(ui.text(), /26 structurally valid drafts/);
});

test('an unverifiable frozen packet shows the supplied failure without inventing comparison rows or source success', () => {
  const input = data(); input.issue = 'The frozen English packet could not be verified. No draft comparison is available.';
  input.languages = []; input.sources = sourceFiles.map(path => ({ path, status: 'unavailable' }));
  const ui = mount(input);
  assert.match(ui.text(), /The frozen English packet could not be verified/); assert.match(ui.text(), /No draft comparison is available for French/);
  assert.equal(ui.renderer.root.findAllByType('article').length, 0); assert.match(ui.text(), /0 structurally valid drafts/);
  assert.doesNotMatch(ui.text(), /Current file fingerprint matches the frozen capture/);
});

test('review search matches keys, English and selected draft text, and reports an empty result without changing data', () => {
  const input = data(); input.languages.find(language => language.locale === 'es')!.rows[12].translation = 'Única etiqueta de revisión';
  const afterSetup = JSON.stringify(input); const ui = mount(input);
  ui.find('message.09'); assert.equal(ui.renderer.root.findAllByType('article').length, 1); assert.match(ui.text(), /Showing 1 of 26 rows/);
  ui.find('English review wording 26'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  ui.choose('es'); ui.find('única etiqueta'); assert.equal(ui.renderer.root.findAllByType('article').length, 1); assert.match(ui.text(), /Única etiqueta de revisión/);
  ui.find('not-a-real-packet-wording'); assert.equal(ui.renderer.root.findAllByType('article').length, 0); assert.match(ui.text(), /No messages match this search/);
  assert.equal(ui.language().props.value, 'es'); assert.equal(JSON.stringify(input), afterSetup);
  ui.find(''); assert.equal(ui.renderer.root.findAllByType('article').length, 26);
});

test('a later supplied source failure withdraws the earlier comparison status without discarding its frozen snapshot', () => {
  const input = data(); const ui = mount(input); assert.match(ui.text(), /26 structurally valid drafts/);
  const changed = data(); changed.sources[0].status = 'changed';
  const row = changed.languages[0].rows[0]; row.currentEnglish = null; row.state = 'source-missing'; row.issues = ['Current source changed.'];
  ui.update(changed); assert.match(ui.text(), /25 structurally valid drafts/);
  assert.match(text(ui.article(row.key)), /Frozen English snapshot — current source unavailable/);
  assert.match(text(ui.article(row.key)), /Current source changed/);
});

test('hostile draft strings remain isolated text, with only a worksheet download and no approval controls or executable markup', () => {
  const input = data(); const payload = '<script>fetch("https://invalid.example/collect")</script><img src=x onerror="alert(1)">';
  input.languages[0].rows[0].translation = payload; const before = JSON.stringify(input); const ui = mount(input);
  const row = ui.article('nurseryFieldPlanting.message.01'); const draft = row.findAllByType('p').find(node => node.props.lang === 'fr')!;
  assert.equal(text(draft.findByType('bdi')), payload); assert.deepEqual(draft.findByType('bdi').children, [payload]);
  for (const element of ['script', 'img', 'iframe', 'form'] as const) assert.equal(ui.renderer.root.findAllByType(element).length, 0, element);
  assert.deepEqual(ui.renderer.root.findAllByType('button').map(node => text(node)), ['Download draft review worksheet (CSV)']);
  assert.match(ui.downloadButton().props.className, /min-h-11/);
  assert.equal(ui.renderer.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML')).length, 0);
  assert.equal(ui.renderer.root.findAllByType('input').length, 1); assert.equal(ui.search().props.type, 'search');
  assert.equal(ui.renderer.root.findAllByType('select').length, 1);
  const links = ui.renderer.root.findAllByType('a'); assert.equal(links.length, 1); assert.equal(links[0].props.href, '/international/locales');
  assert.equal(links[0].props.prefetch, false); assert.match(links[0].props.className, /min-h-11/);
  assert.equal(links.some(link => Object.hasOwn(link.props, 'download')), false);
  assert.match(ui.text(), /do not activate a language or change the app’s language choices, calibrated lessons, audio, country, currency, units or local farming readiness/);
  assert.equal(JSON.stringify(input), before);
});

async function withDownloads(run: (state: {
  blobs: Blob[];
  anchors: { href: string; download: string; rel: string; appended: boolean; clicked: boolean; removed: boolean }[];
  revoked: string[];
  flush: () => void;
}) => Promise<void>) {
  const globals = new Map(['document', 'Blob', 'setTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const createBefore = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), revokeBefore = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const nativeTimeout = globalThis.setTimeout, NativeBlob = globalThis.Blob;
  const pending: (() => void)[] = [], blobs: Blob[] = [], revoked: string[] = [];
  const anchors: { href: string; download: string; rel: string; appended: boolean; clicked: boolean; removed: boolean }[] = [];
  class WorksheetBlob extends NativeBlob {}
  Object.defineProperty(globalThis, 'Blob', { configurable: true, writable: true, value: WorksheetBlob });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag: string) {
      assert.equal(tag, 'a'); const anchor = { href: '', download: '', rel: '', appended: false, clicked: false, removed: false,
        click() { assert.equal(this.appended, true); this.clicked = true; }, remove() { this.removed = true; } };
      anchors.push(anchor); return anchor;
    },
    body: { appendChild(anchor: typeof anchors[number]) { assert.ok(anchors.includes(anchor)); anchor.appended = true; } },
  } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => {
    assert.ok(blob instanceof WorksheetBlob); blobs.push(blob); return `blob:nursery-review-${blobs.length}`;
  } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url: string) => { revoked.push(url); } });
  // Capture only the real shared delivery helper's delayed object-URL cleanup.
  // No ten-second timers or object URLs outlive this test.
  Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: (callback: () => void, delay?: number, ...args: unknown[]) => {
    if (delay === 10_000) { pending.push(callback); return 0; }
    return nativeTimeout(callback, delay, ...args);
  } });
  const flush = () => { for (const callback of pending.splice(0)) callback(); };
  try { await run({ blobs, anchors, revoked, flush }); }
  finally {
    flush();
    if (createBefore) Object.defineProperty(URL, 'createObjectURL', createBefore); else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revokeBefore) Object.defineProperty(URL, 'revokeObjectURL', revokeBefore); else Reflect.deleteProperty(URL, 'revokeObjectURL');
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
}

test('the real formatter and shared download helper export every selected-language row regardless of the search filter', async () => withDownloads(async state => {
  const input = data(), before = JSON.stringify(input); const ui = mount(input);
  ui.choose('pt-BR'); ui.find('message.09'); assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  assert.equal(ui.downloadButton().props.disabled, false); ui.download();
  assert.equal(state.blobs.length, 1); assert.equal(state.blobs[0].type, 'text/csv;charset=utf-8');
  const portuguese = input.languages.find(language => language.locale === 'pt-BR')!;
  const portugueseRaw = new Uint8Array(await state.blobs[0].arrayBuffer());
  const portugueseExpected = nurseryFieldPlantingReviewCsv('pt-BR', portuguese.rows);
  // Blob.text() consumes the UTF-8 BOM. Compare the delivered bytes first,
  // then retain the marker while decoding the text assertions below.
  assert.deepEqual(portugueseRaw, new TextEncoder().encode(portugueseExpected));
  assert.deepEqual(portugueseRaw.slice(0, 3), new Uint8Array([0xef, 0xbb, 0xbf]));
  const portugueseBytes = new TextDecoder('utf-8', { ignoreBOM: true }).decode(portugueseRaw);
  assert.equal(portugueseBytes, portugueseExpected);
  assert.ok(portugueseBytes.includes('nurseryFieldPlanting.message.26')); assert.ok(portugueseBytes.includes('pt-BR synthetic draft wording 26'));
  assert.equal(portugueseBytes.includes('fr synthetic draft wording'), false);
  const worksheetLines = portugueseBytes.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
  assert.equal(worksheetLines.length, 27); assert.match(worksheetLines[0], /"Human review"/);
  assert.equal(worksheetLines.slice(1).filter(line => line.endsWith(',"unreviewed",""')).length, 26, 'every exported row remains unreviewed with an empty worksheet note');
  assert.equal(state.anchors[0].download, 'nursery-field-planting-drafts-pt-BR.csv'); assert.equal(state.anchors[0].rel, 'noopener');
  assert.equal(state.anchors[0].clicked, true); assert.equal(state.anchors[0].removed, true);
  assert.ok(ui.renderer.root.findAllByProps({ role: 'status' }).some(node => text(node) === 'Worksheet download requested. Check your downloads.'));
  assert.equal(ui.renderer.root.findAllByProps({ role: 'status' }).some(node => /saved successfully|file saved|download confirmed/i.test(text(node))), false);

  ui.find('no-visible-matches'); assert.equal(ui.renderer.root.findAllByType('article').length, 0); ui.download();
  assert.deepEqual(new Uint8Array(await state.blobs[1].arrayBuffer()), portugueseRaw, 'search is a view filter, not an export selection');
  ui.choose('hi'); ui.download(); const hindi = input.languages.find(language => language.locale === 'hi')!;
  assert.deepEqual(new Uint8Array(await state.blobs[2].arrayBuffer()), new TextEncoder().encode(nurseryFieldPlantingReviewCsv('hi', hindi.rows)));
  assert.equal(state.anchors[2].download, 'nursery-field-planting-drafts-hi.csv');
  assert.match(ui.text(), /Exporting never approves translations or saves review decisions/);
  assert.match(ui.text(), /Fluent human approval is not recorded here/); assert.equal(JSON.stringify(input), before);
  assert.deepEqual(state.revoked, []); state.flush();
  assert.deepEqual(state.revoked, ['blob:nursery-review-1', 'blob:nursery-review-2', 'blob:nursery-review-3']);
}));

test('an unavailable source packet or absent selected rows cannot request even a programmatically invoked worksheet action', async () => withDownloads(async state => {
  const broken = data(); broken.issue = 'The frozen English packet could not be verified.';
  const ui = mount(broken); assert.equal(ui.downloadButton().props.disabled, true); ui.download();
  const missing = data(); missing.languages = []; ui.update(missing); assert.equal(ui.downloadButton().props.disabled, true); ui.download();
  const empty = data(); empty.languages[0].rows = []; ui.update(empty); assert.equal(ui.downloadButton().props.disabled, true); ui.download();
  assert.equal(state.blobs.length, 0); assert.equal(state.anchors.length, 0); assert.deepEqual(state.revoked, []);
  assert.equal(ui.renderer.root.findAllByProps({ role: 'status' }).some(node => text(node) === 'Worksheet download requested. Check your downloads.'), false);
}));
