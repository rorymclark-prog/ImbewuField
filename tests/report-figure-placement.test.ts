import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  chapterGraphics, placeReportFigures, placedFigureIds, reportChapterGraphics,
  REPORT_ART_READY, REPORT_ART_SIZE, reportArtSrc,
} from '../lib/report-chapter-visuals.ts';
import { withReportFigures, type ReportChart, type ReportVisuals } from '../lib/report-visuals.ts';
import type { ReportFigure } from '../lib/report-figures.ts';
import { REPORT_ZU } from '../lib/report-localisation.ts';

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────
const FIGURE_IDS = ['site-plan', 'climate', 'water-budget', 'sectors', 'soil', 'timeline', 'land-use', 'status'];
const figure = (id: string): ReportFigure => ({
  id, title: `Title ${id}`, note: `Note ${id}.`, source: `Source ${id}`, alt: `Alt ${id}`,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300"></svg>', width: 640, height: 300,
});
const plain = (id: string, kind: ReportChart['kind'] = 'bars'): ReportChart => ({ id, title: id, note: '', unit: '', kind, rows: [{ label: 'a', value: 1 }] });
const base = (): ReportVisuals => ({
  title: 'Site', subtitle: '', basis: '', metrics: [],
  charts: [plain('rainfall', 'months'), plain('water'), plain('area'), plain('cost')],
});
const visuals = (ids = FIGURE_IDS, language = 'en') => withReportFigures(base(), ids.map(figure), language);

/** The sections a real report can hold, read from the screen that offers them, so this test
 * cannot drift from the list a farmer actually chooses from. */
