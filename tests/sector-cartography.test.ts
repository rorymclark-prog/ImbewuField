import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

import { bearingToUnitVector, deriveSectorModel, labelToBearing } from '../lib/sector.ts';
import { presentSectorCartography, seasonalSunArcRadii, sectorEvidenceSummary, SECTOR_STYLES, sectorFillColor, sectorStrokeWidth } from '../lib/sector-cartography.ts';
import { contourIntervalForFrame } from '../lib/contours.ts';
import { makeMercatorUnprojector } from '../lib/design-canvas.ts';
import { fetchSheetContours } from '../lib/sheet-contours.ts';

const DURBAN = {
  biome: 'Indian Ocean Coastal Belt',
  rainfallPattern: 'summer' as const,
  elevation: { slopeDeg: 4, slopePct: 7, aspectDeg: 225, aspectLabel: 'SW' },
  climate: { minTemp: 3, windFromSummer: 'ESE', windFromWinter: 'WSW', windSpeed: 2.5 },
};

test('presents the benchmark palette, line register, and priority order', () => {
  const entries = presentSectorCartography(deriveSectorModel(DURBAN, -29.783, 30.98, {
    siteCentroid: [0.5, 0.5], drivewayPoints: [[0.1, 0.5], [0.2, 0.5]],
  }));
  assert.deepEqual(entries.map((item) => item.key), [
    'summer-sun', 'winter-sun', 'midday-sun', 'wind:summer_cooling', 'wind:cold_front',
    'wind:berg', 'fire', 'driveway', 'water', 'frost',
  ]);
  assert.deepEqual(entries.map((item) => item.priority), [10, 11, 12, 30, 31, 32, 40, 50, 60, 70]);
  assert.equal(SECTOR_STYLES['summer-cooling-wind'].color, '#25BFC0');
  assert.deepEqual(SECTOR_STYLES['summer-cooling-wind'].dash, [14, 7]);
  assert.equal(SECTOR_STYLES['summer-cooling-wind'].fillAlpha, 0.14);
  assert.equal(SECTOR_STYLES.driveway.lineStyle, 'solid');
  assert.equal(SECTOR_STYLES.fire.fillAlpha, 0.12);
});

test('winter sun stays inside summer even when noon-icon clearance changes', () => {
  // Sheet 02 once used the overlap clearance in the wrong direction, placing winter outside the
  // summer arc. That makes the lower southern-hemisphere sun read as the longer path.
  for (const [ring, arrow, icon] of [[120, 30, 9], [240, 75, 18]] as const) {
    const { summerR, winterR } = seasonalSunArcRadii(ring, arrow, icon);
    assert.ok(summerR > winterR, `${JSON.stringify({ ring, arrow, icon })} reverses the seasons`);
  }
});

test('copies exact bearings and provenance into presentation records', () => {
  const model = deriveSectorModel(DURBAN, -29.783, 30.98, {
    siteCentroid: [0.5, 0.5], drivewayPoints: [[0.1, 0.5], [0.2, 0.5]],
  });
  const byKey = new Map(presentSectorCartography(model).map((item) => [item.key, item]));
  assert.deepEqual(byKey.get('summer-sun')?.bearings, [model.solar.summer.sunriseAzDeg, model.solar.summer.sunsetAzDeg]);
  assert.deepEqual(byKey.get('wind:berg')?.bearings, [model.namedWind.find((w) => w.id === 'berg')!.bearingDeg]);
  assert.equal(byKey.get('wind:berg')?.provenance, 'regional-assumption');
  assert.equal(byKey.get('fire')?.provenance, 'regional-assumption');
  assert.equal(byKey.get('driveway')?.provenance, 'computed');
  assert.equal(byKey.get('water')?.bearings[0], model.water!.downhillBearingDeg);
  assert.equal(byKey.get('frost')?.bearings[0], model.frost!.downhillBearingDeg);
  assert.deepEqual(model.siteWindEvidence, {
    summerFromLabel: 'ESE',
    winterFromLabel: 'WSW',
    annualMeanSpeedMps: 2.5,
    provenance: 'coordinate-climate-grid',
  });
});

