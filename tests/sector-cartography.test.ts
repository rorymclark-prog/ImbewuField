import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { deriveSectorModel } from '../lib/sector.ts';
import { presentSectorCartography, sectorEvidenceSummary, SECTOR_STYLES, sectorFillColor, sectorStrokeWidth } from '../lib/sector-cartography.ts';
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

test('wires Sector jobs through authoritative houses and protected-pixel restoration', () => {
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
  assert.match(queue, /sectorProtectMaskOptions\(\)/);
  assert.match(queue, /protectMaskDataUrl, useProtectMaskForEdit: false/);

  const restoreAt = completion.indexOf("sheet.key === 'sector' && sourceImage && protectMask");
  const cropAt = completion.indexOf("showcase && (sheet.key === 'sector' || sheet.key === 'base')");
  assert.ok(restoreAt >= 0, 'Sector must restore protected source pixels');
  assert.ok(cropAt > restoreAt, 'Sector must restore protected pixels before cropping the polished sheet');
});
