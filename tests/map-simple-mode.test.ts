import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (lib/app-level.ts) for the farm map's CHROME — swarm/w4-map-simple. The
// site panel (components/DataPanel.tsx) already has its own Simple mode (tests/farmer-map-simple
// .test.ts); this track is the map controls around it: the toolbar, the Layers expander, the
// "+ Add" catalog and the on-map element palette. Source-text guard style, same as
// tests/design-simple-mode.test.ts and tests/farmer-map-simple.test.ts: these components are not
// pure functions of exported data, so the guard reads the real shipped file and asserts the
// wiring a farmer would actually hit.

const MAP = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');
const ADD_SHEET = readFileSync(new URL('../components/AddSheet.tsx', import.meta.url), 'utf8');
const ADD_ACTIONS = readFileSync(new URL('../lib/add-actions.ts', import.meta.url), 'utf8');
const FARMER_PAGE = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');

test('Map.tsx reads Simple / All tools from lib/app-level.ts', () => {
  assert.match(MAP, /import \{ useAppLevel \} from '@\/lib\/app-level';/, 'Map.tsx must import useAppLevel');
  assert.match(MAP, /const simple = useAppLevel\(\) === 'simple';/, 'Map.tsx must compute a `simple` flag from useAppLevel()');
});

test('the expert Layers-expander toggles (offline canvas, HD imagery, contours, relief, 3D) are hidden in Simple', () => {
  assert.match(MAP, /\{!simple && <button onClick=\{\(\)=>setCanvasOnly\(!canvasOnly\)\}/, 'the offline-canvas chip must not render in Simple');
  assert.match(MAP, /\{!simple && ARCGIS_API_KEY && \(\s*\n\s*<button onClick=\{\(\) => setHdImagery/, 'the HD imagery toggle must not render in Simple');
  assert.match(MAP, /\{!simple && \(\s*\n\s*<button onClick=\{\(\) => setContours/, 'the Contours toggle must not render in Simple');
  assert.match(MAP, /\{!simple && \(\s*\n\s*<button onClick=\{\(\) => setHillshade/, 'the Relief (hillshade) toggle must not render in Simple');
  assert.match(MAP, /title=\{terrain3d \? '3D terrain on/, 'the 3D toggle button must still exist for All tools');
  assert.match(MAP, /\{!simple && layersOpen && show3dWarning && \(/, 'the 3D warning banner must not render in Simple');
});

test('the satellite/map basemap switch stays in both levels, not gated by simple', () => {
  const chipsStart = MAP.indexOf("{!simple && <button onClick={()=>setCanvasOnly(!canvasOnly)}");
  assert.ok(chipsStart > 0, 'could not find the Layers chip row');
  const basemapAt = MAP.indexOf("(['satellite-streets-v12', 'outdoors-v12'] as const).map", chipsStart);
  assert.ok(basemapAt > chipsStart, 'could not find the satellite/topo basemap picker');
  const between = MAP.slice(chipsStart, basemapAt);
  assert.doesNotMatch(between, /\{!simple &&\s*$/, 'the basemap picker must not be wrapped in its own !simple gate');
});

test('the native/custom edit-engine picker is hidden in Simple, and Simple never enters native editing', () => {
  const editEngineSectionAt = MAP.indexOf("{!simple && layersOpen && (");
  assert.ok(editEngineSectionAt > 0, 'could not find the edit-engine picker section');
  const editEngineSection = MAP.slice(editEngineSectionAt, editEngineSectionAt + 700);
  assert.match(editEngineSection, /editToolSectionLabel/, 'the edit-engine section header must sit right after the !simple gate');
  assert.match(editEngineSection, /editEngineBigHandles/);
  assert.match(editEngineSection, /editEngineMapboxTool/);
  assert.match(
    MAP,
    /if \(!simple && editEngine === 'native'\) startNativeEdit\(featureId\);/,
    'startEdit must never route into native editing while Simple, regardless of the farmer\'s stored engine preference',
  );
  // The stored preference itself must be untouched by simple mode — hiding a control must not
  // change its stored value (CLAUDE.md / this track\'s Simple-mode rules).
  assert.match(MAP, /if \(saved === 'native' \|\| saved === 'custom'\) setEditEngine\(saved\);/, 'the persisted edit-engine choice must still be restored unconditionally');
});

test('print base map, the elevation readout, the Labels overlay pill and native-editing action bars are hidden in Simple', () => {
  assert.match(MAP, /\{!simple && \(\s*\n\s*<button onClick=\{printBaseMap\}/, 'the Print base map button must not render in Simple');
  assert.match(MAP, /\{!simple && hoverElevation !== null && \(/, 'the elevation hover readout must not render in Simple');
  assert.match(
    MAP,
    /\{!simple && toolbarMin && !pinDraw && !editPin && \(siteFeatures\.length > 0 \|\| waterFeatures\.length > 0 \|\| savedPins\.length > 0 \|\| designPresent\) && \(\(\) => \{/,
    'the Labels overlay pill must not render in Simple',
  );
  assert.match(MAP, /\{!simple && activeDraw && \(/, 'the native drawing-in-progress banner must not render in Simple');
  assert.match(MAP, /\{!simple && editingFeatureId && !activeDraw && \(/, 'the native vertex-editing action bar must not render in Simple');
});

test('the Parcels section\'s Shapes/Hatch/Labels display-toggle row is hidden in Simple; the parcel list and boundary CTA stay', () => {
  const toggleRowAt = MAP.indexOf('{/* Toggle row — sits below section header, wraps on narrow panels */}');
  assert.ok(toggleRowAt > 0, 'could not find the Parcels toggle row');
  assert.match(MAP.slice(toggleRowAt, toggleRowAt + 220), /\{!simple && \(\s*\n\s*<div className="flex flex-wrap items-center gap-0.5 pl-4 pb-1">/);
  // The parcel rows themselves (name/edit/delete) and the "Draw land boundary" CTA are not
  // gated by simple — they must render identically in both levels.
  const addAnotherParcelAt = MAP.indexOf("onClick={() => startPinDraw('site')}", toggleRowAt);
  assert.ok(addAnotherParcelAt > toggleRowAt, 'could not find the "+ Add another parcel" button');
  const justBefore = MAP.slice(addAnotherParcelAt - 40, addAnotherParcelAt);
  assert.doesNotMatch(justBefore, /!simple/, 'the "+ Add another parcel" button must not itself be gated behind !simple');
  assert.match(MAP, /<PenTool size=\{19\} strokeWidth=\{2\} \/>\{t\('drawLandBoundaryButton'\)\}/, 'the primary "Draw land boundary" CTA must exist in both levels');
});

test('the on-map Site Elements palette is filtered to tree + water tank in Simple; placed elements and their editor stay reachable in both levels', () => {
  assert.match(MAP, /const SIMPLE_ELEMENT_TYPES: SiteElementType\[\] = \['tree', 'jojo_tank'\];/, 'the conservative Simple element palette must be exactly tree + water tank');
  assert.match(MAP, /\{\(simple \? SIMPLE_ELEMENT_TYPES : ELEMENT_TYPES\)\.map\(\(type\) => \{/, 'the palette must switch on simple, not drop ELEMENT_TYPES for All tools');
  // The placed-elements list (edit/delete) is not gated by simple — a farmer must still be able
  // to manage an element placed while in All tools after switching to Simple.
  assert.match(MAP, /\{siteElements\.length > 0 && \(\s*\n\s*<div className="flex flex-col gap-1\.5 mt-1">/);
});

test('boundary/water/element reticle-draw and drop-mode UI, and the arm-draw/arm-element/open-add wiring, are never gated by simple', () => {
  for (const marker of [
    "window.addEventListener('imbewu-arm-draw', arm);",
    "window.addEventListener('imbewu-arm-element', armEl);",
    "window.dispatchEvent(new CustomEvent('imbewu-open-add'))",
    'onClick={goToMyLocation}',
    'onClick={openPanel}',
    "onClick={() => setGuideOpen(true)}",
  ]) {
    const at = MAP.indexOf(marker);
    assert.ok(at > 0, `could not find: ${marker}`);
    const before = MAP.slice(Math.max(0, at - 200), at);
    assert.doesNotMatch(before, /\{!simple &&\s*(\n\s*)?$/, `${marker} must not be gated behind !simple`);
  }
});

test('the "+ Add" catalog reduces to boundary / new bed / tree / water tank in Simple, and app/farmer/page.tsx threads the level through', () => {
  assert.match(
    ADD_ACTIONS,
    /export const SIMPLE_ADD_ACTION_IDS: AddActionId\[\] = \['boundary', 'veg_bed', 'tree', 'water_tank'\];/,
    'the conservative Simple Add subset must be exactly boundary, veg_bed, tree, water_tank',
  );
  assert.match(ADD_SHEET, /simple\?: boolean;/, 'AddSheet must accept an optional simple prop');
  assert.match(
    ADD_SHEET,
    /const actions = ADD_ACTIONS\.filter\(\(a\) => a\.group === group\)\s*\n\s*\.filter\(\(a\) => !simple \|\| SIMPLE_ADD_ACTION_IDS\.includes\(a\.id\)\);/,
    'AddSheet must filter to the Simple subset only when simple is true, showing every row otherwise',
  );
  assert.match(FARMER_PAGE, /const simple = useAppLevel\(\) === 'simple';/, 'app/farmer/page.tsx must compute a simple flag');
  assert.match(FARMER_PAGE, /<AddSheet[\s\S]{0,200}simple=\{simple\}/, 'app/farmer/page.tsx must thread simple into AddSheet');
});

test('the deep links this track must never break stay wired: ?arm=site|water and ?openSurvey=1', () => {
  // These are consumed in app/farmer/page.tsx, not Map.tsx, and are untouched by this track —
  // pinned here so a future edit to either file cannot quietly drop them.
  assert.match(FARMER_PAGE, /searchParams\.get\('arm'\)/, 'app/farmer/page.tsx must still consume ?arm=');
  assert.match(FARMER_PAGE, /imbewu-arm-draw/, 'app/farmer/page.tsx must still dispatch imbewu-arm-draw for ?arm=');
  assert.match(FARMER_PAGE, /searchParams\.get\('openSurvey'\) !== '1'/, 'app/farmer/page.tsx must still consume ?openSurvey=1');
});
