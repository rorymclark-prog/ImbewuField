import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoDesignCanvasState, buildDemoBoundaryFC, DEMO_SITE } from '../lib/demo-farm.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { mergeFarmShapesIntoDesignState } from '../lib/design-studio.ts';
import { statusOf, type DesignCanvasState } from '../lib/design-canvas.ts';
import { mapRefLayersForCanvas } from '../lib/report-map-layers.ts';
import { collectReportSiteFacts } from '../lib/report-site-facts-collect.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';
import { buildPhasePlan } from '../lib/phasing.ts';
import { WATER_SHEET_ROOF_RUNOFF_COEFFICIENT, roofHarvestLitres } from '../lib/roof-runoff.ts';
import { computeTankSizing } from '../lib/tank-sizing.ts';
import type { LocationData } from '../lib/types.ts';
import {
  FIGURE_WIDTH, climateFigure, figureNumber, landUseFigure, sectorFigure, siteReportFigures, sitePlanFigure,
  soilFigure, statusFigure, timelineFigure, waterBudgetFigure, type ReportFigure,
} from '../lib/report-figures.ts';

// The sample farm, assembled the way the report assembles it in the browser.
const canvas = buildDemoDesignCanvasState();
const blank = { siteId: canvas.siteId, layers: [], updatedAt: '' } as never;
const merged = mergeFarmShapesIntoDesignState(buildDemoBoundaryFC(), blank, canvas.siteId);
const refs = mapRefLayersForCanvas(merged.layers, canvas, DEMO_SITE.lat, DEMO_SITE.lon);
const withSoil = (soilSource: string): LocationData => ({ ...DEMO_LOCATION, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, soil: { ...DEMO_LOCATION.soil, soilSource } } as LocationData);
const location = withSoil('soilgrids');
const facts: ReportSiteFacts = {
  ...collectReportSiteFacts({ siteId: canvas.siteId, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, canvas, waterPoints: [] }),
  roof: { areaM2: 144, source: 'Traced on the map' }, boundary: { areaM2: 1037, source: 'Traced on the map' },
} as ReportSiteFacts;
const phasePlan = buildPhasePlan(canvas, refs, { biome: location.biome.name, rainfallMm: location.rainfall.annual });
const all = (language = 'en') => siteReportFigures(facts, location, language, { canvas, mapLayers: refs, phasePlan });
const byId = (id: string, language = 'en') => { const figure = all(language).find(f => f.id === id); assert.ok(figure, `${id} is drawn for the sample farm`); return figure; };
/** The words a reader can see in a drawing, in the order they were written. */
const words = (figure: ReportFigure) => [...figure.svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1].replace(/<[^>]+>/g, '')).join(' | ');

// ── every figure ────────────────────────────────────────────────────────────────────────────────
test('the sample farm gets all eight figures, the ground first, then what arrives on it, then the plan', () => {
  assert.deepEqual(all().map(f => f.id), ['site-plan', 'land-use', 'status', 'climate', 'sectors', 'water-budget', 'soil', 'timeline']);
});

