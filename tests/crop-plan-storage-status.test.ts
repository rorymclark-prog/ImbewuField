import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

type Status = { status: 'ready' | 'held' | 'sample'; reason?: string; writable: boolean; needsInitialisation: boolean; legacyDiverged: boolean };
type Context = { legacyKey: string; canonicalKey: string; receiptKey: string; sample: boolean; isCurrent: () => boolean };
const ready = (): Status => ({ status: 'ready', writable: true, needsInitialisation: false, legacyDiverged: false });
const held = (reason: string): Status => ({ status: 'held', reason, writable: false, needsInitialisation: reason === 'upgrade-required', legacyDiverged: reason === 'legacy-diverged' });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const events = new EventTarget();
const probe = {
  auth: { user: null as { uid: string } | null, loading: false, cropPlanMigrationHold: null as string | null,
    retryCropPlanMigration: async () => {} },
  owner: null as string | null, sample: false, status: ready(), contexts: [] as Context[],
  initialisations: [] as Context[], recoveries: [] as Context[], releases: 0, reads: 0, changed: 0,
  initialise: null as null | ((context: Context) => Promise<Status>), recover: null as null | ((context: Context) => Promise<Status>),
  reviewStamp: 1, keeps: 0, keepResult: 'kept' as 'kept' | 'held' | 'superseded', downloads: [] as string[], blobs: [] as Blob[],
};
Object.assign(globalThis, { __cropStorageNoticeProbe: probe });
Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
if (typeof CustomEvent === 'undefined') Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class extends Event {} });
events.addEventListener('imbewu-crop-plan-changed', () => { ++probe.changed; });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const authModule = moduleUrl('export const useAuth = () => globalThis.__cropStorageNoticeProbe.auth;');
const storageModule = moduleUrl(`
const p = globalThis.__cropStorageNoticeProbe;
export const CROP_PLAN_STORAGE_EVENT = 'imbewu-crop-plan-storage-changed';
export function makeBrowserCropPlanStorageContext() {
  const owner = p.owner, sample = p.sample;
  const context = { storage: {}, legacyKey: 'private-legacy:' + owner, canonicalKey: 'private-current:' + owner,
    receiptKey: 'private-proof:' + owner, sample, isCurrent: () => p.owner === owner && p.sample === sample };
  p.contexts.push(context); return context;
}
export function readCropPlanStorageStatus(context) { ++p.reads; return context?.isCurrent() ? p.status : { status:'held',reason:'context-changed',writable:false,needsInitialisation:false,legacyDiverged:false }; }
export function initialiseCropPlanStorage(context) { p.initialisations.push(context); return p.initialise ? p.initialise(context) : Promise.resolve(p.status); }
export function recoverCropPlanStorage(context) { p.recoveries.push(context); return p.recover ? p.recover(context) : Promise.resolve(p.status); }
export function releaseAllDocumentCropPlanLeases() { ++p.releases; }
export function readCropPlanLegacyReview(context) { return p.status.legacyDiverged && context.isCurrent()
  ? {status:'available', currentSavedRows:4, olderSavedRows:4, review:{stamp:p.reviewStamp,context}} : null; }
export function cropPlanLegacyReviewIsCurrent(review,context) { return review.stamp === p.reviewStamp && review.context.isCurrent() && context.isCurrent() && p.status.legacyDiverged; }
export function exportCropPlanLegacyReview(review,context) { return cropPlanLegacyReviewIsCurrent(review,context)
  ? {filename:'crop-plan-copies.json',json:JSON.stringify({exportVersion:1,canonicalBookRaw:'private-current-book',olderBookRaw:'private-older-book'})} : null; }
export async function keepCurrentCropPlanAfterLegacyReview(review,context) { ++p.keeps;
  if(!cropPlanLegacyReviewIsCurrent(review,context)) return {status:'superseded'};
  if(p.keepResult==='kept') p.status={status:'ready',writable:true,needsInitialisation:false,legacyDiverged:false};
  return {status:p.keepResult}; }
`);
const originalCreateObjectUrl = URL.createObjectURL, originalRevokeObjectUrl = URL.revokeObjectURL;
URL.createObjectURL = blob => { probe.blobs.push(blob as Blob); return 'blob:local-copy-proof'; };
URL.revokeObjectURL = () => {};
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: (tag: string) => {
  assert.equal(tag, 'a'); const anchor = { href: '', download: '', click() { probe.downloads.push(anchor.download); } }; return anchor;
} } });
const componentUrl = new URL('../components/CropPlanStorageStatus.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl) {
      if (specifier === '@/lib/auth') return { url: authModule, shortCircuit: true };
      if (specifier === '@/lib/crop-plan-storage') return { url: storageModule, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});
