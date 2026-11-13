import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { MAP_SOURCE, bind } from './map-source-seams.ts';
import { mapboxPlaceSearchUrl, readMapboxPlaceResults, type PlaceSearchArea } from '../lib/place-search.ts';

// Execute the actual Map handlers, with injected camera/network/storage seams.
// These are engineering responses, not live provider or full browser evidence.
const tree = ts.createSourceFile('Map.tsx', MAP_SOURCE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'PermaMap') as ts.FunctionDeclaration;
const expressions = new Map([...tree.statements, ...component.body!.statements].flatMap(statement => ts.isVariableStatement(statement)
  ? statement.declarationList.declarations.flatMap(d => ts.isIdentifier(d.name) && d.initializer ? [[d.name.text, d.initializer.getText(tree)] as const] : []) : []));
const response = (features: unknown[]) => Response.json({ features });
const result = { place_name: 'East Lansing, Michigan, United States', center: [-84.4839, 42.7369] };
function harness(area: PlaceSearchArea = 'south-africa', fetcher: typeof fetch = async () => response([result])) {
  const state = { area, suggestions: [] as any[], worldwide: [] as any[], error: '', result: '', searching: false, preview: false };
  const requests: string[] = [], flights: unknown[] = [], selected: number[][] = [], recents: unknown[] = [], shared: any[] = [];
  const timers = new Map<number, () => unknown>(); let timerId = 0;
  let camera = { lng: -84.4839, lat: 42.7369 }, pixels = 'previous-camera';
  const idle: Array<{ fn: () => void; active: boolean }> = [];
  const writes: any[] = [], captures: string[] = [], placeWrites: any[] = [];
  const naming = { point: null as any, editing: null as string | null, name: '', label: 'field', color: '' };
  let nearbyPrompt: () => Promise<any> = async () => null;
  let beforePlaceWrite = () => {};
  let placeAsks = 0;
  const map = { flyTo: (v: unknown) => { flights.push(v); }, getCenter: () => camera, getZoom: () => 14,
    stop: () => {}, jumpTo: (v: { center: number[] }) => { camera = { lng: v.center[0], lat: v.center[1] }; },
    getMap: () => map, once: (_: string, fn: () => void) => { idle.push({ fn, active: true }); },
    off: (_: string, fn: () => void) => { idle.filter(x => x.fn === fn).forEach(x => { x.active = false; }); },
    getCanvas: () => ({ toDataURL: () => 'data:image/jpeg;base64,' + pixels }),
    getContainer: () => ({ clientWidth: 400, clientHeight: 800 }), unproject: () => camera };
  const context: Record<string, any> = {
    useCallback: (fn: unknown) => fn, AbortController,
    PLACE_PREVIEW_EVIDENCE_ERROR: bind(expressions.get('PLACE_PREVIEW_EVIDENCE_ERROR') ?? 'undefined', {}),
    PLACE_PREVIEW_SHARE_ERROR: bind(expressions.get('PLACE_PREVIEW_SHARE_ERROR') ?? 'undefined', {}),
    searchArea: area, searchAreaRef: { current: area }, searchEpoch: { current: 0 },
    placeLookup: { current: null }, placeSuggestions: { current: null }, suggestTimer: { current: null },
    placePreviewOnly: { current: false }, placePreviewShareCenter: { current: null },
    placeCaptureFrame: { current: { generation: 0, ready: true, cleanup: null } },
    placeSaveIntent: { current: { generation: 0, draft: null, pointKey: '' } },
    selectedLocation: null, selectedPointKey: '', locationData: null, namingPlace: null, editingPlaceId: null,
    placeName: '', placeLabel: 'field', customPlaceColor: '', savedPins: [],
    placeSaveContext: { current: {} }, savedPlaceWriteContextIsCurrent: () => true,
    setNamingPlace: (v: any) => { naming.point = v; context.namingPlace = v; },
    setEditingPlaceId: (v: string | null) => { naming.editing = v; context.editingPlaceId = v; },
    setPlaceName: (v: string) => { naming.name = v; context.placeName = v; },
    setPlaceLabel: (v: string) => { naming.label = v; context.placeLabel = v; },
    setCustomPlaceColor: (v: string) => { naming.color = v; context.customPlaceColor = v; },
    promptNearbyUpdate: () => { placeAsks++; return nearbyPrompt(); }, appConfirm: () => {},
    savedRainfallFields: () => ({}), setSavedPins: () => {}, setPlaceSaved: () => {},
    savePlace: (p: any, guard: { isCurrent: () => boolean }) => {
      beforePlaceWrite(); if (!guard.isCurrent()) return null; placeWrites.push(p); return [p];
    },
    TOKEN: 'synthetic-public-token', mapboxPlaceSearchUrl, readMapboxPlaceResults,
    setSearchArea: (v: PlaceSearchArea) => { state.area = v; },
    setPlacePreviewActive: (v: boolean) => { state.preview = v; },
    setSuggestions: (v: any[]) => { state.suggestions = v; },
    setWorldwideResults: (v: any[]) => { state.worldwide = v; },
    setSearchError: (v: string | ((old: string) => string)) => { state.error = typeof v === 'function' ? v(state.error) : v; }, setSearchResult: (v: string) => { state.result = v; },
    setSearching: (v: boolean) => { state.searching = v; }, setShowRecents: () => {}, setSearchQuery: () => {},
    setTimeout: (fn: () => unknown) => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
    fetch: async (...args: Parameters<typeof fetch>) => { requests.push(String(args[0])); return fetcher(...args); },
    onSelectLocation: (lat: number, lon: number) => { selected.push([lat, lon]); context.selectedLocation = { lat, lon }; context.selectedPointKey = `${lat},${lon}`; context.placeSaveIntent.current.pointKey = context.selectedPointKey; },
    onLocationSelect: (lat: number, lon: number) => { selected.push([lat, lon]); },
    pushRecent: (p: unknown) => { recents.push(p); }, t: (key: string) => key,
    mapRef: { current: map },
    onMapCapture: (v: string) => { captures.push(v); }, onCaptureClick: () => {},
    generateWaterPointId: () => 'water', generateId: () => 'element', siteIdForElements: 'own-site', droppingElement: 'tree',
    saveWaterPoint: (p: unknown) => { writes.push(p); }, saveSiteElement: (_: string, p: unknown) => { writes.push(p); return p; },
    loadSiteElements: () => writes, setDroppingWaterPoint: () => {}, setWaterPointNaming: () => {}, setWpName: () => {}, setWpCategory: () => {},
    setSiteElements: () => {}, setDroppingElement: () => {}, setElementEditing: () => {}, setElName: () => {}, setElNote: () => {},
    setElLitres: () => {}, setElSpecies: () => {}, setElCount: () => {}, setElTankCustomOpen: () => {}, setElTreeCustomOpen: () => {},
    setDraftPoints: (fn: (old: unknown[]) => unknown[]) => { writes.push(fn([])); }, pushCorner: (_: unknown[], lng: number, lat: number) => [[lng, lat]],
    drawRef: { current: { getAll: () => ({ type: 'FeatureCollection', features: [] }) } },
    saveSharedSite: async (value: unknown) => { shared.push(value); return 'synthetic'; },
    loadPlaces: () => [], loadWaterPoints: () => [], setShareState: () => {},
    setPlaceShareId: () => {}, setPlaceShareStatus: () => {},
    window: { location: { origin: 'https://example.invalid' } }, navigator: { clipboard: { writeText: async () => {} } },
  };
  const names = ['onLocationSelect', 'allowMapEvidence', 'allowMapCapture', 'closePlaceNaming', 'saveCurrentPlace', 'startEditPlace', 'confirmSavePlace', 'addPin', 'cancelPlaceLookup', 'cancelPlaceSuggestions', 'chooseSearchArea', 'previewPlaceResult', 'handleSearch', 'fetchSuggestions', 'selectSuggestion', 'handleShare', 'handleSharePlace'];
  function rebind() {
    context.searchArea = state.area;
    for (const name of names) {
      const code = expressions.get(name);
      if (code) context[name] = bind(code, context);
      else if (name === 'closePlaceNaming') context[name] = inlineContaining('setNamingPlace(null)');
      else if (!context[name]) context[name] = () => {}; // parent controls still run the old real search handler
    }
  }
  rebind();
  function inlineContaining(text: string): () => void {
    let code = '';
    function visit(n: ts.Node) {
      if (ts.isJsxAttribute(n) && n.name.getText(tree) === 'onClick' && n.initializer
        && ts.isJsxExpression(n.initializer) && n.initializer.expression
        && n.initializer.expression.getText(tree).includes(text)) code = n.initializer.expression.getText(tree);
      ts.forEachChild(n, visit);
    }
    visit(component);
    assert.ok(code, `actual click handler containing ${text} exists`);
    return bind(code, context);
  }
  return { state, context, requests, flights, selected, recents, shared, writes, captures, inlineContaining,
    naming, placeWrites, placeAsks: () => placeAsks,
    nearby(fn: () => Promise<any>) { nearbyPrompt = fn; },
    beforePlaceWrite(fn: () => void) { beforePlaceWrite = fn; },
    pendingFrameListeners: () => idle.filter(x => x.active).length,
    unmount() {
      const effect = component.body!.statements.find(n => ts.isExpressionStatement(n) && n.getText(tree).includes('placeLookup.current?.abort(); placeSuggestions.current?.abort();')) as ts.ExpressionStatement;
      const callback = (effect.expression as ts.CallExpression).arguments[0].getText(tree);
      bind<() => () => void>(callback, context)()();
    },
    paint(index?: number) { pixels = 'own-camera'; if (index !== undefined) idle[index]?.fn(); else idle.splice(0).filter(x => x.active).forEach(x => x.fn()); },
    rebind, area(v: PlaceSearchArea) { context.chooseSearchArea(v); rebind(); },
    runTimers() { const work = [...timers.values()]; timers.clear(); return Promise.all(work.map(fn => fn())); } };
}

