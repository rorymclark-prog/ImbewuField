import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import typescript from 'typescript';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { groundPhotoSnapshotGallery, MAX_GROUND_PHOTOS, normaliseGroundPhotos, prepareGroundPhotos } from '../lib/report-ground-photos.ts';
import { emptyMapReview, savedReportMapSelection, selectedReportMaps } from '../lib/report-map-selection.ts';
import type { SavedReport } from '../lib/saved-reports.ts';
import type { SavedPlace } from '../lib/saved-places.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  get length() { return this.rows.size; }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const browser = Object.assign(new EventTarget(), {
  localStorage: local, sessionStorage: session,
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
});
for (const [key, value] of Object.entries({ Storage: MemoryStorage, localStorage: local, sessionStorage: session, window: browser })) {
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
const jpeg = (data: string) => `data:image/jpeg;base64,${data}`;
const beforePhoto = { label: 'Soil & growing beds · Erosion', note: 'Before repairs', mediaType: 'image/jpeg' as const, data: 'AAAA' };
const report = (id: string, extra: Partial<SavedReport> = {}): SavedReport => ({
  id, name: 'Original site', savedAt: '2026-10-20T08:00:00Z', lang: 'en',
  report: '# Original report\n\nThe original advice must remain unchanged.',
  location: structuredClone(DEMO_LOCATION), ...extra,
});
const sourceModule = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
const firebase = sourceModule('export const getFirebase=()=>({auth:{currentUser:null}}); export const isBackendConfigured=()=>false;');
const css = sourceModule('export default new Proxy({}, {get:(_,key)=>key});');
const emptyPreparation = sourceModule('export default function Preparation(){return null;}');
const mapImageHarness = { metas: [{ id: 'today-map', label: '08 — Whole design', at: '2026-10-28T10:00:00Z', thumb: jpeg('CCCC') }], images: {} as Record<string, string> };
Object.assign(globalThis, { __reportMapImageHarness: mapImageHarness });
const sheets = sourceModule(`
  export const loadSheetMetas=async()=>globalThis.__reportMapImageHarness.metas;
  export const loadSheetImage=async id=>globalThis.__reportMapImageHarness.images[id] ?? null;
`);
const pdfHarness: { options?: Record<string, unknown>; covers?: Array<{ image: string; caption: string }> } = {};
Object.assign(globalThis, { __reportSnapshotPdfHarness: pdfHarness });
const pdf = sourceModule(`
  export const buildReportPdf=async(_body,options)=>{globalThis.__reportSnapshotPdfHarness.options=options; return new Blob(['test']);};
  export const deliverPdf=async()=>{};
  export const reportPdfFilename=()=> 'report.pdf';
  export const sheetPlate=async dataUrl=>({dataUrl});
  export const stripInlineMarkdown=value=>value;
`);
const pdfAssets = sourceModule('export const prepareVisualPdfAssets=async(_visuals,covers)=>{globalThis.__reportSnapshotPdfHarness.covers=covers;return undefined;};');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.css')) return { url: css, shortCircuit: true };
    if (specifier.endsWith('/ReportPreparation')) return { url: emptyPreparation, shortCircuit: true };
    if (context.parentURL?.endsWith('/components/ReportView.tsx') && specifier === '@/lib/report-pdf') return { url: pdf, shortCircuit: true };
    if (context.parentURL?.endsWith('/components/ReportView.tsx') && specifier === '@/lib/report-visual-pdf') return { url: pdfAssets, shortCircuit: true };
    if (specifier === '@/lib/sheet-store') return { url: sheets, shortCircuit: true };
    if (context.parentURL?.includes('/lib/account-local-storage.ts') && specifier === './firebase/init') return { url: firebase, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: typescript.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: typescript.JsxEmit.ReactJSX, module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    }).outputText };
    return next(url, context);
  },
});
const { saveReport, loadReports } = await import('../lib/saved-reports.ts');
const { Ctx } = await import('../lib/i18n-context.ts');
const { addEvidenceItem, getSiteEvidence } = await import('../lib/site-evidence.ts');
const { designSiteIdFromLocation } = await import('../lib/design-studio.ts');
const { act, create } = await import('react-test-renderer');
const ReportView = (await import('../components/ReportView.tsx')).default;