test('keeps the shared regional profile separate from coordinate-specific wind evidence', () => {
  const coastalA = deriveSectorModel(DURBAN, -29.783, 30.98);
  const coastalB = deriveSectorModel({
    ...DURBAN,
    climate: { ...DURBAN.climate, windFromSummer: 'NNE', windFromWinter: 'S', windSpeed: 4.1 },
  }, -28.7, 31.4);

  assert.deepEqual(
    coastalA.namedWind.map(({ id, bearingDeg }) => ({ id, bearingDeg })),
    coastalB.namedWind.map(({ id, bearingDeg }) => ({ id, bearingDeg })),
  );
  assert.notDeepEqual(coastalA.siteWindEvidence, coastalB.siteWindEvidence);
  assert.equal(coastalA.namedWind[0]?.provenance, 'regional-assumption');
  assert.equal(coastalB.siteWindEvidence?.provenance, 'coordinate-climate-grid');
});

test('makes incomplete property evidence explicit even when regional sectors are available', () => {
  const complete = deriveSectorModel(DURBAN, -29.783, 30.98, {
    siteCentroid: [0.5, 0.5], drivewayPoints: [[0.1, 0.5], [0.2, 0.5]],
  });
  const incomplete = deriveSectorModel({
    biome: 'Indian Ocean Coastal Belt',
    rainfallPattern: 'summer',
  }, -29.7, 30.8);

  assert.equal(sectorEvidenceSummary(complete).missingEvidence.length, 0);
  assert.match(sectorEvidenceSummary(complete).headline, /Property evidence:/);
  assert.deepEqual(
    sectorEvidenceSummary(incomplete).missingEvidence,
    ['terrain / slope', 'coordinate climate grid'],
  );
  assert.match(sectorEvidenceSummary(incomplete).headline, /Property analysis incomplete/);
  assert.match(sectorEvidenceSummary(incomplete).footer, /Open this property on the map/);
  assert.ok(incomplete.namedWind.length > 0, 'regional context may remain available');
});

test('does not invent coordinate wind evidence when the location cache has none', () => {
  const model = deriveSectorModel({
    biome: 'Indian Ocean Coastal Belt',
    rainfallPattern: 'summer',
  }, -29.7, 30.8);
  assert.equal(model.siteWindEvidence, null);
});

test('does not invent regional, fire, driveway, water, or frost presentation', () => {
  const model = deriveSectorModel({ biome: 'Fynbos', rainfallPattern: 'winter' }, -33.93, 18.86);
  const entries = presentSectorCartography(model);
  assert.deepEqual(entries.map((item) => item.key), ['summer-sun', 'winter-sun', 'midday-sun']);
});

test('malformed terrain never becomes a water or frost arrow', () => {
  const invalidTerrain = [
    { slopeDeg: Number.NaN, slopePct: 10, aspectDeg: 180 },
    { slopeDeg: Number.POSITIVE_INFINITY, slopePct: 10, aspectDeg: 180 },
    { slopeDeg: -1, slopePct: 10, aspectDeg: 180 },
    { slopeDeg: 90, slopePct: 10, aspectDeg: 180 },
    { slopeDeg: 5, slopePct: Number.NaN, aspectDeg: 180 },
    { slopeDeg: 5, slopePct: Number.POSITIVE_INFINITY, aspectDeg: 180 },
    { slopeDeg: 5, slopePct: -1, aspectDeg: 180 },
    { slopeDeg: 5, slopePct: 10, aspectDeg: Number.NaN },
    { slopeDeg: 5, slopePct: 10, aspectDeg: Number.POSITIVE_INFINITY },
  ];

  for (const terrain of invalidTerrain) {
    const model = deriveSectorModel({
      elevation: { ...terrain, aspectLabel: 'S' },
      climate: { minTemp: 0 },
    }, -29, 31);
    assert.equal(model.water, null);
    assert.equal(model.frost, null);
    assert.ok(
      presentSectorCartography(model).every((entry) =>
        entry.bearings.every((bearing) => Number.isFinite(bearing))),
    );
  }
});

test('sector bearings are canonical and sampling baselines remain usable', () => {
  for (const aspectDeg of [-721, 721]) {
    const model = deriveSectorModel({
      elevation: {
        slopeDeg: 5,
        slopePct: 9,
        aspectDeg,
        aspectLabel: 'N',
        sampleBaselineM: Number.NaN,
      },
    }, -29, 31);
    assert.ok(model.water);
    assert.ok(model.water.downhillBearingDeg >= 0 && model.water.downhillBearingDeg < 360);
    assert.ok(Number.isFinite(model.water.sampleBaselineM) && model.water.sampleBaselineM > 0);
  }
});