test('worldwide requests omit South African restrictions while default lookups retain their established geographic bias', () => {
  for (const suggest of [false, true]) {
    const za = new URL(mapboxPlaceSearchUrl('Town & farm/one', 'synthetic-public-token', 'south-africa', suggest));
    const world = new URL(mapboxPlaceSearchUrl('Town & farm/one', 'synthetic-public-token', 'worldwide', suggest));
    assert.equal(za.searchParams.get('country'), 'ZA'); assert.equal(za.searchParams.get('proximity'), '25,-29');
    assert.equal(world.searchParams.has('country'), false); assert.equal(world.searchParams.has('proximity'), false);
    assert.equal(world.searchParams.get('autocomplete'), String(suggest));
    assert.equal(world.searchParams.has('bbox'), false); assert.equal(world.searchParams.get('language'), 'en');
    assert.ok(world.pathname.includes('Town%20%26%20farm%2Fone'));
    assert.equal(world.searchParams.get('types')!.split(',').includes('poi'), false);
  }
});

test('provider coordinates keep a real zero but malformed or absent positions never become map locations', () => {
  assert.deepEqual(readMapboxPlaceResults({ features: [{ place_name: 'Zero', center: [0, 0] },
    { place_name: 'Missing', center: [] }, { place_name: 'Strings', center: ['1', '2'] },
    { place_name: 'Infinity', center: [Infinity, 0] }, { place_name: 'Outside', center: [181, 0] }, null] }), [{ name: 'Zero', lon: 0, lat: 0 }]);
});

