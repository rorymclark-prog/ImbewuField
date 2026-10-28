import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { UserFacingError, userFacingMessage } from '../lib/user-facing-error.ts';
import { RenderJobError, mapSerially } from '../lib/render-jobs.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const glossy = source('components/design/DesignGlossy.tsx');
const crop = source('components/crops/CropPlanExportCard.tsx');

function handler(name: string, scope: Record<string, unknown>, text = crop) {
  const tree = ts.createSourceFile('exports.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | undefined;
  const walk = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, walk);
  };
  walk(tree);
  assert.ok(declaration, `The ${name} export action must remain testable`);
  const js = ts.transpileModule(declaration.getText(tree).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('scope', `with(scope) { ${js}; return ${name}; }`)(scope);
}

test('render upload and start failures preserve retry guidance and roll back uploads without exposing provider details', async () => {
  const text = source('lib/render-jobs.ts');
  const upstream = new Error('Firebase: Missing or insufficient permissions.');
  for (const stage of ['upload', 'start']) {
    const uploaded: string[] = [], deleted: string[] = [];
    const enqueue = handler('enqueueRenderJob', {
      RenderJobError, isSampleMode: () => false, renderJobRequestError: () => null,
      isRenderEngine: () => true, RENDER_QUALITIES: ['high'],
      getFirebase: () => ({ storage: {}, db: {}, auth: { currentUser: { uid: 'farmer' } } }),
      ref: (_storage: unknown, path: string) => path,
      uploadString: async (path: string) => { if (stage === 'upload') throw upstream; uploaded.push(path); },
      deleteObject: async (path: string) => { deleted.push(path); },
      mapSerially, doc: () => ({}), serverTimestamp: () => 0,
      Timestamp: { fromMillis: () => 0 }, JOB_TTL_MS: 1000,
      setDoc: async () => { throw upstream; },
    }, text);
    await assert.rejects(enqueue({ siteId: 'site', engine: 'openai', style: 'extension_blueprint',
      sheets: [{ key: 'all', label: 'All', prompt: 'Keep the design', compositeDataUrl: 'data:image/png;base64,AA==' }],
    }), (error: unknown) => {
      assert.ok(error instanceof RenderJobError);
      assert.ok(error instanceof UserFacingError);
      assert.equal(error.cause, upstream, 'The original failure must stay available for diagnostics');
      assert.match(userFacingMessage(error, 'fallback', t), /Check your connection and try again/);
      assert.doesNotMatch(userFacingMessage(error, 'fallback', t), /Firebase|permissions/);
      return true;
    });
    assert.deepEqual(deleted, uploaded, 'A failed job must remove every successfully uploaded input');
  }
  assert.equal(userFacingMessage(new RenderJobError('You need to be signed in to generate AI sheets.'), 'fallback', t),
    'You need to be signed in to generate AI sheets.');
});

const t = (key: string) => ({
  reportUiCouldNotExportTheCropPlanPleaseTry: 'Could not export the crop plan. Please try again.',
  reportUiCouldNotBuildThePDF: 'Could not build the PDF.',
  networkFailed: 'Connection interrupted. Try again.',
}[key] ?? key);

for (const action of ['exportCalendar', 'withPdf']) {
  test(`${action} hides engine errors, keeps useful app guidance, and releases the busy state`, async () => {
    for (const error of [new Error('Missing or insufficient permissions.'), new TypeError('Failed to fetch'), new UserFacingError('Keep this screen open and retry.')] as unknown[]) {
      let status = '', busy: string | null = null;
      const scope = {
        busy: null, setBusy: (value: string | null) => { busy = value; },
        setStatus: (value: string) => { status = value; }, t, userFacingMessage,
        tasks: [], meta: { planTitle: 'My plan' }, now: undefined,
        buildCropPlanIcs: () => { throw error; },
        plantings: [], beds: [], yearReport: undefined, planNotes: [], planNotesAt: undefined,
        availability: undefined, treeGroups: [], treeSeasons: undefined, productionGuide: undefined,
        productionProjection: undefined, poultryGuidance: undefined, sections: ['notes'], FARMER_SECTIONS: ['notes'],
        availabilityDetails: undefined, preservedProducts: [], productionRecords: [],
        buildCropPlanPdf: async () => { throw error; },
      };
      await handler(action, scope)(() => 'not reached');
      assert.equal(busy, null, 'A failed export must allow another attempt');
      assert.doesNotMatch(status, /permissions|Failed to fetch|unknown error/);
      assert.equal(status, error instanceof UserFacingError ? error.message
        : error instanceof TypeError ? t('networkFailed')
        : t(action === 'exportCalendar' ? 'reportUiCouldNotExportTheCropPlanPleaseTry' : 'reportUiCouldNotBuildThePDF'));
    }
  });
}

test('render and export catch paths never expose browser, Firebase or worker diagnostics', () => {
  for (const text of [glossy, crop]) {
    assert.doesNotMatch(text, /set(?:Error|Status)\([^;]*instanceof Error\s*\?\s*\w+\.message/);
  }
  assert.doesNotMatch(glossy, /lastAssembleError = .*\.message/);
  assert.doesNotMatch(glossy, /setError\(job\.error|\$\{firstErr\}/);
  assert.match(glossy, /new UserFacingError\('The design changed after the first AI pass/,
    'The safety instruction must survive friendly-error handling');
});

test('Escape closes a zoom before its saved-map gallery and the next Escape clears the gallery selection', () => {
  const start = glossy.indexOf('  const galleryDialogRef =');
  const end = glossy.indexOf('\n  // A stable cache key', start);
  assert.ok(start > 0 && end > start);
  const js = ts.transpileModule(glossy.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const zoomOpen of [true, false]) {
    const changes: Record<string, unknown> = {};
    const dialogs: boolean[] = [];
    let escape: (() => void) | undefined;
    const scope = {
      galleryOpen: true, galleryZoomOpen: zoomOpen,
      useRef: () => ({ current: null }), useCallback: (fn: unknown) => fn,
      useDialogFocus: (open: boolean) => dialogs.push(open),
      useEscapeClose: (open: boolean, fn: () => void) => { assert.equal(open, true); escape = fn; },
      setGalleryOpen: (v: unknown) => { changes.open = v; },
      setGalleryViewId: (v: unknown) => { changes.view = v; },
      setGalleryZoomOpen: (v: unknown) => { changes.zoom = v; },
      setExportMode: (v: unknown) => { changes.export = v; },
      setExportSel: (v: unknown) => { changes.selection = v; },
    };
    new Function('scope', `with(scope) { ${js} }`)(scope);
    assert.deepEqual(dialogs, [true, zoomOpen]);
    assert.ok(escape); escape();
    if (zoomOpen) assert.deepEqual(changes, { zoom: false });
    else {
      assert.deepEqual(changes, { open: false, view: null, zoom: false, export: false, selection: new Set() });
    }
  }
  assert.match(glossy, /ref=\{galleryDialogRef\}\s+role="dialog"\s+aria-modal="true"\s+aria-label=/);
  assert.match(glossy, /ref=\{galleryZoomRef\}\s+role="dialog"\s+aria-modal="true"/);
  assert.doesNotMatch(glossy.slice(glossy.indexOf('{galleryZoomOpen && stageResultImage')), /autoFocus/,
    'React autoFocus runs before the focus hook captures the opener and would break focus return');
});