test('impossible climate values do not masquerade as property evidence or frost risk', () => {
  for (const windSpeed of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const model = deriveSectorModel({ climate: { windSpeed } }, -29, 31);
    assert.equal(model.siteWindEvidence, null);

    const directional = deriveSectorModel({
      climate: { windSpeed, windFromSummer: 'N', windFromWinter: 'S' },
    }, -29, 31);
    assert.equal(directional.siteWindEvidence?.annualMeanSpeedMps, null);
    assert.equal(directional.windSummer?.speed, undefined);
    assert.equal(directional.windWinter?.speed, undefined);
  }

  for (const minTemp of [Number.NaN, Number.NEGATIVE_INFINITY]) {
    const model = deriveSectorModel({
      elevation: { slopeDeg: 5, slopePct: 9, aspectDeg: 180, aspectLabel: 'S' },
      climate: { minTemp },
    }, -29, 31);
    assert.equal(model.frost, null);
  }
});

test('preserves mixed midday truth as two exact cardinal bearings', () => {
  const model = deriveSectorModel({ biome: 'test' }, -22, 30);
  const midday = presentSectorCartography(model).find((item) => item.key === 'midday-sun');
  assert.equal(midday?.label, 'Midday sun — mixed');
  assert.deepEqual(midday?.bearings, [0, 180]);
});

test('sector compass parsing is tolerant of presentation casing and whitespace', () => {
  assert.equal(labelToBearing(' nne '), 22.5);
  assert.equal(labelToBearing('W'), 270);
  assert.equal(labelToBearing('not-a-compass-point'), null);
  assert.equal(labelToBearing(null), null);
});

test('sector bearings use the shared screen convention', () => {
  const north = bearingToUnitVector(0);
  const east = bearingToUnitVector(90);
  const south = bearingToUnitVector(180);
  const west = bearingToUnitVector(270);
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

  close(north[0], 0); close(north[1], -1);
  close(east[0], 1); close(east[1], 0);
  close(south[0], 0); close(south[1], 1);
  close(west[0], -1); close(west[1], 0);
});

test('converts sector presentation tokens into phone-readable drawing values', () => {
  assert.equal(Number(sectorStrokeWidth('summer-cooling-wind', 1595).toFixed(3)), 8.932);
  assert.equal(sectorStrokeWidth('summer-cooling-wind', 800), 7);
  assert.equal(Number(sectorStrokeWidth('driveway', 1595).toFixed(3)), 5.742);
  assert.equal(sectorFillColor('summer-cooling-wind'), '#25BFC024');
  assert.equal(sectorFillColor('fire'), '#E7562D1f');
});

test('plan-sheet contours preserve curved Terrain-RGB paths in the exact canvas frame', async () => {
  const frame = {
    centerLng: 31.96304,
    centerLat: -27.72623,
    zoom: 17,
    imgW: 960,
    imgH: 640,
    mPerPx: 0.9,
    satDataUrl: null,
  };
  const boundary: Array<[number, number]> = [
    [0.15, 0.2],
    [0.85, 0.2],
    [0.85, 0.8],
    [0.15, 0.8],
  ];
  const slopeDeg = 6;
  const aspectDeg = 200;
  const interval = contourIntervalForFrame(
    slopeDeg,
    aspectDeg,
    boundary,
    frame.mPerPx,
    frame.imgW,
    frame.imgH,
  );
  assert.equal(interval.status, 'ok');

  const expectedPoints: Array<[number, number]> = [
    [0.1, 0.24],
    [0.45, 0.37],
    [0.72, 0.61],
    [0.9, 0.76],
  ];
  const unproject = makeMercatorUnprojector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
  );
  let requestedUrl = '';
  const result = await fetchSheetContours(
    frame,
    boundary,
    slopeDeg,
    aspectDeg,
    async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          contour: {
            status: 'ok',
            intervalM: interval.intervalM,
            minElevationM: 410,
            maxElevationM: 414,
            source: 'mapbox-terrain-rgb',
          },
          features: [{
            type: 'Feature',
            properties: { ele: 412.5, index: 0 },
            geometry: {
              type: 'LineString',
              coordinates: expectedPoints.map(unproject),
            },
          }],
        }),
      };
    },
  );

  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'mapbox-terrain-rgb');
  assert.equal(result.intervalM, interval.intervalM);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].points.length, expectedPoints.length, 'curve vertices must not collapse to one straight chord');
  result.lines[0].points.forEach((point, index) => {
    assert.ok(Math.abs(point[0] - expectedPoints[index][0]) < 1e-9);
    assert.ok(Math.abs(point[1] - expectedPoints[index][1]) < 1e-9);
  });
  const query = new URL(requestedUrl, 'http://sheet.test').searchParams;
  assert.equal(Number(query.get('interval')), interval.intervalM);
  assert.ok(Number(query.get('minLon')) < Number(query.get('maxLon')));
  assert.ok(Number(query.get('minLat')) < Number(query.get('maxLat')));
});