test('actual worldwide lookup presents temporary choices and previews a map area without saving or selecting a farm', async () => {
  const ui = harness('worldwide'); await ui.context.handleSearch('East Lansing, United States');
  assert.equal(ui.requests.length, 1);
  const url = new URL(ui.requests[0]); assert.equal(url.hostname, 'api.mapbox.com'); assert.equal(url.searchParams.has('country'), false);
  assert.equal(ui.state.worldwide.length, 1); assert.deepEqual(ui.selected, []); assert.deepEqual(ui.recents, []);
  ui.context.selectSuggestion(ui.state.worldwide[0]);
  assert.equal(ui.flights.length, 1); assert.deepEqual(ui.selected, []); assert.deepEqual(ui.recents, []);
  assert.equal(ui.state.preview, true); assert.match(ui.state.result, /United States/);
  await ui.context.handleShare(); await ui.context.handleSharePlace({ id: 'old', lon: 31, lat: -27 });
  assert.equal(ui.shared.length, 0); assert.match(ui.state.error, /Tap the exact farm/);
  // A separate own point, even before the camera animation ends, is the only share centre.
  ui.context.onLocationSelect(42.7, -84.6); assert.equal(ui.state.preview, false);
  await ui.context.handleShare(); assert.deepEqual(ui.shared[0].mapCenter, [-84.6, 42.7]);
  await ui.context.handleSharePlace({ id: 'old', lon: 31, lat: -27 }); assert.deepEqual(ui.shared[1].mapCenter, [31, -27]);
});

