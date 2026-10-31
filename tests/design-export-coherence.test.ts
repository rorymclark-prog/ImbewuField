import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { useDialogFocus } from '../lib/use-dialog-focus.ts';
import { UserFacingError, userFacingMessage } from '../lib/user-facing-error.ts';
import { RenderJobError, mapSerially } from '../lib/render-jobs.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const glossy = source('components/design/DesignGlossy.tsx');
const crop = source('components/crops/CropPlanExportCard.tsx');

for (const action of ['handleChange', 'handleUndo', 'handleRedo']) {
  test(`${action} reports an allocated-field refusal without claiming storage failed or changing history`, () => {
    const text = source('app/design/page.tsx');
    const file = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let declaration: ts.VariableDeclaration | undefined;
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === action) declaration = node;
      ts.forEachChild(node, visit);
    }
    visit(file);
    assert.ok(declaration);
    const js = ts.transpileModule(`const ${declaration.getText(file)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const snapshot = { zones: [], items: [], lines: [] };
    const undoStack = { current: [snapshot] }, redoStack = { current: [snapshot] };
    const writes: string[] = [];
    let message: string | null = null;
    const scope = {
      useCallback: (fn: unknown) => fn, t: (key: string) => key,
      setCanvasState: (update: (prev: unknown) => unknown) => assert.equal(update(snapshot), snapshot),
      reconcileFieldBlockEdit: () => { throw new Error('Remove this field’s crop allocations before changing its outline.'); },
      loadCropPlan: () => ({ plantings: [{ bedId: 'field' }] }),
      setEditError: (value: string | null) => { message = value; },
      setSaveError: () => { writes.push('storage error'); }, setSaved: () => { writes.push('save status'); },
      persistCanvasState: () => { writes.push('persist'); }, undoStack, redoStack, MAX_UNDO: 40,
    };
    const callback = new Function('scope', `with(scope) { ${js}; return ${action}; }`)(scope);
    callback((prev: unknown) => prev);
    assert.match(message!, /crop allocations/);
    assert.deepEqual(writes, []);
    assert.deepEqual(undoStack.current, [snapshot]);
    assert.deepEqual(redoStack.current, [snapshot]);
  });
}

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

test('closing a zoom whose grid trigger was replaced returns focus to the surviving gallery', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    for (const state of ['replaced-trigger', 'live-trigger', 'closed-parent', 'inert-parent'] as const) {
      const doc: any = { activeElement: null, body: {}, addEventListener() {}, removeEventListener() {} };
      const element = (name: string): any => ({
        name, isConnected: true, hidden: false, focusCount: 0,
        hasAttribute: () => false, getClientRects: () => [{}], closest: () => null,
        focus() { this.focusCount++; doc.activeElement = this; },
      });
      const opener = element('grid trigger');
      const gallery = element('gallery');
      const close = element('zoom close');
      const zoom = { ...element('zoom'), querySelector: () => null, querySelectorAll: () => [close] };
      const fallback = { current: gallery };
      doc.activeElement = opener;
      Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
      const Probe = ({ open }: { open: boolean }) => {
        const ref = React.useRef<any>(zoom);
        useDialogFocus(open, ref, { returnFocusFallbackRef: fallback });
        return null;
      };
      let view!: ReturnType<typeof create>;
      act(() => { view = create(React.createElement(Probe, { open: true })); });
      try {
        assert.equal(doc.activeElement, close);
        if (state !== 'live-trigger') opener.isConnected = false;
        if (state === 'closed-parent') fallback.current = null;
        if (state === 'inert-parent') gallery.closest = () => ({});
        act(() => { view.update(React.createElement(Probe, { open: false })); });
        if (state === 'replaced-trigger') {
          assert.equal(doc.activeElement, gallery, 'the page behind the gallery must not receive focus');
          assert.equal(gallery.tabIndex, -1);
        } else if (state === 'live-trigger') {
          assert.equal(doc.activeElement, opener, 'a surviving trigger remains the preferred return target');
          assert.equal(gallery.focusCount, 0);
        } else {
          assert.equal(gallery.focusCount, 0, 'a closed or inert parent cannot steal focus');
        }
      } finally { act(() => { view.unmount(); }); }
    }
    assert.match(glossy, /useDialogFocus\(galleryZoomOpen, galleryZoomRef, \{ returnFocusFallbackRef: galleryDialogRef \}\)/,
      'the real map zoom must supply its surviving gallery as the fallback');
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as any).document;
  }
});

test('printed bed-field outlines leave paths and unused ground free of whole-field crop artwork', () => {
  let fills = 0, cropLayouts = 0, strokes = 0;
  const ctx = { save() {}, restore() {}, fill() { fills++; }, stroke() { strokes++; } };
  const draw = handler('drawBlueprintGround', {
    groundRegister: () => 'content', ringArea: () => 1,
    staplePlotOrdinalById: () => new Map([['field', 0]]),
    GROUND_FEATURES: { staple_garden: { color: '#557733' } },
    blueprintRing: () => {}, referenceFeatureArtworkCache: new Map(), stapleTileUrl: () => 'tile',
    staplePlotGlyphs: () => [], polygonCropRows: () => { cropLayouts++; return { plants: [] }; },
  }, glossy);
  const zone = { id: 'field', feature: 'staple_garden', points: [[0,0],[1,0],[1,1],[0,1]], fieldBlock: { mode: 'beds' } };
  draw(ctx, { zones: [zone] }, (n: number) => n*100, (n: number) => n*100, 100);
  assert.equal(fills, 0, 'a grouping outline cannot fill paths or unused edges');
  assert.equal(cropLayouts, 0, 'the individual beds carry the plants');
  assert.equal(strokes, 1, 'the field boundary remains visible');
  draw(ctx, { zones: [{ ...zone, fieldBlock: { mode: 'open' } }] }, (n: number) => n*100, (n: number) => n*100, 100);
  assert.equal(fills, 1, 'an open crop field retains its existing surface depiction');
  assert.equal(cropLayouts, 1, 'the check must detect the whole-field drawing path');
});