test('plan-sheet contours distinguish flat terrain from unavailable evidence', async () => {
  const frame = {
    centerLng: 31,
    centerLat: -29,
    zoom: 17,
    imgW: 960,
    imgH: 640,
    mPerPx: 0.8,
    satDataUrl: null,
  };
  const boundary: Array<[number, number]> = [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
  ];
  let fetched = false;
  const flat = await fetchSheetContours(frame, boundary, 0, 180, async () => {
    fetched = true;
    throw new Error('flat ground must not request contours');
  });
  assert.equal(fetched, false);
  assert.equal(flat.status, 'too-flat');
  assert.equal(flat.tooFlat, true);
  assert.equal(flat.source, null);

  const unavailable = await fetchSheetContours(frame, boundary, 5, 180, async () => ({
    ok: false,
    json: async () => ({ error: 'DEM unavailable' }),
  }));
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.tooFlat, false);
  assert.equal(unavailable.source, null);

  const interval = contourIntervalForFrame(5, 180, boundary, frame.mPerPx, frame.imgW, frame.imgH);
  assert.equal(interval.status, 'ok');
  const terrainFlat = await fetchSheetContours(frame, boundary, 5, 180, async () => ({
    ok: true,
    json: async () => ({
      type: 'FeatureCollection',
      features: [],
      contour: {
        status: 'too-flat',
        intervalM: interval.intervalM,
        minElevationM: 100,
        maxElevationM: 100,
        source: 'mapbox-terrain-rgb',
      },
    }),
  }));
  assert.equal(terrainFlat.status, 'too-flat');
  assert.equal(terrainFlat.tooFlat, true);
  assert.equal(terrainFlat.source, 'mapbox-terrain-rgb');
});