test('worldwide coordinates bypass geocoding and South African submitted OSM lookups keep their normal selection path', async () => {
  const coordinates = harness('worldwide'); await coordinates.context.handleSearch('0, 0');
  assert.deepEqual(coordinates.requests, []); assert.deepEqual(coordinates.selected, [[0, 0]]);
  const za = harness('south-africa', async () => Response.json([{ lat: '-27', lon: '31', display_name: 'Synthetic farm, South Africa' }]));
  await za.context.handleSearch('Synthetic farm'); assert.match(za.requests[0], /countrycodes=za/);
  assert.deepEqual(za.selected, [[-27, 31]]); assert.equal(za.recents.length, 1);
});

test('fresh Mapbox suggestions in either scope stay temporary, while prior saved recents remain selectable', async () => {
  for (const area of ['south-africa', 'worldwide'] as const) {
    const ui = harness(area); ui.context.fetchSuggestions('East Lansing'); await ui.runTimers();
    assert.equal(ui.state.suggestions.length, 1); ui.context.selectSuggestion(ui.state.suggestions[0]);
    assert.deepEqual(ui.selected, []); assert.deepEqual(ui.recents, []); assert.equal(ui.state.preview, true);
  }
  const old = harness(); old.context.selectSuggestion({ name: 'My saved farm', lon: 31, lat: -27 });
  assert.deepEqual(old.selected, [[-27, 31]]); assert.equal(old.recents.length, 1);
});

test('a pending lookup and its retained result cannot revive across a search-area round trip', async () => {
  let finish!: (r: Response) => void;
  const ui = harness('worldwide', () => new Promise(resolve => { finish = resolve; }));
  const pending = ui.context.handleSearch('East Lansing');
  ui.area('south-africa'); ui.area('worldwide'); finish(response([result])); await pending;
  assert.deepEqual(ui.state.worldwide, []); assert.deepEqual(ui.selected, []);
  const ready = harness('worldwide'); await ready.context.handleSearch('East Lansing'); const prior = ready.state.worldwide[0];
  ready.area('south-africa'); ready.area('worldwide'); ready.context.selectSuggestion(prior);
  assert.deepEqual(ready.flights, []); assert.deepEqual(ready.recents, []);
});

test('a delayed autocomplete cannot repopulate choices after a scope change or newer query', async () => {
  const finishes: Array<(r: Response) => void> = [];
  const ui = harness('worldwide', () => new Promise(resolve => { finishes.push(resolve); }));
  ui.context.fetchSuggestions('Old name'); const old = ui.runTimers();
  ++ui.context.searchEpoch.current; ui.context.fetchSuggestions('New name'); const fresh = ui.runTimers();
  finishes[1](response([{ place_name: 'New name', center: [1, 2] }])); await fresh;
  finishes[0](response([result])); await old; assert.equal(ui.state.suggestions[0].name, 'New name');
  ui.context.fetchSuggestions('Third name'); const third = ui.runTimers();
  ui.area('south-africa'); ui.area('worldwide'); finishes[2](response([result])); await third;
  assert.deepEqual(ui.state.suggestions, []);
});

test('worldwide empty results and failures never suggest confirming South Africa or select a location', async () => {
  for (const fetcher of [async () => response([]), async () => new Response('', { status: 429 })]) {
    const ui = harness('worldwide', fetcher); await ui.context.handleSearch('Synthetic unknown');
    assert.ok(ui.state.error); assert.doesNotMatch(ui.state.error, /South Africa/); assert.equal(ui.state.searching, false);
    assert.deepEqual(ui.selected, []); assert.deepEqual(ui.recents, []);
  }
});


test('preview camera cannot become persisted water, infrastructure, boundary or an old farm capture', async () => {
  const ui = harness('worldwide');
  ui.context.onLocationSelect(-27, 31); // previously selected farm A
  await ui.context.handleSearch('Remote area B'); ui.context.selectSuggestion(ui.state.worldwide[0]);
  const water = ui.inlineContaining('saveWaterPoint(newPoint)');
  const element = ui.inlineContaining('saveSiteElement(siteIdForElements, newElement)');
  const capture = ui.inlineContaining('onMapCapture(canvas.toDataURL');
  water(); element(); capture(); ui.context.addPin();
  assert.equal(ui.writes.length, 0); assert.equal(ui.captures.length, 0);
  assert.match(ui.state.error, /Tap the exact farm/);
  ui.context.onLocationSelect(42.7, -84.6);
  water(); element(); capture(); ui.context.addPin();
  assert.equal(ui.captures.length, 0, 'camera coordinates update before the old canvas frame is repainted');
  assert.match(ui.state.error, /imagery is still updating/);
  ui.paint(); capture(); assert.equal(ui.state.error, '');
  assert.equal(ui.writes.length, 3); assert.deepEqual(ui.captures, ['own-camera']);
  assert.equal(ui.writes[0].lat, 42.7); assert.equal(ui.writes[0].lon, -84.6);
  assert.equal(ui.writes[1].lat, 42.7); assert.equal(ui.writes[1].lon, -84.6);
  assert.deepEqual(ui.writes[2], [[-84.6, 42.7]]);
});