test('every figure is one 640 px drawing that says what it is, how to read it and where it came from', () => {
  assert.equal(FIGURE_WIDTH, 640);
  for (const language of ['en', 'zu']) for (const f of all(language)) {
    assert.equal(f.width, 640, f.id);
    assert.ok(Number.isInteger(f.height) && f.height > 60, `${f.id} height ${f.height}`);
    assert.ok(f.svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${f.height}" viewBox="0 0 640 ${f.height}">`), `${f.id} header`);
    assert.ok(f.svg.endsWith('</svg>'), f.id);
    for (const field of ['title', 'note', 'source', 'alt'] as const) assert.ok(f[field].trim().length > 3, `${f.id} ${field} (${language})`);
  }
});

test('no drawing carries a broken number, a script, an outside file or a web font', () => {
  for (const language of ['en', 'zu']) for (const f of all(language)) {
    const everything = `${f.svg} ${f.title} ${f.note} ${f.source} ${f.alt}`;
    assert.doesNotMatch(everything, /NaN|undefined|Infinity|\[object/, `${f.id} (${language})`);
    // The report rasterises each drawing through an <img>: nothing may be fetched, nothing may run.
    assert.doesNotMatch(f.svg, /<script|<image|<foreignObject|href=|url\(\s*['"]?http/i, f.id);
    assert.doesNotMatch(f.svg, /font-family="(?!Arial, sans-serif")/, `${f.id} uses a font an <img> cannot load`);
    // U+00A0 is dropped by the PDF's WinAnsi font, which would run "88 474" together.
    assert.doesNotMatch(everything, /\u00a0/, `${f.id} carries a non-breaking space`);
  }
});

test('numbers are grouped with a plain space and written with a decimal point', () => {
  assert.equal(figureNumber(88474), '88 474');
  assert.equal(figureNumber(1037), '1 037');
  assert.equal(figureNumber(999), '999');
  assert.equal(figureNumber(1234567.25, 2), '1 234 567.25');
  assert.equal(figureNumber(6.5, 1), '6.5');
  assert.equal(figureNumber(6, 1), '6', 'no trailing zero');
  assert.equal(figureNumber(0.04, 1), '0');
});

test('isiZulu changes the words and nothing else about which figures are drawn', () => {
  const en = all('en'), zu = all('zu');
  assert.deepEqual(zu.map(f => f.id), en.map(f => f.id));
  for (const [i, f] of zu.entries()) assert.notEqual(f.title, en[i].title, `${f.id} title is translated`);
});

// ── missing stays missing ───────────────────────────────────────────────────────────────────────
test('with nothing saved there is nothing to draw: no figure is built from a default', () => {
  assert.deepEqual(siteReportFigures(null, null), []);
  assert.deepEqual(siteReportFigures(undefined, undefined, 'en', {}), []);
  for (const empty of [null, undefined]) {
    assert.equal(sitePlanFigure(empty), null);
    assert.equal(statusFigure(empty), null);
    assert.equal(climateFigure(empty), null);
    assert.equal(sectorFigure(empty, facts), null);
    assert.equal(soilFigure(empty), null);
    assert.equal(timelineFigure(empty), null);
    assert.equal(landUseFigure(empty), null);
    assert.equal(waterBudgetFigure(empty, location), null);
    assert.equal(waterBudgetFigure(facts, empty), null);
  }
});

test('rain is drawn only from twelve real months', () => {
  const rain = (monthly: number[]) => ({ ...location, rainfall: { ...location.rainfall, monthly } }) as LocationData;
  assert.equal(climateFigure(rain([])), null);
  assert.equal(climateFigure(rain(location.rainfall.monthly.slice(0, 11))), null, 'eleven months');
  assert.equal(climateFigure(rain(new Array(12).fill(0))), null, 'a year of zeros is a missing record, not a desert');
  assert.equal(climateFigure(rain([...location.rainfall.monthly.slice(0, 11), -4])), null, 'a negative month');
  assert.equal(waterBudgetFigure(facts, rain(new Array(12).fill(0))), null);
  assert.ok(climateFigure(rain(location.rainfall.monthly)));
});

test('the water budget needs a traced roof; land use needs a traced boundary', () => {
  assert.equal(waterBudgetFigure({ ...facts, roof: undefined } as ReportSiteFacts, location), null);
  assert.equal(waterBudgetFigure({ ...facts, roof: { areaM2: 0, source: 'x' } } as ReportSiteFacts, location), null);
  assert.equal(landUseFigure({ ...facts, boundary: undefined } as ReportSiteFacts), null);
});

test('land use that adds up to more than the site is a wrong measurement, so nothing is drawn', () => {
  assert.equal(landUseFigure({ ...facts, boundary: { areaM2: 150, source: 'x' } } as ReportSiteFacts), null);
});

test('an order of work needs at least two stages with real weeks', () => {
  assert.equal(timelineFigure({ ...phasePlan, phases: phasePlan.phases.slice(0, 1) }), null);
  assert.equal(timelineFigure({ ...phasePlan, phases: phasePlan.phases.map((ph, i) => i === 1 ? { ...ph, weekEnd: ph.weekStart - 1 } : ph) }), null, 'a stage that ends before it starts');
  assert.equal(statusFigure({ ...canvas, items: [], zones: [], lines: [] } as DesignCanvasState), null, 'an empty design has no progress to show');
});

test('a sun diagram is not drawn for a latitude that is not on the Earth', () => {
  assert.equal(sectorFigure({ ...location, lat: 123 } as LocationData, facts), null);
  assert.equal(sectorFigure({ ...location, lat: Number.NaN } as LocationData, facts), null);
});

// ── soil: the mark carries where the number came from ───────────────────────────────────────────
test('soil that is only the app\'s generic fallback is drawn as not measured, and its numbers never appear', () => {
  const figure = soilFigure(withSoil('estimate'));
  assert.ok(figure);
  assert.match(words(figure), /has not been measured yet/);
  assert.equal((words(figure).match(/not measured/g) ?? []).length, 3, 'three empty readings');
  assert.match(figure.source, /No soil measurement recorded/);
  assert.doesNotMatch(`${words(figure)} ${figure.alt}`, /\d+(\.\d+)?\s*%|pH \d/, 'no value from the fallback is printed');
  assert.ok(figure.height < 160, 'compact: three empty scales would be a tall drawing of nothing');
});

test('a world-model estimate is a hollow dot and says it is an estimate; a laboratory result is a filled dot', () => {
  const model = soilFigure(withSoil('soilgrids')), lab = soilFigure(withSoil('lab'));
  assert.ok(model && lab);
  assert.match(model.source, /SoilGrids/);
  assert.match(model.source, /an estimate, not a measurement/);
  assert.match(lab.source, /laboratory/i);
  assert.match(words(model), /Hollow dot/);
  assert.match(words(lab), /Filled dot/);
  assert.notEqual(model.svg, lab.svg);
  assert.match(model.alt, /pH \d/);
});

// ── one maths ───────────────────────────────────────────────────────────────────────────────────
test('the roof catch in the headline is the same sum the report text and the water sheet use', () => {
  const figure = byId('water-budget');
  const expected = Math.round(roofHarvestLitres(144, location.rainfall.annual, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT));
  assert.match(words(figure), new RegExp(`This roof can catch ${figureNumber(expected)} L in an average year`));
  assert.match(figure.alt, new RegExp(`${figureNumber(expected)} L a year`));
});

test('the storage it says is needed is the Tank Calculator\'s answer, not a second opinion', () => {
  const daily = facts.measurements?.dailyWaterUseL;
  assert.ok(typeof daily === 'number' && daily > 0, 'the sample farm records its daily water use');
  const sizing = computeTankSizing({ monthlyRainfallMm: location.rainfall.monthly, roofAreaM2: 144, dailyUseL: daily });
  assert.ok(sizing.ok && sizing.recommendedStorageL > 0);
  const figure = byId('water-budget');
  assert.match(words(figure), /Needed to carry this use through the dry months \(Tank Calculator\)/);
  assert.ok(words(figure).includes(`${figureNumber(sizing.recommendedStorageL)} L`), 'the calculator\'s litres are the litres printed');
  assert.ok(words(figure).includes(`${figureNumber(facts.water?.statedStorageLitres ?? 0)} L`), 'beside the storage drawn on the plan');
});

test('without a recorded daily use the water figure says so and claims no shortfall', () => {
  const figure = waterBudgetFigure({ ...facts, measurements: { ...facts.measurements, dailyWaterUseL: undefined } } as ReportSiteFacts, location);
  assert.ok(figure);
  assert.match(words(figure), /Daily water use has not been recorded for this site/);
  assert.doesNotMatch(`${words(figure)} ${figure.alt}`, /Short:|short in|Tank Calculator/);
  assert.doesNotMatch(figure.svg, /<pattern id="short"/);
});

test('land use is the site split into pieces that add back up to the site', () => {
  const figure = byId('land-use');
  const areas = [...figure.alt.matchAll(/(\d[\d ]*(?:\.\d+)?) m²/g)].map(m => Number(m[1].replace(/ /g, '')));
  assert.equal(areas.length, 4, 'beds, plots, roof, everything else');
  assert.ok(Math.abs(areas.reduce((a, b) => a + b, 0) - 1037) <= 1.5, `pieces ${areas.join(' + ')} make the 1 037 m² site`);
  assert.match(words(figure), /The whole site: 1 037 m²/);
  assert.equal(areas[0], facts.design?.bedAreaM2);
  assert.equal(areas[1], facts.design?.plotAreaM2);
});

// ── the calendar axis ───────────────────────────────────────────────────────────────────────────
test('rain and water both read January to December, left to right', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const id of ['climate', 'water-budget']) {
    const figure = byId(id);
    const xs = months.map(month => { const m = figure.svg.match(new RegExp(`<text x="([\\d.]+)"[^>]*>${month}</text>`)); assert.ok(m, `${id} labels ${month}`); return Number(m[1]); });
    for (let i = 1; i < 12; i++) assert.ok(xs[i] > xs[i - 1], `${id}: ${months[i]} sits right of ${months[i - 1]}`);
  }
});

test('the rain headline names the wettest and driest month from the record itself', () => {
  const monthly = location.rainfall.monthly, names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const wettest = monthly.indexOf(Math.max(...monthly)), driest = monthly.indexOf(Math.min(...monthly));
  const text = words(byId('climate'));
  assert.ok(text.includes(`Wettest month: ${names[wettest]} (${figureNumber(monthly[wettest])} mm)`), text.slice(0, 200));
  assert.ok(text.includes(`Driest month: ${names[driest]} (${figureNumber(monthly[driest])} mm)`));
  assert.ok(text.includes(`${figureNumber(location.rainfall.annual)} mm of rain in an average year`));
});

// ── never colour alone ──────────────────────────────────────────────────────────────────────────
test('progress counts what the design itself marks as existing, one mark each, planned marks dashed', () => {
  const figure = byId('status');
  const things = [...canvas.items, ...(canvas.zones ?? []).filter(zone => zone.feature === 'staple_garden'), ...(canvas.lines ?? [])];
  const planned = things.filter(thing => statusOf(thing as never) === 'proposed').length;
  assert.match(words(figure), new RegExp(`^${things.length - planned} already there\\s+·\\s+${planned} still to build or plant`));
  const solid = (figure.svg.match(/<circle[^>]*r="6"[^>]*>/g) ?? []).filter(mark => !/stroke-dasharray/.test(mark)).length;
  const dashed = (figure.svg.match(/<circle[^>]*r="5.2"[^>]*stroke-dasharray[^>]*>/g) ?? []).length;
  // One of each is the key; the rest are the design.
  assert.equal(solid - 1, things.length - planned);
  assert.equal(dashed - 1, planned);
});

test('every stage of work wears the planned look, and the shortfall and the plots are hatched, not just coloured', () => {
  const timeline = byId('timeline');
  const bars = timeline.svg.match(/<rect[^>]*fill="#e6efe6"[^>]*>/g) ?? [];
  assert.equal(bars.length, phasePlan.phases.length + 1, 'one bar a stage, plus the key');
  for (const bar of bars) assert.match(bar, /stroke-dasharray/);
  assert.match(byId('water-budget').svg, /<pattern id="short"/);
  assert.match(byId('land-use').svg, /<pattern id="plot"/);
  assert.match(timeline.alt, new RegExp(`^Order of work: 1\\. ${phasePlan.phases[0].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

// ── the site plan ───────────────────────────────────────────────────────────────────────────────
test('the site plan numbers the beds, names the plots, and carries a scale bar and a north arrow', () => {
  const figure = byId('site-plan');
  const text = words(figure);
  for (let bed = 1; bed <= 7; bed++) assert.match(text, new RegExp(`(^|\\| )${bed}( \\||$)`), `bed ${bed}`);
  for (const plot of ['P1', 'P2', 'P3', 'P4']) assert.ok(text.includes(plot), plot);
  assert.match(text, /\b\d+ m\b/, 'scale bar');
  assert.match(text, /North/);
  assert.match(text, /House/);
  assert.match(figure.note, /Drawn to scale from the saved design/);
  assert.match(figure.note, /not a land survey/);
});

test('a design with no mapped ground has no plan, and a map ring traced for other ground is left out', () => {
  const far = { ...refs, boundary: refs.boundary.map(([x, y]) => [x + 40, y + 40]) } as typeof refs;
  const figure = sitePlanFigure(canvas, 'en', far);
  assert.ok(figure, 'the plan is still drawn from the design');
  assert.doesNotMatch(words(figure), /Site boundary/, 'without a boundary that belongs somewhere else');
  assert.match(words(byId('site-plan')), /Site boundary/);
});

test('one figure failing never takes the report\'s other pictures with it', () => {
  const broken = { ...canvas, items: [{ defId: 'raised_bed', get x(): number { throw new Error('corrupt'); } }] } as unknown as DesignCanvasState;
  assert.throws(() => sitePlanFigure(broken, 'en', refs), /corrupt/, 'the plan builder really does fail on this design');
  const figures = siteReportFigures(facts, location, 'en', { canvas: broken, mapLayers: refs, phasePlan });
  assert.deepEqual(figures.map(f => f.id), ['land-use', 'status', 'climate', 'sectors', 'water-budget', 'soil', 'timeline'], 'only the plan is missing');
});