function reset() { mapImageHarness.metas = [{ id: 'today-map', label: '08 — Whole design', at: '2026-10-28T10:00:00Z', thumb: jpeg('CCCC') }]; mapImageHarness.images = {}; local.clear(); session.clear(); pdfHarness.options = undefined; pdfHarness.covers = undefined; }
const textOf = (node: any): string => typeof node === 'string' ? node : node?.children?.map(textOf).join('') ?? '';

test('saved photograph bytes, captions and advice survive replacement of the live site evidence', () => {
  reset();
  const original = report('frozen', { groundPhotos: [beforePhoto] });
  assert.ok(saveReport(original).saved);
  // This is the normal evidence path, not a mocked gallery value. The report must not read it.
  assert.ok(addEvidenceItem('holding', 'soil_erosion', { type: 'photo', dataUrl: jpeg('BBBB'), note: 'After repairs' }));
  const restored = loadReports()[0];
  assert.deepEqual(restored.groundPhotos, [beforePhoto]);
  assert.equal(restored.report, original.report);
  assert.equal(groundPhotoSnapshotGallery(restored.groundPhotos).shown[0].dataUrl, jpeg('AAAA'));
  assert.notDeepEqual(prepareGroundPhotos(getSiteEvidence('holding')), restored.groundPhotos);
});

test('older reports retain unknown photo history while an explicit empty capture stays empty', () => {
  reset();
  assert.ok(saveReport(report('legacy')).saved);
  assert.ok(saveReport(report('empty', { groundPhotos: [] })).saved);
  const legacy = loadReports().find(row => row.id === 'legacy')!;
  const empty = loadReports().find(row => row.id === 'empty')!;
  assert.equal(legacy.groundPhotos, undefined);
  assert.deepEqual(empty.groundPhotos, []);
  assert.deepEqual(groundPhotoSnapshotGallery(legacy.groundPhotos).shown, []);
});

test('a saved photograph snapshot obeys the same byte and image-count limits as the submitted evidence', () => {
  reset();
  const tooBig = { ...beforePhoto, data: 'A'.repeat(600_000) };
  assert.ok(saveReport(report('bounded', { groundPhotos: [tooBig, ...Array.from({ length: MAX_GROUND_PHOTOS + 3 }, () => beforePhoto)] })).saved);
  const restored = loadReports()[0];
  assert.deepEqual(restored.groundPhotos, normaliseGroundPhotos([tooBig, ...Array.from({ length: MAX_GROUND_PHOTOS + 3 }, () => beforePhoto)]));
  assert.ok(restored.groundPhotos!.length <= MAX_GROUND_PHOTOS);
  assert.ok(restored.groundPhotos!.every(photo => photo.data !== tooBig.data));
  assert.equal(restored.report, report('bounded').report, 'invalid evidence cannot discard valid saved advice');
});

test('unrecorded saved map attachments never become today’s newest design, while a new draft can select it', () => {
  const maps = [{ id: 'today-map', label: '08 — Whole design', at: '2026-10-28T10:00:00Z' }];
  assert.deepEqual(selectedReportMaps(maps, savedReportMapSelection(undefined, 'holding'), 'holding', emptyMapReview()), []);
  assert.equal(selectedReportMaps(maps, undefined, 'holding', emptyMapReview())[0].id, 'today-map');
  assert.deepEqual(selectedReportMaps(maps, savedReportMapSelection({ siteId: 'holding', ids: ['missing-old-map'] }, 'holding'), 'holding', emptyMapReview()), []);
  assert.equal(selectedReportMaps(maps, savedReportMapSelection({ siteId: 'holding', ids: ['today-map'] }, 'holding'), 'holding', emptyMapReview())[0].id, 'today-map');
});