test('an obsolete idle event cannot release capture for a newer own-point selection or area preview', async () => {
  const ui = harness('worldwide');
  const capture = ui.inlineContaining('onMapCapture(canvas.toDataURL');
  await ui.context.handleSearch('First area'); ui.context.selectSuggestion(ui.state.worldwide[0]);
  ui.context.onLocationSelect(42.7, -84.6);
  ui.context.onLocationSelect(42.8, -84.7);
  ui.paint(0); capture(); assert.equal(ui.captures.length, 0);
  ui.paint(1); capture(); assert.deepEqual(ui.captures, ['own-camera']);
  await ui.context.handleSearch('Second area'); ui.context.selectSuggestion(ui.state.worldwide[0]);
  ui.paint(1); capture(); assert.equal(ui.captures.length, 1);
});


test('leaving the map removes its pending frame listener and retires an already queued idle callback', async () => {
  const ui = harness('worldwide');
  await ui.context.handleSearch('First area'); ui.context.selectSuggestion(ui.state.worldwide[0]);
  ui.context.onLocationSelect(42.7, -84.6); assert.equal(ui.pendingFrameListeners(), 1);
  ui.unmount(); assert.equal(ui.pendingFrameListeners(), 0);
  ui.paint(0); assert.equal(ui.context.placeCaptureFrame.current.ready, false);
});


test('effect cleanup/setup replay does not hold ordinary capture when no lookup transition has begun', () => {
  const ui = harness();
  ui.unmount(); // React development StrictMode can replay effect cleanup on mount.
  ui.inlineContaining('onMapCapture(canvas.toDataURL')();
  assert.equal(ui.captures.length, 1);
});


// PLACE-NEW-SAVE-PREVIEW-CONTEXT-01: execute the actual opening, confirmation
// and selection callbacks. No user/provider records are used in these controls.
async function previewArea(ui: ReturnType<typeof harness>) {
  await ui.context.handleSearch('East Lansing');
  ui.context.selectSuggestion(ui.state.worldwide[0]);
  ui.rebind();
}
function ownPoint(ui: ReturnType<typeof harness>, lat = -27, lon = 31) {
  ui.context.onLocationSelect(lat, lon); ui.rebind();
}
function openNewPlace(ui: ReturnType<typeof harness>) {
  ui.context.saveCurrentPlace(); ui.rebind();
}

test('Save place cannot name the old farm behind a temporary worldwide preview, even through a retained opening callback', async () => {
  const ui = harness('worldwide'); ownPoint(ui);
  const oldOpen = ui.context.saveCurrentPlace;
  await previewArea(ui); oldOpen();
  assert.equal(ui.naming.point, null, 'previewing another area must not open a naming sheet for the old selected farm');
  assert.match(ui.state.error, /Tap the exact farm/);
  assert.deepEqual(ui.placeWrites, []);
});

test('a retained new-place confirmation cannot prompt or write while previewing or after a preview-selection round trip', async () => {
  for (const roundTrip of [false, true]) {
    const ui = harness('worldwide'); ownPoint(ui); openNewPlace(ui);
    const oldConfirm = ui.context.confirmSavePlace;
    await previewArea(ui);
    if (roundTrip) ownPoint(ui);
    await oldConfirm();
    assert.equal(ui.placeAsks(), 0, 'an obsolete draft must be held before asking to update a nearby place');
    assert.deepEqual(ui.placeWrites, []);
  }
});

