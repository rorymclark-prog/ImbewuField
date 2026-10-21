import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import typescript from 'typescript';
import { englishDictionary } from './translation-inventory.ts';
import { translationGaps } from '../lib/lang-coverage.ts';
import { REPORT_UI_KEYS } from '../lib/i18n-pending.ts';
import { beforeReportViewerTranslations, type UiLocale } from './navigation-translation-preservation.ts';
import zu from '../lib/locales/zu.ts';
import st from '../lib/locales/st.ts';
import ts from '../lib/locales/ts.ts';
import ve from '../lib/locales/ve.ts';
import { buildDemoCropPlan, buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import type { SavedReport } from '../lib/saved-reports.ts';

const english = englishDictionary();
const locales = { zu, st, ts, ve };
const codes = ['zu', 'st', 'ts', 've'] as const;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const packet = JSON.parse(read('docs/translation/four-language-completion/report-viewer-drafts.json')) as {
  status: string;
  baseSourceSha256: Record<UiLocale, string>;
  controls: Array<{ english: string; key: string }>;
  entries: Array<{ key: string; english: string; legacyZulu?: string } & Partial<Record<UiLocale, string>>>;
  preserved: Array<{ key: string; language: UiLocale; wording: string }>;
};

test('report drafts preserve source values and every pre-existing locale byte outside their declared changes', () => {
  assert.match(packet.status, /Unreviewed AI drafts/);
  for (const row of packet.controls) {
    assert.equal(english[row.key], row.english, `${row.key}: English source changed`);
    assert.equal(REPORT_UI_KEYS[row.english], row.key);
  }
  for (const row of packet.entries) for (const lang of codes) {
    const value = row[lang];
    if (value === undefined) continue;
    assert.equal(locales[lang][row.key], value, `${lang}/${row.key}: review-packet drift`);
    assert.deepEqual(translationGaps({ [row.key]: row.english }, { [row.key]: value }), [], `${lang}/${row.key}`);
    // Existing isiZulu writes some source digits as words; retain its exact existing UI draft.
    if (lang === 'zu' && row.legacyZulu) assert.equal(value, row.legacyZulu);
    else assert.deepEqual(value.match(/\d+/g) ?? [], row.english.match(/\d+/g) ?? [], `${lang}/${row.key}: source figures changed`);
  }
  for (const row of packet.preserved) assert.equal(locales[row.language][row.key], row.wording);
  for (const lang of codes) {
    const source = read(`lib/locales/${lang}.ts`);
    const before = beforeReportViewerTranslations(source, lang);
    assert.equal(createHash('sha256').update(before).digest('hex'), packet.baseSourceSha256[lang]);
    assert.throws(() => beforeReportViewerTranslations(source.replace('  // End report viewer translation drafts.', '  // Broken block.'), lang));
  }
});

test('every static report-control call and section/map label is registered instead of silently falling back to English', () => {
  function assertRegistered(name: string, source: string) {
    const tree = typescript.createSourceFile(name + '.tsx', source, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
    const visit = (node: typescript.Node) => {
      if (typescript.isCallExpression(node) && typescript.isIdentifier(node.expression)
        && ['tr', 'label', 't', 'reportUiText'].includes(node.expression.text)
        && node.arguments[0] && typescript.isStringLiteral(node.arguments[0])) {
        assert.ok(REPORT_UI_KEYS[node.arguments[0].text], `${name}: unregistered control ${node.arguments[0].text}`);
      }
      typescript.forEachChild(node, visit);
    };
    visit(tree);
  }
  for (const name of ['ReportView', 'report/ReportReadingGuide', 'report/ReportMapStocktake', 'report/ReportCropPlan', 'report/ReportVersionDetails']) {
    assertRegistered(name, read(`components/${name}.tsx`));
  }
  const legacy = read('lib/report-localisation.ts').match(/export const REPORT_ZU: Record<string, string> = (\{[\s\S]*?\n\});/)![1];
  for (const source of Object.keys(new Function(`return (${legacy})`)())) assert.ok(REPORT_UI_KEYS[source], `unregistered section/option ${source}`);
  const mapTypes = typescript.createSourceFile('maps.ts', read('lib/report-map-selection.ts'), typescript.ScriptTarget.Latest, true);
  const checkMap = (node: typescript.Node) => {
    if (typescript.isPropertyAssignment(node) && node.name.getText(mapTypes) === 'label' && typescript.isStringLiteral(node.initializer)) {
      assert.ok(REPORT_UI_KEYS[node.initializer.text], `unregistered map type ${node.initializer.text}`);
    }
    typescript.forEachChild(node, checkMap);
  };
  checkMap(mapTypes);
  assert.throws(() => assertRegistered('broken.tsx', "label('A new unregistered control')"), /unregistered control/);

});

test('real saved-report controls switch app language while saved text and the next-generation language remain independent', async () => {
  class MemoryStorage {
    rows = new Map<string, string>();
    throwOnWrite = false;
    getItem(key: string) { return this.rows.get(key) ?? null; }
    setItem(key: string, value: string) { if (this.throwOnWrite) throw new Error('quota exceeded'); this.rows.set(key, value); }
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
  const css = `data:text/javascript,${encodeURIComponent('export default new Proxy({}, { get: (_, key) => key });')}`;
  const empty = `data:text/javascript,${encodeURIComponent('export default function Component(){return null;}')}`;
  const firebase = `data:text/javascript,${encodeURIComponent('export const getFirebase=()=>({auth:{currentUser:null}});export const isBackendConfigured=()=>false;')}`;
  const cropPdf = `data:text/javascript,${encodeURIComponent("export async function buildCropPlanPdf(){throw new Error('deliberate test export failure');} export const cropPlanPdfFilename=()=> 'test.pdf';")}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.endsWith('/components/report/ReportCropPlan.tsx') && specifier === '@/lib/crop-export-pdf') return { url: cropPdf, shortCircuit: true };
      if (specifier.endsWith('.css')) return { url: css, shortCircuit: true };
      if (specifier.endsWith('/ReportPreparation')) return { url: empty, shortCircuit: true };
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
  const { Ctx } = await import('../lib/i18n-context.ts');
  const { loadLocale } = await import('../lib/i18n.tsx');
  const { saveReport, loadReports, deleteReport } = await import('../lib/saved-reports.ts');
  const { reportVisualText } = await import('../lib/report-visuals.ts');
  const { reportSummaryText } = await import('../lib/report-summary.ts');
  const { reportUiText, reportUiMonth } = await import('../lib/report-localisation.ts');
  for (const lang of codes) assert.equal(reportUiMonth(lang, 'Oct 2026'), `${recordsMonthShort(lang, 10)} 2026`);
  assert.equal(reportUiMonth('st', 'Unrecorded date'), 'Unrecorded date');
  const { act, create } = await import('react-test-renderer');
  const ReportView = (await import('../components/ReportView.tsx')).default;
  const { collectReportSiteFacts } = await import('../lib/report-site-facts-collect.ts');
  const crop = collectReportSiteFacts({ siteId: 'translation-check', lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon, canvas: buildDemoDesignCanvasState(), cropPlan: buildDemoCropPlan() }).crop!;
  crop.snapshot!.capturedAt = '2026-10-21T08:00:00Z';
  const original: SavedReport = {
    id: 'translation-check', name: 'Original site name', savedAt: '2026-10-21T08:00:00Z', lang: 'en',
    report: '# Original English report\n\nThis saved body must remain exactly as recorded.',
    location: structuredClone(DEMO_LOCATION), facts: { farmName: 'Original site name', crop },
    settings: { language: 'en', tone: 'professional', length: 'standard', bilingual: false, sections: ['Executive Summary'], generatedAt: '2026-10-21T08:00:00Z' },
  };
  const before = structuredClone(original);
  const realFetch = globalThis.fetch;
  let request: Record<string, unknown> | undefined;
  let rejectNext = false;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(String(init?.body));
    if (rejectNext) { rejectNext = false; throw new TypeError('Failed to fetch'); }
    return new Response('# New report\n\nA separate generated version.');
  };
  const textOf = (node: any): string => typeof node === 'string' ? node : node?.children?.map(textOf).join('') ?? '';
  try {
    for (const lang of codes) {
      await loadLocale(lang);
      saveReport(original);
      const storedBefore = structuredClone(loadReports().find(r => r.id === original.id)!);
      assert.ok(storedBefore.facts?.crop?.snapshot, 'use a valid persisted crop plan, not a fixture the store drops');
      const t = (key: string) => locales[lang][key] ?? english[key] ?? key;
      const copy = (source: string, zulu?: string) => reportUiText(source, lang, t, zulu);
      const element = (code: UiLocale) => React.createElement(Ctx.Provider, { value: { lang: code, t: (key: string) => locales[code][key] ?? english[key] ?? key, setLang() {}, onboarded: true, completeOnboarding() {} } },
        React.createElement(ReportView, { locationData: DEMO_LOCATION, savedReport: original, appLang: code, onClose() {} }));
      let view: ReturnType<typeof create>;
      await act(async () => { view = create(element(lang)); });
      try {
        const text = textOf(view!.toJSON());
        assert.ok(text.includes(before.report.split('\n\n')[1]), `${lang}: saved text was translated or replaced`);
        for (const label of ['Back', 'At a glance', 'Field guide', 'Complete report', 'Generate new report', 'Report reference', 'Seasonal sowing calendar', 'Full crop-plan report (English)']) {
          assert.ok(text.includes(copy(label)), `${lang}: native ${label} is not rendered`);
          assert.notEqual(copy(label), label, `${lang}: an English fallback cannot satisfy this check`);
        }
        assert.ok(text.includes('English'), 'the original content language must remain visible');
        assert.equal(view!.root.findAll(n => n.props.className?.includes?.('report-body'))[0].props.lang, 'en', 'assistive technology must also see the saved content language');
        const overview = () => view!.root.findByProps({ 'data-report-visuals': true });
        assert.equal(overview().props.lang, lang, 'new screen charts have their own native language over a saved English body');
        assert.ok(textOf(overview()).includes(reportVisualText('Annual rainfall', lang)));

        const languagePicker = view!.root.findAllByType('select').find(n => n.props['aria-label'] === copy('Report language'))!;
        assert.ok(languagePicker, `${lang}: generation language needs a native accessible label`);
        assert.equal(languagePicker.props.value, 'en', 'opening a saved report must not change its requested language silently');
        const requestedLanguage = lang === 'zu' ? 'st' : 'zu';
        await act(async () => languagePicker.props.onChange({ target: { value: requestedLanguage } }));
        assert.equal(view!.root.findAllByType('select').find(n => n.props['aria-label'] === copy('Report language'))!.props.value, requestedLanguage);
        assert.ok(textOf(view!.toJSON()).includes(before.report.split('\n\n')[1]));
        const fieldGuide = view!.root.findAllByType('button').find(n => n.findAllByType('strong').some(child => textOf(child) === copy('Field guide')))!;
        await act(async () => fieldGuide.props.onClick());
        const summaryBody = () => view!.root.findAll(n => n.props.className?.includes?.('report-body'))[0];
        assert.equal(summaryBody().props.lang, lang, 'new summary text follows app language, independently of the next generation picker');
        assert.ok(textOf(summaryBody()).includes(reportSummaryText('Crop plan', lang)));
        const summaryLanguage = lang === 'zu' ? 'st' : 'zu';
        await loadLocale(summaryLanguage);
        await act(async () => view!.update(element(summaryLanguage)));
        assert.equal(summaryBody().props.lang, summaryLanguage);
        assert.ok(textOf(summaryBody()).includes(reportSummaryText('Crop plan', summaryLanguage)));
        await act(async () => view!.update(element(lang)));
        assert.equal(view!.root.findAllByType('select').find(n => n.props['aria-label'] === copy('Report language'))!.props.value, requestedLanguage);
        const completeReport = view!.root.findAllByType('button').find(n => n.findAllByType('strong').some(child => textOf(child) === copy('Complete report')))!;
        await act(async () => completeReport.props.onClick());
        assert.equal(summaryBody().props.lang, 'en', 'returning to the saved report restores its actual content language');
        assert.ok(textOf(summaryBody()).includes(before.report.split('\n\n')[1]));
        assert.deepEqual(loadReports().find(r => r.id === before.id), storedBefore);
        const mapError = 'Could not save your map review. Please try again.';
        const cropError = 'Could not export the crop plan. Please try again.';
        const reviewStatus = view!.root.findAllByType('select').find(n => String(n.props['aria-label']).endsWith(': ' + copy('review status')))!;
        assert.ok(reviewStatus);
        local.throwOnWrite = true;
        try { await act(async () => reviewStatus.props.onChange({ target: { value: 'not-needed' } })); }
        finally { local.throwOnWrite = false; }
        assert.ok(textOf(view!.toJSON()).includes(copy(mapError)));
        const cropExport = view!.root.findAllByType('button').find(n => textOf(n) === copy('Full crop-plan report (English)'))!;
        await act(async () => cropExport.props.onClick());
        assert.ok(textOf(view!.toJSON()).includes(copy(cropError)));
        // A context update must repaint controls without remounting or resetting the next report.
        const switchedLanguage = lang === 'zu' ? 'st' : 'zu';
        await loadLocale(switchedLanguage);
        await act(async () => view!.update(element(switchedLanguage)));
        const switchedCopy = (source: string) => reportUiText(source, switchedLanguage,
          (key: string) => locales[switchedLanguage][key] ?? english[key] ?? key);
        assert.equal(view!.root.findAllByType('select').find(n => n.props['aria-label'] === switchedCopy('Report language'))!.props.value, requestedLanguage);
        assert.equal(overview().props.lang, switchedLanguage);
        assert.ok(textOf(overview()).includes(reportVisualText('Annual rainfall', switchedLanguage)));

        assert.ok(textOf(view!.toJSON()).includes(before.report.split('\n\n')[1]));
        assert.ok(textOf(view!.toJSON()).includes(switchedCopy(mapError)));
        assert.ok(textOf(view!.toJSON()).includes(switchedCopy(cropError)));
        const generate = view!.root.findAllByType('button').find(n => textOf(n) === switchedCopy('Generate new report'))!;
        await act(async () => generate.props.onClick());
        assert.equal(request?.language, requestedLanguage, 'generation must use its own picker rather than the app language');
        assert.deepEqual(request?.sections, ['Executive Summary'], 'native labels cannot replace canonical section identities');
        assert.deepEqual(loadReports().find(r => r.id === before.id), storedBefore, 'regeneration cannot overwrite the original persisted version');
        assert.deepEqual(original, before);
        rejectNext = true;
        const retry = view!.root.findAllByType('button').find(n => textOf(n) === switchedCopy('Generate new report'))!;
        await act(async () => retry.props.onClick());
        const networkError = 'No signal — writing the report needs internet. Your section choices are kept; try again when you have bars.';
        assert.ok(textOf(view!.toJSON()).includes(switchedCopy(networkError)));
        await act(async () => view!.update(element(lang)));
        assert.ok(view!.root.findAllByProps({ role: 'alert' }).some(n => textOf(n).includes(copy(networkError))), 'an existing error must repaint and be announced after switching app language');
        assert.deepEqual(loadReports().find(r => r.id === before.id), storedBefore);

      } finally {
        await act(async () => view!.unmount());
        deleteReport(original.id);
      }
    }
  } finally {
    globalThis.fetch = realFetch;
    hooks.deregister();
  }
});