const { default: Provider, CropPlanStorageNotice: Notice } = await import('../components/CropPlanStorageStatus.tsx');
after(() => { hooks.deregister(); URL.createObjectURL = originalCreateObjectUrl; URL.revokeObjectURL = originalRevokeObjectUrl;
  delete (globalThis as Record<string, unknown>).__cropStorageNoticeProbe; });
beforeEach(() => {
  probe.auth = { user: null, loading: false, cropPlanMigrationHold: null, retryCropPlanMigration: async () => {} };
  probe.owner = null; probe.sample = false; probe.status = ready();
  probe.contexts = []; probe.initialisations = []; probe.recoveries = []; probe.releases = 0; probe.reads = 0; probe.changed = 0;
  probe.initialise = null; probe.recover = null;
  probe.reviewStamp = 1; probe.keeps = 0; probe.keepResult = 'kept'; probe.downloads = []; probe.blobs = [];
});
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(value => text(value as ReactTestInstance | string)).join(''); }
function mount(notices = 1) {
  let renderer!: ReactTestRenderer;
  const tree = () => React.createElement(Provider, { children: React.createElement('main', null,
    Array.from({ length: notices }, (_, index) => React.createElement(Notice, { key: index }))) });
  act(() => { renderer = create(tree()); });
  return { renderer, text: () => text(renderer.root),
    async flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); },
    update() { act(() => { renderer.update(tree()); }); },
    event(name: string, key?: string | null) { act(() => { const e = new Event(name); if (key !== undefined) Object.defineProperty(e, 'key', { value: key }); events.dispatchEvent(e); }); },
    async click(label: string) { const button = renderer.root.findAllByType('button').find(value => text(value) === label); assert.ok(button); await act(async () => { button.props.onClick(); await Promise.resolve(); }); },
    dispose() { act(() => { renderer.unmount(); }); },
  };
}

test('the one headless provider waits for account binding and multiple inline notices do not acquire duplicate editing leases', async () => {
  probe.auth.loading = true;
  const ui = mount(2);
  try {
    await ui.flush(); assert.equal(probe.initialisations.length, 0); assert.match(ui.text(), /Checking crop-plan storage/);
    probe.auth.loading = false; ui.update(); await ui.flush();
    assert.equal(probe.initialisations.length, 1); assert.equal(ui.text(), '');
    ui.update(); await ui.flush(); assert.equal(probe.initialisations.length, 1, 'unrelated renders cannot request another lease');
  } finally { ui.dispose(); }
});

test('a denied writer remains visibly read-only through passive focus checks and only explicit Retry requests another lease', async () => {
  probe.status = held('another-writer'); const ui = mount();
  try {
    await ui.flush(); assert.match(ui.text(), /Another tab may be editing/); assert.doesNotMatch(ui.text(), /private-current/);
    probe.status = held('writer-not-acquired'); ui.event('focus'); await ui.flush();
    assert.match(ui.text(), /Another tab may be editing/); assert.equal(probe.initialisations.length, 1);
    probe.status = ready(); await ui.click('Retry crop-plan check'); await ui.flush();
    assert.equal(probe.initialisations.length, 2); assert.equal(ui.text(), '');
  } finally { ui.dispose(); }
});

test('a legacy storage event withdraws ready state and explains retained copy divergence without inventing a merge or leaking storage identities', async () => {
  const ui = mount();
  try {
    await ui.flush(); const initialChanges = probe.changed, initialReads = probe.reads;
    ui.event('storage', 'some-other-store'); assert.equal(probe.reads, initialReads);
    probe.status = held('legacy-diverged'); ui.event('storage', probe.contexts[0].legacyKey); await ui.flush();
    assert.match(ui.text(), /An older app session changed its previous copy/);
    assert.match(ui.text(), /Download both copies to compare them/);
    assert.match(ui.text(), /Matching row counts do not mean the dates, quantities or settings match/);
    assert.equal(ui.renderer.root.findAllByType('details').length, 1);
    assert.doesNotMatch(ui.text(), /private-|imbewu_crop|cutoverId|bookRaw|saved successfully/);
    assert.equal(probe.changed, initialChanges + 1);
    ui.event('focus'); ui.event('imbewu-crop-plan-storage-changed'); await ui.flush();
    assert.equal(probe.changed, initialChanges + 1, 'unchanged status does not loop crop-plan admission events');
    assert.equal(probe.initialisations.length, 1, 'copy divergence never triggers automatic reimport');
  } finally { ui.dispose(); }
});