for (const answer of [null, { id: 'nearby', lat: -27, lon: 31, name: 'Existing', notes: 'Keep notes' }]) {
  for (const change of ['preview-round-trip', 'new-point', 'cancel', 'replacement', 'unmount']) {
    test(`a deferred new-place nearby answer ${answer ? 'update' : 'new'} stays retired after ${change}`, async () => {
      const ui = harness('worldwide'); ownPoint(ui); openNewPlace(ui);
      let resolve!: (v: any) => void;
      ui.nearby(() => new Promise(done => { resolve = done; }));
      const pending = ui.context.confirmSavePlace();
      assert.equal(ui.placeAsks(), 1);
      if (change === 'preview-round-trip') { await previewArea(ui); ownPoint(ui); }
      if (change === 'new-point') ownPoint(ui, 42.7, -84.6);
      if (change === 'cancel') ui.context.closePlaceNaming();
      if (change === 'replacement') openNewPlace(ui);
      if (change === 'unmount') ui.unmount();
      resolve(answer); await pending;
      assert.deepEqual(ui.placeWrites, [], 'an old answer must not save or relabel either the old or nearby place');
    });
  }
}

test('after explicitly selecting an own point a fresh naming draft saves that exact point', async () => {
  const ui = harness('worldwide'); ownPoint(ui); await previewArea(ui);
  ownPoint(ui, 42.7, -84.6); openNewPlace(ui);
  ui.context.setPlaceName('Chosen point'); ui.rebind();
  await ui.context.confirmSavePlace();
  assert.equal(ui.placeWrites.length, 1);
  assert.deepEqual([ui.placeWrites[0].lat, ui.placeWrites[0].lon], [42.7, -84.6]);
  assert.equal(ui.placeWrites[0].name, 'Chosen point');
  assert.equal(ui.naming.point, null);
});

test('explicit existing-pin rename and recolour remain usable during an unrelated preview with coordinates and notes retained', async () => {
  const ui = harness('worldwide'); ownPoint(ui); await previewArea(ui);
  const pin = { id: 'known', lat: -27, lon: 31, name: 'Old name', notes: 'Recorded note', color: '#123456' };
  ui.context.savedPins = [pin]; ui.context.startEditPlace(pin); ui.rebind();
  ui.context.setPlaceName('Renamed'); ui.context.setCustomPlaceColor('#654321'); ui.rebind();
  await ui.context.confirmSavePlace();
  assert.equal(ui.placeAsks(), 0);
  assert.equal(ui.placeWrites.length, 1);
  assert.deepEqual([ui.placeWrites[0].id, ui.placeWrites[0].lat, ui.placeWrites[0].lon, ui.placeWrites[0].notes], ['known', -27, 31, 'Recorded note']);
  assert.equal(ui.placeWrites[0].name, 'Renamed'); assert.equal(ui.placeWrites[0].color, '#654321');
});

test('the final saved-place writer guard also retires a draft changed during a re-entrant write boundary', async () => {
  const ui = harness('worldwide'); ownPoint(ui); openNewPlace(ui);
  ui.beforePlaceWrite(() => { ownPoint(ui, 42.7, -84.6); });
  await ui.context.confirmSavePlace();
  assert.deepEqual(ui.placeWrites, []);
});


test('a retained new-place opening cannot name the previous point after a different own-point selection', () => {
  const ui = harness('worldwide'); ownPoint(ui);
  const oldOpen = ui.context.saveCurrentPlace;
  ownPoint(ui, 42.7, -84.6); oldOpen();
  assert.equal(ui.naming.point, null);
  openNewPlace(ui);
  const fresh = ui.naming.point as { lat: number; lon: number } | null; assert.ok(fresh);
  assert.deepEqual([fresh.lat, fresh.lon], [42.7, -84.6]);
});


for (const action of ['save', 'share']) {
  test(`own-point selection retires only the obsolete ${action} preview warning before fresh naming`, async () => {
    const ui = harness('worldwide'); ownPoint(ui); await previewArea(ui);
    if (action === 'save') ui.context.saveCurrentPlace();
    else await ui.context.handleShare();
    assert.match(ui.state.error, /Tap the exact farm location/);
    ownPoint(ui, 42.7, -84.6);
    assert.equal(ui.state.error, '', 'the now-valid point must not keep the preview-only instruction');
    openNewPlace(ui); assert.ok(ui.naming.point, 'retiring a warning must retain the accepted fresh naming flow');
  });
}

test('own-point selection preserves unrelated lookup, connection, imagery and similar-worded errors', () => {
  for (const error of ['', 'Place search is unavailable. Try again or enter coordinates.',
    'Something went wrong. Please check your connection and try again.',
    'Map imagery is still updating for your selected farm. Please try capture again when it finishes.',
    'Tap the exact farm location on the map before another unrelated operation.']) {
    const ui = harness('worldwide'); ui.context.setSearchError(error); ownPoint(ui);
    assert.equal(ui.state.error, error);
  }
});