test('the real report screen, cover, PDF and save action use the frozen photos and explicit map attachments', async () => {
  reset();
  const place = { id: 'holding', name: 'Original site', lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon } as SavedPlace;
  assert.ok(addEvidenceItem(place.id, 'soil_erosion', { type: 'photo', dataUrl: jpeg('BBBB'), note: 'After repairs' }));
  const siteId = designSiteIdFromLocation(DEMO_LOCATION);
  const original = report('screen-frozen', { groundPhotos: [beforePhoto], mapSelection: { siteId, ids: [] } });
  let view: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(Ctx.Provider, { value: { lang: 'en', t: key => key, setLang() {}, onboarded: true, completeOnboarding() {} } },
    React.createElement(ReportView, { locationData: DEMO_LOCATION, savedReport: original, savedPlaces: [place], appLang: 'en', onClose() {} }))); });
  try {
    const sources = view!.root.findAllByType('img').map(node => node.props.src);
    assert.ok(sources.includes(jpeg('AAAA')), 'the original evidence must still be visible');
    assert.ok(!sources.includes(jpeg('BBBB')), 'new evidence cannot illustrate historical advice');
    const exportButton = view!.root.findAllByType('button').find(node => textOf(node) === 'Export PDF')!;
    await act(async () => { await exportButton.props.onClick(); });
    assert.deepEqual(pdfHarness.options?.photos, [{ label: beforePhoto.label, note: beforePhoto.note, dataUrl: jpeg('AAAA') }]);
    assert.deepEqual(pdfHarness.options?.sheets, [], 'today’s default map cannot enter an explicit empty report');
    assert.deepEqual(pdfHarness.covers, [{ image: jpeg('AAAA'), caption: beforePhoto.label }]);
    const save = view!.root.findAllByType('button').find(node => textOf(node) === 'Save')!;
    await act(async () => { save.props.onClick(); });
    assert.deepEqual(loadReports()[0].groundPhotos, [beforePhoto]);
    assert.deepEqual(loadReports()[0].mapSelection, { siteId, ids: [] });
  } finally { await act(async () => { view!.unmount(); }); }
});

test('a legacy report exposes unknown attachments without selecting current maps or photos', async () => {
  reset();
  const place = { id: 'holding', name: 'Original site', lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon } as SavedPlace;
  assert.ok(addEvidenceItem(place.id, 'soil_erosion', { type: 'photo', dataUrl: jpeg('BBBB') }));
  let view: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(Ctx.Provider, { value: { lang: 'en', t: key => key, setLang() {}, onboarded: true, completeOnboarding() {} } },
    React.createElement(ReportView, { locationData: DEMO_LOCATION, savedReport: report('legacy-view'), savedPlaces: [place], appLang: 'en', onClose() {} }))); });
  try {
    const text = textOf(view!.toJSON());
    assert.ok(text.includes('Your saved site photos · Not recorded'));
    assert.ok(text.includes('Maps selected for this report · Not recorded'));
    assert.ok(!view!.root.findAllByType('img').some(node => node.props.src === jpeg('BBBB')));
    const exportButton = view!.root.findAllByType('button').find(node => textOf(node) === 'Export PDF')!;
    await act(async () => { await exportButton.props.onClick(); });
    assert.deepEqual(pdfHarness.options?.photos, []);
    assert.deepEqual(pdfHarness.options?.sheets, []);
    const inclusion = view!.root.findAllByType('input').filter(node => node.props.type === 'checkbox');
    const chooseCurrent = inclusion.find(node => node.props.checked === false && !node.props.disabled)!;
    assert.ok(chooseCurrent, 'map checklist should permit a deliberate new selection');
    await act(async () => { chooseCurrent.props.onChange({ target: { checked: true } }); });
    assert.deepEqual(loadReports()[0].mapSelection?.ids, ['today-map']);
    assert.equal(loadReports()[0].groundPhotos, undefined, 'changing maps cannot invent a photo history');
  } finally { await act(async () => { view!.unmount(); }); }
});