test('late setup from a preceding account cannot publish a ready status or retain authority under the next account', async () => {
  probe.owner = 'owner-a'; probe.auth.user = { uid: 'owner-a' };
  const first = deferred<Status>(), second = deferred<Status>();
  probe.initialise = context => context.canonicalKey.endsWith('owner-a') ? first.promise : second.promise;
  const ui = mount();
  try {
    await ui.flush(); const old = probe.initialisations[0];
    probe.owner = 'owner-b'; probe.auth.user = { uid: 'owner-b' }; ui.update(); await ui.flush();
    assert.equal(old.isCurrent(), false); assert.equal(probe.initialisations.length, 2);
    first.resolve(ready()); await ui.flush(); assert.match(ui.text(), /Checking crop-plan storage/);
    second.resolve(held('web-locks-unavailable')); await ui.flush();
    assert.match(ui.text(), /This browser cannot safely enable crop-plan editing/);
    assert.doesNotMatch(ui.text(), /owner-a|owner-b/);
  } finally { ui.dispose(); }
});

test('pagehide revokes pending setup before a BFCache pageshow starts a fresh check; old completion cannot grant the new view', async () => {
  const first = deferred<Status>(), second = deferred<Status>();
  probe.initialise = () => probe.initialisations.length === 1 ? first.promise : second.promise;
  const ui = mount();
  try {
    await ui.flush(); const old = probe.initialisations[0];
    ui.event('pagehide'); assert.equal(old.isCurrent(), false); assert.equal(probe.releases, 1);
    ui.event('pageshow'); await ui.flush(); assert.equal(probe.initialisations.length, 2);
    first.resolve(ready()); await ui.flush(); assert.match(ui.text(), /Checking crop-plan storage/);
    second.resolve(held('another-writer')); await ui.flush(); assert.match(ui.text(), /Crop plan is read-only/);
    assert.equal(probe.initialisations[1].isCurrent(), true);
  } finally { ui.dispose(); }
});

test('sample transitions revoke the real lease and the sample branch hides real storage controls instead of presenting a successful persisted save', async () => {
  const ui = mount();
  try {
    await ui.flush(); const original = probe.initialisations[0];
    probe.sample = true; probe.status = { status: 'sample', writable: false, needsInitialisation: false, legacyDiverged: false };
    ui.event('imbewu-sample-mode-changed'); await ui.flush();
    assert.equal(original.isCurrent(), false); assert.equal(probe.releases, 1); assert.equal(ui.text(), '');
    assert.equal(probe.initialisations[1].sample, true);
  } finally { ui.dispose(); }
});

test('interrupted setup recovery is explicit and rechecks editing authority after the actual recovery operation', async () => {
  probe.status = held('cutover-recovery-required');
  probe.recover = async () => { probe.status = ready(); return probe.status; };
  const ui = mount();
  try {
    await ui.flush(); assert.equal(probe.recoveries.length, 0); assert.match(ui.text(), /will not replace an existing saved plan/);
    ui.event('focus'); await ui.flush(); assert.equal(probe.recoveries.length, 0);
    await ui.click('Recover interrupted setup'); await ui.flush();
    assert.equal(probe.recoveries.length, 1); assert.equal(probe.initialisations.length, 2); assert.equal(ui.text(), '');
  } finally { ui.dispose(); }
});

test('a held signed-out transfer never starts empty storage and Retry asks the account migration to finish before initialising', async () => {
  probe.auth.cropPlanMigrationHold = 'guest-transfer-held';
  let retries = 0;
  probe.auth.retryCropPlanMigration = async () => { ++retries; probe.auth.cropPlanMigrationHold = null; };
  const ui = mount();
  try {
    await ui.flush(); assert.equal(probe.initialisations.length, 0); assert.match(ui.text(), /signed-out crop work is still being preserved/);
    ui.event('focus'); await ui.flush(); assert.equal(probe.initialisations.length, 0);
    await ui.click('Retry crop-plan check'); await ui.flush();
    assert.equal(retries, 1); assert.equal(probe.initialisations.length, 1); assert.equal(ui.text(), '');
  } finally { ui.dispose(); }
});

