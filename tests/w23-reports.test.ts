import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w23-03: report figures use the display face and never break mid-number', () => {
  const css = read('components/ProgrammeReport.module.css');
  assert.match(css, /\.metric strong\{[^}]*font-family:var\(--font-display\)[^}]*white-space:nowrap\}/);
  assert.match(css, /\.metric strong\{font-size:clamp\(19px,5\.6vw,25px\)\}/);
});

test('w23-04: the isiZulu draft note in both report layouts is styled, not a bare line', () => {
  const composer = read('components/ReportComposer.tsx');
  assert.doesNotMatch(composer, /<p role="note">Lezi izihloko/);
  assert.match(composer, /<p role="note" className=\{visualStyles\.draftNote\}>Lezi izihloko/);
  assert.match(composer, /<p role="note" className=\{reportStyles\.draftNote\}>Lezi izihloko/);
  assert.match(read('components/ProgrammeReport.module.css'), /\.draftNote\{margin:0;padding:10px 20px/);
  assert.match(read('components/report/VisualReport.module.css'), /\.draftNote \{ margin: 0 0 16px;/);
});

test('w23-05: report partners take their own line on a phone', () => {
  assert.match(read('components/ProgrammeReport.module.css'), /\.partner\{min-width:200px\}/);
});

test('w23-06: withdrawn context during report PDF preparation suppresses deliverFile', async () => {
  const ts = await import('typescript');
  const source = read('components/ReportComposer.tsx');
  const sf = ts.createSourceFile('ReportComposer.tsx', source, ts.ScriptTarget.Latest, true);
  const handlers = new Map<string, string>();
  const findHandlers = (node: import('typescript').Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && ['download', 'captureReportDeliveryContext'].includes(node.name.text)) {
      handlers.set(node.name.text, node.getText(sf));
    }
    ts.forEachChild(node, findHandlers);
  };
  findHandlers(sf);
  assert.equal(handlers.size, 2, 'exercise the real report handler and its context check');

  const compiled = ts.transpileModule(`${[...handlers.values()].join('\n')}\nreturn download;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const owner = 'synthetic-owner';
  let mountedOwner = owner;
  let firebaseOwner = owner;
  let deliveryContext: (() => boolean) | undefined;
  let deliveries = 0;
  let busyState = false;
  const fakeDoc = { output: () => new Blob(['synthetic-report'], { type: 'application/pdf' }) };
  let resolveBuilder!: (doc: typeof fakeDoc) => void;
  const builderPromise = new Promise<typeof fakeDoc>(resolve => { resolveBuilder = resolve; });

  const syntheticScope = {
    setBusy: (v: boolean) => { busyState = v; },
    setError: () => {},
    reportScope: 'synthetic-report',
    deliveryScope: { current: { key: 'synthetic-report', generation: 0 } },
    readAccountLocalSampleState: () => false,
    activeAccountUid: () => mountedOwner,
    isBackendConfigured: () => true,
    getFirebase: () => ({ auth: { currentUser: { uid: firebaseOwner } } }),
    owner,
    includePhotos: false,
    photos: [],
    visuals: undefined,
    presentation: 'screen',
    prepareVisualPdfAssets: async () => ({}),
    reportDate: '2026-11-03',
    title: 'Synthetic Session Report',
    sample: false,
    sections: [],
    format: 'full',
    branding: undefined,
    localizedPhotoHeading: 'Site photographs',
    reportMetrics: [],
    reportChart: undefined,
    session: undefined,
    funder: false,
    zu: false,
    tables: [],
    subtitle: undefined,
    reportLabel: undefined,
    ownerLabel: undefined,
    filenameBase: undefined,
    buildProgrammePdf: () => builderPromise,
    deliverFile: async (_blob: Blob, _filename: string, _title: string, current: () => boolean) => {
      deliveries++;
      deliveryContext = current;
    },
  };

  const downloadFn = new Function(...Object.keys(syntheticScope), compiled)(...Object.values(syntheticScope));

  const runPromise = downloadFn();
  assert.equal(busyState, true, 'download enters busy state');

  mountedOwner = 'different-owner';
  resolveBuilder(fakeDoc);
  await runPromise;

  assert.equal(deliveries, 0, 'deliverFile must not be invoked after context withdrawal');
  assert.equal(busyState, false, 'busy state must be reset');
  mountedOwner = owner;
  await downloadFn();
  assert.equal(deliveries, 1, 'a current report must still reach delivery');
  assert.equal(deliveryContext?.(), true);
  firebaseOwner = 'different-owner';
  assert.equal(deliveryContext?.(), false, 'delayed fallback also checks live Firebase ownership');
});

test('w23-07: changing the selected participant retires the in-flight field report even when filenames match', async () => {
  const ts = await import('typescript');
  const { buildFieldReport } = await import('../lib/field-report.ts');
  const { freshFieldWorkspace } = await import('../lib/field-teams.ts');
  const data = freshFieldWorkspace();
  const today = '2026-11-03';
  const from = '2026-10-01';
  const to = '2026-10-31';
  const first = 'synthetic-participant-a';
  const second = 'synthetic-participant-b';
  data.people = [
    { id: first, name: 'Synthetic participant A', role: 'farmer' },
    { id: second, name: 'Synthetic participant B', role: 'farmer' },
  ];
  const reportFor = (farmerId: string) => buildFieldReport(data, { from, to, farmerId, today });
  assert.equal(reportFor(first).filename, reportFor(second).filename);
  assert.notEqual(reportFor(first).scope, reportFor(second).scope);

  const sf = ts.createSourceFile('FieldTeams.tsx', read('components/FieldTeams.tsx'), ts.ScriptTarget.Latest, true);
  let scopeKey: string | undefined;
  const findKey = (node: import('typescript').Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sf) === 'ReportComposer'
      && node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'filenameBase')) {
      const key = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'key');
      if (key && ts.isJsxAttribute(key) && key.initializer && ts.isJsxExpression(key.initializer)) {
        scopeKey = key.initializer.expression?.getText(sf);
      }
    }
    ts.forEachChild(node, findKey);
  };
  findKey(sf);
  assert.ok(scopeKey, 'the filtered report caller must retire the previous composer');
  const keyFor = new Function('farmerFilter', 'from', 'to', 'compareReport', `return ${scopeKey};`);
  assert.notEqual(keyFor(first, from, to, false), keyFor(second, from, to, false));
  assert.equal(keyFor(second, from, to, false), keyFor(second, from, to, false));
});