test('generation freezes the submitted photographs even if another tab changes evidence before the reply finishes', async () => {
  reset();
  const place = { id: 'holding', name: 'Original site', lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon } as SavedPlace;
  assert.ok(addEvidenceItem(place.id, 'soil_erosion', { type: 'photo', dataUrl: jpeg('AAAA'), note: 'Before repairs' }));
  const originalFetch = globalThis.fetch;
  let submitted: { groundPhotos?: unknown } | undefined;
  globalThis.fetch = async (_url, options) => {
    submitted = JSON.parse(String(options?.body));
    // Simulate a newer photo arriving while the independent report request is in flight.
    assert.ok(addEvidenceItem(place.id, 'soil_erosion', { type: 'photo', dataUrl: jpeg('BBBB'), note: 'After repairs' }));
    return new Response('# Generated report\n\nAdvice about the submitted photograph.');
  };
  let view: ReturnType<typeof create>;
  try {
    await act(async () => { view = create(React.createElement(Ctx.Provider, { value: { lang: 'en', t: key => key, setLang() {}, onboarded: true, completeOnboarding() {} } },
      React.createElement(ReportView, { locationData: DEMO_LOCATION, savedPlaces: [place], appLang: 'en', onClose() {} }))); });
    const generate = view!.root.findAllByType('button').find(node => textOf(node) === 'Generate report')!;
    assert.ok(generate && !generate.props.disabled);
    await act(async () => { await generate.props.onClick(); });
    assert.ok(submitted?.groundPhotos);
    const save = view!.root.findAllByType('button').find(node => textOf(node) === 'Save')!;
    await act(async () => { save.props.onClick(); });
    assert.deepEqual(loadReports()[0].groundPhotos, normaliseGroundPhotos(submitted.groundPhotos));
    assert.deepEqual(loadReports()[0].groundPhotos?.map(photo => photo.data), ['AAAA']);
    assert.ok(view!.root.findAllByType('img').some(node => node.props.src === jpeg('AAAA')));
    assert.ok(!view!.root.findAllByType('img').some(node => node.props.src === jpeg('BBBB')));
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { view?.unmount(); });
  }
});

test('generating and saving advice records only the same-named map version whose image was submitted', async () => {
  reset();
  mapImageHarness.metas = ['unreadable-version', 'submitted-version'].map(id => ({ id, label: '08 — Whole design', at: '2026-10-28T10:00:00Z', thumb: jpeg('CCCC') }));
  mapImageHarness.images = { 'submitted-version': jpeg('AAAA') };
  const originalFetch = globalThis.fetch;
  let submitted: { siteImages?: Array<{ sheetId: string; data: string }> } | undefined;
  globalThis.fetch = async (_url, options) => {
    submitted = JSON.parse(String(options?.body));
    return new Response('# Generated report\n\nAdvice about the submitted map.');
  };
  const siteId = designSiteIdFromLocation(DEMO_LOCATION);
  const saved = report('original-with-two-versions', { mapSelection: { siteId, ids: mapImageHarness.metas.map(map => map.id) } });
  let view: ReturnType<typeof create>;
  try {
    await act(async () => { view = create(React.createElement(Ctx.Provider, { value: { lang: 'en', t: key => key, setLang() {}, onboarded: true, completeOnboarding() {} } },
      React.createElement(ReportView, { locationData: DEMO_LOCATION, savedReport: saved, appLang: 'en', onClose() {} }))); });
    const generate = view!.root.findAllByType('button').find(node => textOf(node) === 'Generate new report')!;
    assert.ok(generate && !generate.props.disabled);
    await act(async () => { await generate.props.onClick(); });
    assert.deepEqual(submitted?.siteImages?.map(image => image.sheetId), ['submitted-version']);
    const save = view!.root.findAllByType('button').find(node => textOf(node) === 'Save')!;
    await act(async () => { save.props.onClick(); });
    assert.deepEqual(loadReports()[0].analysedMapIds, ['submitted-version']);
    assert.deepEqual(loadReports()[0].mapSelection?.ids, ['unreadable-version', 'submitted-version'], 'selection and actual analysis are different records');
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { view?.unmount(); });
  }
});

test.after(() => { hooks.deregister(); });