test('keeping the protected plan requires downloaded exact copies and explicit confirmation; equal counts never certify equal contents', async () => {
  probe.status = held('legacy-diverged'); const ui = mount();
  try {
    await ui.flush();
    const choose = () => ui.renderer.root.findAllByType('button').find(node => text(node) === 'Keep current plan; retain older copy for later review')!;
    assert.equal(choose().props.disabled, true);
    await ui.click('Download both copies'); await ui.flush();
    assert.deepEqual(probe.downloads, ['crop-plan-copies.json']);
    assert.equal(probe.blobs.length, 1); assert.match(await probe.blobs[0].text(), /private-current-book/);
    assert.doesNotMatch(ui.text(), /private-current-book|private-older-book|blob:local/);
    assert.equal(choose().props.disabled, true, 'download alone cannot select a saved plan');
    act(() => { ui.renderer.root.findByType('input').props.onChange({ target: { checked: true } }); });
    assert.equal(choose().props.disabled, false);
    await ui.click('Keep current plan; retain older copy for later review'); await ui.flush();
    assert.equal(probe.keeps, 1); assert.match(ui.text(), /Your protected plan is kept/);
    assert.match(ui.text(), /no older changes were merged/);
    ui.event('focus'); await ui.flush(); assert.equal(ui.text(), '');
  } finally { ui.dispose(); }
});

test('another legacy change revokes the downloaded proof and confirmation even when both displayed row counts stay equal', async () => {
  probe.status = held('legacy-diverged'); const ui = mount();
  try {
    await ui.flush(); await ui.click('Download both copies'); await ui.flush();
    act(() => { ui.renderer.root.findByType('input').props.onChange({ target: { checked: true } }); });
    assert.equal(ui.renderer.root.findByType('input').props.checked, true);
    ++probe.reviewStamp;
    ui.event('storage', probe.contexts[0].legacyKey); await ui.flush();
    assert.equal(ui.renderer.root.findByType('input').props.checked, false);
    assert.equal(ui.renderer.root.findByType('input').props.disabled, true);
    assert.equal(probe.keeps, 0);
  } finally { ui.dispose(); }
});

test('an unconfirmed performed choice never offers retry or repeats the write from retained controls', async () => {
  probe.status = held('legacy-diverged'); probe.keepResult = 'superseded';
  const ui = mount();
  try {
    await ui.flush(); await ui.click('Download both copies'); await ui.flush();
    act(() => { ui.renderer.root.findByType('input').props.onChange({ target: { checked: true } }); });
    const retained = ui.renderer.root.findAllByType('button').find(node => text(node) === 'Keep current plan; retain older copy for later review')!.props.onClick;
    await ui.click('Keep current plan; retain older copy for later review'); await ui.flush();
    assert.match(ui.text(), /A choice may have been saved/); assert.match(ui.text(), /Do not repeat it/);
    assert.equal(ui.renderer.root.findAllByType('button').find(node => text(node) === 'Retry crop-plan check')!.props.disabled, true);
    act(() => { retained(); }); await ui.flush(); assert.equal(probe.keeps, 1);
  } finally { ui.dispose(); }
});

test('a rejected or synchronously failing setup remains a visible failure and unmounted pending work loses its context', async () => {
  probe.initialise = () => { throw Error('simulated storage capability failure'); };
  const ui = mount();
  try {
    await ui.flush(); assert.match(ui.text(), /protected storage could not be checked/);
    const pending = deferred<Status>(); probe.initialise = () => pending.promise;
    await ui.click('Retry crop-plan check'); await ui.flush();
    const context = probe.initialisations.at(-1)!;
    ui.dispose(); assert.equal(context.isCurrent(), false);
    pending.resolve(ready()); await act(async () => { await pending.promise; });
    assert.equal(probe.releases, 1);
  } catch (error) { ui.dispose(); throw error; }
});

test('root lifecycle and inline crop notices stay out of the calibrated Finance course and never import the catalogue globally', () => {
  const source = readFileSync(new URL('../components/CropPlanStorageStatus.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('storage-status.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = ast.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual(imports, ['react', '@/lib/auth', '@/lib/crop-plan-storage']);
  const layout = ts.createSourceFile('layout.tsx', readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let correctlyScoped = false;
  function walk(node: ts.Node, parents: string[]) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(layout);
      if (tag === 'CropPlanStorageProvider') correctlyScoped = parents.includes('AuthProvider') && parents.includes('LanguageProvider');
      ts.forEachChild(node, child => walk(child, [...parents, tag]));
    } else ts.forEachChild(node, child => walk(child, parents));
  }
  walk(layout, []); assert.equal(correctlyScoped, true);
  assert.doesNotMatch(readFileSync(new URL('../app/student/finance/page.tsx', import.meta.url), 'utf8'), /CropPlanStorageNotice/);
});