const ALL_SECTIONS = (() => {
  const source = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  const block = /const ALL_SECTIONS = \[([\s\S]*?)\] as const;/.exec(source);
  assert.ok(block, 'ReportView.tsx still declares ALL_SECTIONS');
  return [...block[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
})();
const SAMPLE_HEADINGS = ['report basis', 'Ubhejane Creche', 'Crop plan', 'Water, soil and the mapped site', 'Bill of quantities', 'Next actions and checks', 'Full design inventory', 'Production spaces', 'Evidence and limitations'];
const asReport = (headings: string[], body = 'Some advice.') => headings.map((heading, i) => `## ${i + 1}. ${heading}\n${body}\n`).join('\n');

// ── withReportFigures ───────────────────────────────────────────────────────────────────────────
test('a report without drawn figures keeps exactly the charts it had', () => {
  const before = base();
  assert.equal(withReportFigures(before, []), before);
});

test('a drawn figure replaces the plain chart of the same subject, so nothing is shown twice', () => {
  const ids = visuals().charts.map(chart => `${chart.id}:${chart.kind}`);
  assert.deepEqual(ids, ['site-plan:figure', 'land-use:figure', 'status:figure', 'cost:bars', 'rainfall:figure', 'water-budget:figure', 'sectors:figure', 'soil:figure', 'timeline:figure']);
});

test('a plain chart stays when the figure that would replace it could not be drawn', () => {
  const ids = visuals(['site-plan', 'sectors']).charts.map(chart => chart.id);
  assert.deepEqual(ids, ['site-plan', 'rainfall', 'water', 'area', 'cost', 'sectors']);
  assert.equal(visuals(['site-plan', 'sectors']).charts.find(chart => chart.id === 'rainfall')?.kind, 'months');
});

test('the base visuals are not mutated, because saved reports and tests pin them', () => {
  const before = base();
  const copy = JSON.parse(JSON.stringify(before));
  withReportFigures(before, FIGURE_IDS.map(figure));
  assert.deepEqual(before, copy);
});

test('each figure carries its source into the caption and its kicker in the report language', () => {
  const en = visuals().charts.find(chart => chart.id === 'water-budget')!;
  assert.equal(en.note, 'Note water-budget. Source: Source water-budget');
  assert.equal(en.unit, 'LITRES');
  assert.deepEqual(en.rows, []);
  const zu = visuals(FIGURE_IDS, 'zu').charts.find(chart => chart.id === 'water-budget')!;
  assert.match(zu.note, /Umthombo: Source water-budget$/);
  assert.equal(zu.unit, 'AMALITHA');
});

test('the words that tell a phone reader a wide figure slides are set in the report language', () => {
  assert.equal(visuals().slideHint, 'Slide to see more');
  assert.ok(visuals(FIGURE_IDS, 'zu').slideHint);
  assert.notEqual(visuals(FIGURE_IDS, 'zu').slideHint, visuals().slideHint);
  assert.equal(base().slideHint, undefined);
});

// ── placement ───────────────────────────────────────────────────────────────────────────────────
const placedUnder = (headings: string[], language = 'en') => {
  const placed = placeReportFigures(headings, visuals(FIGURE_IDS, language));
  return Object.fromEntries(Object.entries(placed).map(([heading, charts]) => [heading, charts.map(chart => chart.id)]));
};

test('in a full report every chapter figure sits under the chapter that discusses it', () => {
  assert.deepEqual(placedUnder(ALL_SECTIONS), {
    'Site Conditions': ['rainfall'],
    'Sun & Solar': ['sectors'],
    'Water Harvesting': ['water-budget'],
    'Soil Strategy': ['soil'],
    'Year 1 Priorities': ['timeline'],
  });
});

test('in the sample report the water and soil figures share the one chapter that covers both', () => {
  assert.deepEqual(placedUnder(SAMPLE_HEADINGS), {
    'Water, soil and the mapped site': ['water-budget', 'soil'],
    'Next actions and checks': ['timeline'],
  });
});

test('numbered and isiZulu headings are matched like the English titles they stand for', () => {
  const numbered = ALL_SECTIONS.map((heading, i) => `${i + 1}. ${heading}`);
  assert.deepEqual(Object.values(placedUnder(numbered)).flat().sort(), ['rainfall', 'sectors', 'soil', 'timeline', 'water-budget']);
  const zulu = ALL_SECTIONS.map(heading => REPORT_ZU[heading as keyof typeof REPORT_ZU] ?? heading);
  assert.equal(placedUnder(zulu, 'zu')[REPORT_ZU['Water Harvesting' as keyof typeof REPORT_ZU]]?.[0], 'water-budget');
});

test('a figure falls back to its next-best chapter when the first choice was not generated', () => {
  assert.deepEqual(placedUnder(['Executive Summary', 'Irrigation Plan', 'Wind & Windbreaks', '5-Year Vision']), {
    'Irrigation Plan': ['water-budget'],
    'Wind & Windbreaks': ['sectors'],
    '5-Year Vision': ['timeline'],
  });
});

test('the site plan, land use and built-or-planned figures never leave the overview', () => {
  for (const headings of [ALL_SECTIONS, SAMPLE_HEADINGS]) {
    const placed = Object.values(placedUnder(headings)).flat();
    for (const id of ['site-plan', 'land-use', 'status']) assert.ok(!placed.includes(id), `${id} stays in the overview`);
  }
});

for (const [name, headings] of [['full', ALL_SECTIONS], ['sample', SAMPLE_HEADINGS], ['summary-only', ['Executive Summary']]] as const) {
  test(`every drawn figure appears exactly once in a ${name} report: in its chapter or in the overview`, () => {
    const all = visuals();
    const chapters = reportChapterGraphics(asReport([...headings]), all);
    const inChapters = Object.values(chapters).flat().filter(graphic => graphic.chart?.kind === 'figure').map(graphic => graphic.chart!.id);
    const placed = placedFigureIds(chapters);
    const inOverview = all.charts.filter(chart => chart.kind === 'figure' && !placed.has(chart.id)).map(chart => chart.id);
    assert.deepEqual([...inChapters, ...inOverview].sort(), all.charts.filter(chart => chart.kind === 'figure').map(chart => chart.id).sort());
    assert.equal(new Set(inChapters).size, inChapters.length, 'no figure is repeated across chapters');
  });
}

// ── chapter graphics: order and concept pictures ────────────────────────────────────────────────
test('in a chapter covering two subjects each concept picture follows the figure it explains', () => {
  const all = visuals();
  const placed = placeReportFigures(SAMPLE_HEADINGS, all)['Water, soil and the mapped site'];
  const ids = chapterGraphics('Water, soil and the mapped site', 'Tank and beds.', all, placed).map(graphic => graphic.id);
  assert.deepEqual(ids, ['figure-water-budget', 'art-roof-to-tank', 'figure-soil', 'art-soil-layers']);
});

test('a concept picture whose figure is elsewhere is simply added after this chapter\'s own figures', () => {
  const all = visuals();
  const ids = chapterGraphics('Water, soil and the mapped site', '', all, []).map(graphic => graphic.id);
  assert.deepEqual(ids, ['art-roof-to-tank', 'art-soil-layers']);
  const timeline = all.charts.filter(chart => chart.id === 'timeline');
  assert.deepEqual(chapterGraphics('Crop plan', '', all, timeline).map(graphic => graphic.id), ['figure-timeline', 'art-crop-rotation']);
});

test('two concept pictures explaining the same figure keep their order behind it', () => {
  const all = visuals();
  const water = all.charts.filter(chart => chart.id === 'water-budget');
  const ids = chapterGraphics('Water Harvesting', 'Dig a swale on the contour.', all, water).map(graphic => graphic.id);
  assert.deepEqual(ids, ['figure-water-budget', 'art-roof-to-tank', 'art-swale-section']);
});

test('a technique is pictured only where the chapter text talks about it', () => {
  const all = visuals();
  assert.deepEqual(chapterGraphics('Soil Strategy', 'Add mulch.', all).map(graphic => graphic.id), ['art-soil-layers']);
  assert.deepEqual(chapterGraphics('Soil Strategy', 'Dig a trench bed and start compost.', all).map(graphic => graphic.id), ['art-soil-layers', 'art-trench-bed']);
});

test('no chapter of any report carries more than two concept pictures', () => {
  const body = 'swale contour berm trench compost wind fire market solar zones guild irrigation';
  for (const heading of [...ALL_SECTIONS, ...SAMPLE_HEADINGS]) {
    const art = chapterGraphics(heading, body, visuals()).filter(graphic => graphic.art);
    assert.ok(art.length <= 2, `${heading}: ${art.length} concept pictures`);
  }
});

test('every concept picture says in its first words that it is not a picture of this site', () => {
  const body = 'swale contour berm trench compost';
  const seen = new Set<string>();
  for (const heading of [...ALL_SECTIONS, ...SAMPLE_HEADINGS, 'Soil plan and year 1', 'Earthworks on the slope', 'Food forest guilds']) {
    for (const graphic of chapterGraphics(heading, body, visuals())) {
      if (!graphic.art) continue;
      seen.add(graphic.id);
      assert.match(graphic.note, /^Concept illustration, the same in every report\. It is not a picture of this site\./, graphic.id);
      assert.ok(graphic.art.alt.length > 40, `${graphic.id} describes the picture for a reader who cannot see it`);
    }
  }
  assert.ok(seen.size >= 14, `most of the library is reachable from real chapter titles (saw ${seen.size})`);
});

test('a figure in a chapter carries the slide words; a concept picture, which always fits, does not', () => {
  const all = visuals();
  const graphics = chapterGraphics('Water Harvesting', '', all, all.charts.filter(chart => chart.id === 'water-budget'));
  assert.equal(graphics.find(graphic => graphic.id === 'figure-water-budget')?.slideHint, 'Slide to see more');
  assert.equal(graphics.find(graphic => graphic.id === 'art-roof-to-tank')?.slideHint, undefined);
});

// ── the picture files themselves ────────────────────────────────────────────────────────────────
/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(bytes: Buffer): [number, number] {
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) { at += 1; continue; }
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error('no JPEG frame header');
}

test('every concept picture the report may show is in the repository at the size the page reserves for it', () => {
  assert.equal(REPORT_ART_READY.size, 16);
  for (const id of REPORT_ART_READY) {
    const file = new URL(`../public${reportArtSrc(id)}`, import.meta.url);
    assert.ok(existsSync(file), `${id}: public${reportArtSrc(id)} exists`);
    const bytes = readFileSync(file);
    assert.deepEqual(jpegSize(bytes), REPORT_ART_SIZE[id], `${id}: REPORT_ART_SIZE matches the file`);
    assert.ok(bytes.length < 450_000, `${id}: ${bytes.length} bytes — small enough to cache for offline reading`);
  }
  assert.deepEqual(Object.keys(REPORT_ART_SIZE).sort(), [...REPORT_ART_READY].sort());
});

test('the offline cache keeps the concept pictures, so a saved report still shows them without signal', () => {
  const worker = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  assert.match(worker, /report-art/);
});