test('regional wedges keep one dashed provenance mark per energy, not two runaway edges', () => {
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const wedgeStart = source.indexOf('const drawRegionalWedge =');
  const centerlineStart = source.indexOf('const drawRegionalCenterline =', wedgeStart);
  const broadArrowStart = source.indexOf('const drawBroadEnergyArrow =', centerlineStart);
  assert.ok(wedgeStart >= 0 && centerlineStart > wedgeStart && broadArrowStart > centerlineStart);

  const wedgePainter = source.slice(wedgeStart, centerlineStart);
  assert.match(wedgePainter, /ctx\.fill\(\)/, 'the translucent sector wedge remains');
  assert.match(wedgePainter, /bearingDeg - halfWidthDeg/);
  assert.match(wedgePainter, /bearingDeg \+ halfWidthDeg/);
  assert.doesNotMatch(wedgePainter, /ctx\.stroke\(\)|setLineDash\(/, 'wedge edges are fill geometry, not two dashed rays');

  const centerlinePainter = source.slice(centerlineStart, broadArrowStart);
  assert.match(centerlinePainter, /setLineDash\(\[10, 7\]\)/);
  assert.equal(centerlinePainter.match(/ctx\.stroke\(\)/g)?.length, 1, 'fire gets exactly one dashed centreline');
  assert.match(centerlinePainter, /wedge\.centerVec\[0\] \* wedge\.rr/);
  assert.match(centerlinePainter, /wedge\.centerVec\[1\] \* wedge\.rr/);

  const windStart = source.indexOf('for (const w of model.namedWind)', broadArrowStart);
  const drivewayStart = source.indexOf('// 6b. DRIVEWAY ACCESS', windStart);
  assert.ok(windStart >= 0 && drivewayStart > windStart);
  const regionalEnergyPainter = source.slice(windStart, drivewayStart);
  assert.match(regionalEnergyPainter, /drawBroadEnergyArrow\(v, color/);
  assert.match(regionalEnergyPainter, /drawArrow\(v, color, windWidth\(kind\), \[\.\.\.SECTOR_STYLES\[kind\]\.dash\]/);
  assert.match(regionalEnergyPainter, /drawRegionalCenterline\(fireWedge, SECTOR_STYLES\.fire\.color\)/);

  const legendStart = source.indexOf('const summerCoolingWind = model.namedWind.find');
  const legendEnd = source.indexOf('if (model.water) rows.push', legendStart);
  assert.ok(legendStart >= 0 && legendEnd > legendStart);
  const legend = source.slice(legendStart, legendEnd);
  assert.equal((legend.match(/style: 'dashline'/g) ?? []).length, 4, 'three winds and fire remain dashed in the legend');
  assert.match(legend, /model\.driveway\)[\s\S]*style: 'line'/, 'computed driveway stays in the solid register');
});

test('wires Sector jobs through authoritative houses and protected-pixel restoration', async () => {
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const composeStart = source.indexOf('async function composeSectorSheet(');
  const composeEnd = source.indexOf('export async function buildBlueprintSectorMap(', composeStart);
  const queueStart = source.indexOf('const generateSectorViaQueue = useCallback(');
  const queueEnd = source.indexOf('// Phasing (08) AI Hybrid', queueStart);
  const completionStart = source.indexOf('async function handleSnapshot(');

  assert.ok(composeStart >= 0 && composeEnd > composeStart);
  assert.ok(queueStart >= 0 && queueEnd > queueStart);
  assert.ok(completionStart >= 0);

  const composer = source.slice(composeStart, composeEnd);
  const queue = source.slice(queueStart, queueEnd);
  const completion = source.slice(completionStart);

  assert.match(composer, /authoritativeHouseFootprints\(renderState, renderRefLayers\)/);
  // THE DOUBLE ROOF. Sector cannot fill the house footprint (filled basemap polygons were rejected
  // for this sheet), and a HOLLOW outline over a base that already shows the roof draws the
  // building twice — a hand-traced polygon never lands exactly on a photographed roof edge. So the
  // outline is allowed only on the flat-grey fallback base, where nothing else would show the
  // buildings at all. Every other sheet is unaffected: they fill, and an opaque roof covers the
  // photographed one.
  assert.match(
    composer,
    /const sectorHasImageryBase = baseImage !== null \|\| Boolean\(renderFrame\.satDataUrl\)/,
    'sector must know whether its base already shows the buildings',
  );
  assert.match(
    composer,
    /if \(!sectorHasImageryBase\) \{[\s\S]*?drawBlueprintHouse\(/,
    'the house outline must stay gated — drawing it over real imagery is the double-roof bug',
  );
  assert.match(queue, /sectorProtectMaskOptions\(\)/);
  assert.match(queue, /protectMaskDataUrl, useProtectMaskForEdit: false/);

  // THE TWO STAGES MUST STAY DIFFERENT, AND BOTH MUST KEEP THEIR CHROME.
  //
  // Two contracts have failed here already, in opposite directions:
  //
  //   1. Restore, then crop the polished PAGE back to the map panel and rebuild the whole overlay
  //      deterministically — so the paid second pass could never look different from the Hybrid.
  //      That was the two-week "no third render" report.
  //   2. Ship the polished page raw, on the reasoning that the model owned it. It did not own it
  //      honestly: it had been handed a page of 9px type it cannot draw, and an image model
  //      answers that by erasing it. That reasoning also produced the paid Planting sheet with no
  //      labels and no legend at all.
  //
  // The contract that resolves both: the model is handed the MAP COLUMN alone, so what comes back
  // is artwork rather than a page, and composeSectorSheet draws every app-owned mark — bearings,
  // legend rows, notes, title — back over it at BOTH stages. The stages still genuinely differ,
  // because the polish pass repaints the ground the whole page is built on. See
  // lib/sheet-chrome-pass.ts.
  // A crop of the Sector map still contains sun/wind/fire marks. Only its unannotated accepted
  // artwork may enter the second pass. Base keeps the crop contract on its own route.
  const queueTree=ts.createSourceFile('queue.ts',queue,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let mapInput:ts.Expression|undefined;
  function findInput(node:ts.Node) {
    if(ts.isVariableDeclaration(node) && node.name.getText(queueTree)==='hybridMapInput')mapInput=node.initializer;
    ts.forEachChild(node,findInput);
  }
  findInput(queueTree);assert.ok(mapInput);
  const select=new Function('hybridInput','kind','hybridMapForPolishRef','cropStyleSheetToMap','mapWidth','mapHeight',
    `return (async()=>(${mapInput.getText(queueTree)}))();`);
  const sourceText=mapInput.getText(queueTree);
  assert.match(sourceText,/kind === 'sector'/);
  assert.match(queue,/polishStage && kind === 'sector' && !hybridMapInput/,'missing raw artwork must stop before a paid enqueue');
  assert.match(completion,/if \(sheet.key === 'sector'\) hybridMapForPolishRef.current = \{key:'sector',map:factualModelImage\}/,
    'stash restored map artwork, never the finished annotated sheet');
  const crop=async()=> 'CROPPED WITH MARKS';
  assert.equal(await select('ANNOTATED PAGE','sector',{current:{key:'sector',map:'RAW ART'}},crop,100,100),'RAW ART');
  assert.equal(await select('ANNOTATED PAGE','sector',{current:{key:'water',map:'WRONG SHEET'}},crop,100,100),null);
  assert.equal(await select('ANNOTATED PAGE','sector',{current:null},crop,100,100),null);
  assert.equal(await select('ANNOTATED PAGE','base',{current:null},crop,100,100),'CROPPED WITH MARKS');
  assert.equal(await select(null,'sector',{current:{key:'sector',map:'STALE ART'}},crop,100,100),null);
  // Before-works sheets added a second restoration purpose: keeping unphotographed ground
  // blank, including after polish. The old regex incorrectly equated that coverage mask with
  // the Hybrid-only roof mask. Execute the actual gates so both rules remain independently
  // capable of failing, rather than pinning the order of their Boolean terms.
  const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const restoreGates: ts.IfStatement[] = [];
  const roofGates: ts.Expression[] = [];
  const inputRoofGates: ts.Expression[] = [];
  const sectorFinishCalls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(tree);
      if (condition.includes('historicalSource') && condition.includes('sourceImage') && condition.includes('protectMask')
          && node.thenStatement.getText(tree).includes('restoreProtectedPixels(sourceImage, raw,')) restoreGates.push(node);
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'currentMask'
        && node.initializer && ts.isConditionalExpression(node.initializer)
        && node.initializer.whenTrue.getText(tree).includes('buildProtectMask(')) roofGates.push(node.initializer.condition);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'protectMaskDataUrl'
        && node.getStart(tree) >= queueStart && node.getEnd() <= queueEnd
        && node.initializer && ts.isConditionalExpression(node.initializer)
        && node.initializer.whenTrue.getText(tree).includes('buildProtectMask(')) inputRoofGates.push(node.initializer.condition);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'finishSectorRef.current'
        && node.arguments[0]?.getText(tree) === 'factualModelImage') sectorFinishCalls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(restoreGates.length, 1, 'one actual restore call owns the coverage/Hybrid decision');
  assert.equal(roofGates.length, 1, 'one ordinary roof-mask decision remains visible');
  assert.equal(inputRoofGates.length, 1, 'one queue decision promises the ordinary roof mask');
  const restore = new Function('sheet', 'sourceImage', 'protectMask', 'isPolishedResult', 'historicalSource',
    `return Boolean(${restoreGates[0].expression.getText(tree)});`) as (sheet: {key:string}, source: string|null, mask: string|null, polished: boolean, historic: object|null) => boolean;
  const roof = new Function('sheet', 'isPolishedResult', `return Boolean(${roofGates[0].getText(tree)});`) as (sheet: {key:string}, polished: boolean) => boolean;
  const inputRoof = new Function('kind', 'polishStage', `return Boolean(${inputRoofGates[0].getText(tree)});`) as (kind: string, polish: boolean) => boolean;
  for (const key of ['sector', 'base', 'water']) for (const polished of [false, true]) {
    assert.equal(restore({key}, 'source', 'mask', polished, null), key === 'sector' && !polished, 'ordinary photos restore only Sector Hybrid');
    assert.equal(roof({key}, polished), key === 'sector' && !polished, 'a polished image must never receive the old photographic roof mask');
    assert.equal(inputRoof(key, polished), roof({key}, polished), 'queue input and completion must agree about the ordinary roof mask');
    assert.equal(restore({key}, null, 'mask', polished, {}), false, 'coverage cannot restore missing source pixels');
    assert.equal(restore({key}, 'source', null, polished, {}), false, 'coverage cannot restore without its recorded mask');
  }
  assert.match(queue, /if\s*\(historicalActive && availableHistoricalBaseline\)[\s\S]*buildHistoricalCoverageMask/);
  assert.equal(restore({key:'sector'}, 'source', 'mask', true, {}), true, 'historic polish still preserves genuinely unphotographed ground');
  assert.equal(restore({key:'base'}, 'source', 'mask', false, {}), true, 'the Existing Site baseline preserves the same coverage');
  assert.match(restoreGates[0].thenStatement.getText(tree), /if\s*\(historicalSource\)[\s\S]*buildHistoricalCoverageMask/);
  assert.match(restoreGates[0].thenStatement.getText(tree), /stackOverlayImages\(coverage,currentMask/);
  assert.equal(sectorFinishCalls.length, 1, 'the retained map still has one Sector finisher');
  assert.deepEqual(sectorFinishCalls[0].arguments.map(a => a.getText(tree)), ['factualModelImage', 'frozenScene', 'historicalSource'],
    'Sector recomposes the actual restored image with its frozen geometry and its own historical source');
  assert.doesNotMatch(
    completion,
    /sectorPolishOwnsPage/,
    'no stage may ship a paid page the app never composed chrome onto',
  );
});

test('the shared exact-layer stack puts each boundary treatment below the sheet’s features', async () => {
  // Zones has a quieter boundary than the other sheets. Exercise paint order rather than
  // treating the first Zones conditional as the start of feature painting.
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | undefined;
  tree.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'buildExactLayerOverlay') declaration = node;
  });
  assert.ok(declaration);
  const javascript = ts.transpileModule(declaration.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const events: string[] = [];
  const feature = () => events.push('feature');
  const ctx = { save() {}, restore() {}, drawImage() {}, globalAlpha: 1 };
  const scope = {
    preloadReferenceFeatureArtwork: async () => {},
    document: { createElement: () => ({ getContext: () => ctx }) },
    drawBlueprintBoundary: () => events.push('boundary'),
    drawZoneBoundary: () => events.push('zone-boundary'),
    drawExactFeaturesWithPresentation: (_ctx: unknown, _w: number, _h: number, _style: unknown, paint: (ctx: unknown) => void) => paint(ctx),
    drawFilteredLines: () => {},
    drawFilteredItems: feature,
    drawWaterFeatures: feature,
    drawContextItems: feature,
    drawWaterRoutes: () => {},
    drawWaterLeaderLabels: () => {},
    drawEarthworksFeatures: feature,
    buildZoneOverlay: () => undefined,
    EXACT_CONTEXT_ALPHA: { zones: 0.5, structures: 0.5 },
    drainCanvasToDataUrl: () => 'overlay',
  };
  const paint = new Function(...Object.keys(scope), javascript + '; return buildExactLayerOverlay;')(...Object.values(scope));
  for (const sheet of ['zones', 'water', 'earthworks', 'planting', 'structures', 'all']) {
    events.length = 0;
    await paint({}, { imgW: 100, mPerPx: 1, satDataUrl: 'photo' }, {}, sheet, 100, 100);
    assert.equal(events[0], sheet === 'zones' ? 'zone-boundary' : 'boundary', sheet);
    assert.ok(events.includes('feature'), sheet + ' must exercise actual feature painting');
    assert.equal(events.filter(event => event.endsWith('boundary')).length, 1, sheet + ' paints one boundary');
  }
});


test('muted Sector context retains white archive gaps and never shifts source pixels', () => {
  const source=readFileSync(new URL('../components/design/DesignGlossy.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('sheet.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let paint:ts.FunctionDeclaration|undefined;
  tree.forEachChild(node=>{if(ts.isFunctionDeclaration(node) && node.name?.text==='drawSectorArtworkContext')paint=node;});
  assert.ok(paint);
  const compiled=ts.transpileModule(paint.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const run=new Function(`${compiled};return drawSectorArtworkContext;`)();
  const original=new Uint8ClampedArray([255,255,255,255,25,65,35,255,110,80,70,0,250,251,252,255]);
  const data=new Uint8ClampedArray(original),draws:unknown[][]=[],writes:unknown[][]=[];
  run({drawImage(...args:unknown[]){draws.push(args);},getImageData(){return {data};},putImageData(...args:unknown[]){writes.push(args);}},'art',4,1);
  assert.deepEqual(draws,[['art',0,0,4,1]]);
  assert.deepEqual(writes[0].slice(1),[0,0]);
  assert.deepEqual([...data.slice(0,4)],[...original.slice(0,4)]);
  assert.deepEqual([...data.slice(8)],[...original.slice(8)],'transparent/white source gaps stay original');
  assert.equal(data[7],255);
  assert.ok(data[4]>original[4] && data[5]>original[5] && data[6]>original[6],'the ground visibly lightens');
  assert.ok(Math.max(...data.slice(4,7))-Math.min(...data.slice(4,7)) < 40,'context is quieter than thematic colours');
});


test('authored Sector wind and solar graphics retain their actual bearings at screen and print scales', () => {
  const source=readFileSync(new URL('../components/design/DesignGlossy.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('sheet.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const arrows=new Map<string,string>();
  function visit(node:ts.Node) {
    if(ts.isVariableDeclaration(node) && ['drawBroadEnergyArrow','drawSunArc'].includes(node.name.getText(tree)) && node.initializer)
      arrows.set(node.name.getText(tree),node.initializer.getText(tree));
    ts.forEachChild(node,visit);
  }
  visit(tree);assert.equal(arrows.size,2);
  const compile=(name:string,scope:Record<string,unknown>)=>{
    const js=ts.transpileModule(`const paint=${arrows.get(name)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    return new Function(...Object.keys(scope),`${js};return paint;`)(...Object.values(scope));
  };
  for(const W of [800,2200]) {
    const moves:number[][]=[],curves:number[][]=[],arcs:number[][]=[],dashes:number[][]=[],suns:number[][]=[];
    const context=new Proxy({}, {get(_target,key){return (...args:number[])=>{
      if(key==='moveTo')moves.push(args);if(key==='bezierCurveTo')curves.push(args);
      if(key==='arc')arcs.push(args);if(key==='setLineDash')dashes.push(args[0] as unknown as number[]);
    };},set(){return true;}});
    const common={ctx:context,W,H:W,cx:W*.5,cy:W*.5,R:W*.3,arrowLen:W*.07,artFinish:true,externalLegend:true,
      SECTOR_ENERGY_TIP:.94,claimArrowBox(){},bearingToUnitVector,bearingToCanvasAngle:(bearing:number)=>(bearing-90)*Math.PI/180,
      drawSunIcon(...args:number[]){suns.push(args);},REFERENCE_LABEL_FONT:'Arial'};
    const wind=compile('drawBroadEnergyArrow',common);
    for(const bearing of [45,225,315]) {
      moves.length=0;curves.length=0;dashes.length=0;
      const v=bearingToUnitVector(bearing);wind(v,'#426D9B');
      const tip=moves.at(-1)!;
      assert.ok(Math.abs(tip[0]-(W*.5+v[0]*W*.3*.94))<1e-8);
      assert.ok(Math.abs(tip[1]-(W*.5+v[1]*W*.3*.94))<1e-8);
      assert.equal(curves.length,3,'wind stays a family of streamlines, not a filled wedge');
      assert.ok(dashes.some(dash=>dash.length===2 && dash.every(value=>value>0)),'regional wind remains dashed');
    }
    const sun=compile('drawSunArc',common);
    for(const noonSide of ['N','S']) {
      arcs.length=0;suns.length=0;
      const path={sunriseAzDeg:65,sunsetAzDeg:295,noonSide};sun(path,W*.4,'#B76F20');
      assert.ok(arcs.length>=1);
      for(const arc of arcs) {
        assert.equal(arc[2],W*.4);
        assert.equal(arc[3],(65-90)*Math.PI/180);assert.equal(arc[4],(295-90)*Math.PI/180);
        assert.equal(arc[5],noonSide==='N','the real noon side controls the sweep');
      }
      assert.equal(suns.length,3);
    }
  }
});
