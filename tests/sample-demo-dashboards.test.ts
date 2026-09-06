// The empty demo that started this: the /partners page and the funder concept note both
// send people to "try the app" via sample mode — and the funders/NGO Gardens tab answered
// with a blank screen. Two independent breaks, both only on production:
//
//   1. /funder and /ngo bounced any user-less visitor to /login whenever a backend was
//      configured. Sample mode has no user BY DESIGN, and production always has a backend,
//      so the demo could never even reach the dashboard.
//   2. NgoDashboard only entered demo mode when getFirebase() returned null (backend
//      unconfigured — never true in production). In sample mode it fell through to
//      listGardens(), which answers [] in the sandbox, and rendered "confirmed empty".
//
// Neither break was visible in local dev without Firebase env vars, where !fb made
// everything demo. That is why this is pinned as source shape: the failing combination
// (backend configured + no user + sample flag) only exists on a real deployment.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/sample-demo-dashboards.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SAMPLE_GARDENS, SAMPLE_PARTICIPANTS } from '../lib/sample-gardens';
import { samplePortrait } from '../lib/sample-media';

const dash = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
const funder = readFileSync(new URL('../app/funder/page.tsx', import.meta.url), 'utf8');
const ngo = readFileSync(new URL('../app/ngo/page.tsx', import.meta.url), 'utf8');
const queries = readFileSync(new URL('../lib/db/queries.ts', import.meta.url), 'utf8');
const cohort = readFileSync(new URL('../components/funder/CohortDashboard.tsx', import.meta.url), 'utf8');

test('NgoDashboard enters demo mode in sample mode, not only when the backend is absent', () => {
  assert.match(dash, /import \{ isSampleMode \} from '@\/lib\/sample-mode';/);
  // The gardens fetch effect: sample mode takes the demo branch before any query runs.
  assert.match(dash, /if \(!fb \|\| isSampleMode\(\)\) \{\s*\n\s*setIsDemo\(true\);/);
  // And auth rehydration is skipped for the demo — nothing to wait for.
  assert.match(dash, /if \(!fb \|\| isSampleMode\(\)\) \{ setAuthReady\(true\); return; \}/);
});

test('one shared sample catalog feeds the dashboard; the live query layer stays empty', () => {
  // The catalog moved to a pure shared module so regional samples can be checked.
  // It still never populates a live Firestore query or creates a second dataset.
  assert.match(queries, /export async function listGardens\(\): Promise<Garden\[\]> \{\s*\n\s*if \(isSampleMode\(\)\) return \[\];/);
  assert.match(dash, /import \{ SAMPLE_GARDENS, SAMPLE_PARTICIPANTS \} from '@\/lib\/sample-gardens'/);
});

test('/funder and /ngo stay reachable in sample mode instead of bouncing to /login', () => {
  for (const [name, src] of [['funder', funder], ['ngo', ngo]] as const) {
    assert.match(src, /if \(!loading && !user && isLive && !isSampleMode\(\)\) router\.replace\('\/login'\);/,
      `${name}: the login bounce must exempt sample mode`);
  }
});

test('the gardens view is labeled "sample data" in sample mode, hydration-safely', () => {
  for (const [name, src] of [['funder', funder], ['ngo', ngo]] as const) {
    // Badge condition covers both demo causes. Scoped to the gardens view — the cohort
    // view labels itself from portfolio.isDemo, the more exact test for its own read.
    assert.match(src, /\{\(!isLive \|\| sample\) && view === 'gardens' && \(/,
      `${name}: badge must show for sample mode too`);
    // sessionStorage is client-only: the flag must reach render via state set in an
    // effect, never a bare isSampleMode() call in JSX, or hydration disagrees.
    assert.match(src, /const \[sample, setSample\] = useState\(false\);/, `${name}: hydration-safe state`);
    assert.match(src, /useEffect\(\(\) => \{ setSample\(isSampleMode\(\)\); \}, \[\]\);/, `${name}: set from effect`);
  }
});

test('the default cohort view demos off the absence of a user, which covers sample mode', () => {
  // useNetworkPortfolio(live=false) returns the demo portfolio with isDemo: true.
  // Sample mode never has a user, so Boolean(user) is the load-bearing expression:
  // change it to "backend configured" and the funder landing view goes blank in demos.
  assert.match(cohort, /useNetworkPortfolio\(Boolean\(user\)\)/);
});


test('the demo offers distinct garden settings and regional participant photos that exist', () => {
  assert.ok(SAMPLE_GARDENS.length >= 15);
  assert.equal(new Set(SAMPLE_GARDENS.map(g => g.id)).size, SAMPLE_GARDENS.length);
  assert.equal(new Set(SAMPLE_GARDENS.map(g => g.name)).size, SAMPLE_GARDENS.length);
  for (const kind of ['Homestead garden', 'Commercial garden', 'Crèche garden', 'School garden', 'Community garden']) {
    assert.ok(SAMPLE_GARDENS.some(g => g.kind === kind), `Missing ${kind}`);
  }
  const sotho = SAMPLE_GARDENS.filter(g => g.language === 'Sesotho');
  assert.ok(sotho.length >= 3);
  for (const garden of SAMPLE_GARDENS) {
    assert.ok(garden.areaM2 && garden.areaM2 > 0);
    assert.ok(Number.isFinite(garden.lat) && Number.isFinite(garden.lon));
    const people = SAMPLE_PARTICIPANTS[garden.language!];
    assert.ok(people?.length >= 4, garden.name);
    for (const person of people) assert.ok(existsSync(`public${samplePortrait(person)}`), person);
  }
});


import { sampleGardenSvg, sampleGardenImage } from '../lib/sample-garden-layout';
import { canSeeWorkspaceLink } from '../lib/role-navigation';

test('changing garden produces distinct geometry instead of the same shared aerial picture', () => {
  const pictures = SAMPLE_GARDENS.map(g => sampleGardenSvg(g.kind!, g.id));
  // Strip wording: changing a title on the same drawing is not a new garden layout.
  const geometry = pictures.map(svg => svg.replace(/<text[^>]*>.*?<\/text>/g, ''));
  assert.equal(new Set(geometry).size, SAMPLE_GARDENS.length);
  for (const [i,svg] of pictures.entries()) {
    assert.doesNotMatch(svg, /NaN|undefined/);
    assert.equal(decodeURIComponent(sampleGardenImage(SAMPLE_GARDENS[i].kind!, SAMPLE_GARDENS[i].id).split(',')[1]), svg);
    assert.match(svg, /Fictional layout/);
  }
});

test('farmers, mentors, funders and organisations can find the fictional garden gallery', () => {
  for (const role of ['farmer', 'mentor', 'funder', 'ngo', 'admin'] as const) {
    assert.equal(canSeeWorkspaceLink(role, '/samples/gardens'), true, role);
  }
  assert.equal(canSeeWorkspaceLink('funder', '/ngo'), false);
  assert.equal(canSeeWorkspaceLink('farmer', '/ngo'), false);
});

// Each demo site now has a distinct reference; changing a selection must change its media and areas.
import { sampleSitePhoto, sampleSitePhotos } from '../lib/sample-gardens';
import { freshSampleAreas, completeSampleAreas } from '../lib/sample-operations';
import { validProductionSite, productionAreaSummary } from '../lib/production-sites';
test('garden photos and production totals cover the same complete sample catalog', () => {
  const rows = freshSampleAreas();
  assert.deepEqual(rows.map(s=>s.code), SAMPLE_GARDENS.map(g=>g.id));
  assert.equal(new Set(SAMPLE_GARDENS.map(g=>sampleSitePhoto(g.id))).size,SAMPLE_GARDENS.length);
  for (const g of SAMPLE_GARDENS) {
    assert.ok(existsSync(new URL(`../public${sampleSitePhoto(g.id)}`,import.meta.url)));
    assert.match(sampleSitePhotos(g.id)[0].caption,/AI-generated fictional/);
    const site=rows.find(s=>s.code===g.id)!;
    assert.ok(validProductionSite(site,'2026-09-06'));
    assert.ok(site.vegetableM2+site.stapleM2 < g.areaM2!);
  }
  assert.equal(productionAreaSummary(rows).combinedM2,SAMPLE_GARDENS.reduce((n,g)=>n+g.production.vegetableM2+g.production.stapleM2,0));
  assert.equal(sampleSitePhoto('unknown'),undefined);
});
test('old sample sessions gain missing gardens without resetting edited areas or sharing',()=>{
  const edited={...freshSampleAreas()[0],vegetableM2:5,published:false};
  const migrated=completeSampleAreas([edited]);
  assert.equal(migrated.length,SAMPLE_GARDENS.length);
  assert.deepEqual(migrated.find(s=>s.code===edited.code),edited);
  assert.deepEqual(completeSampleAreas(migrated),migrated);
});

import { sampleGardenReportSections, sampleGardenReportUrl } from '../lib/sample-garden-reports';
test('every catalogue garden has its own complete prepared PDF and layout', () => {
  assert.equal(new Set(SAMPLE_GARDENS.map(g => sampleGardenReportUrl(g.id))).size, 18);
  for (const garden of SAMPLE_GARDENS) {
    const report = sampleGardenReportUrl(garden.id)!;
    const bytes = readFileSync(new URL(`../public${report}`, import.meta.url));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 10000, `${garden.id} has a populated report`);
    assert.ok(existsSync(new URL(`../public/demo/reports/${garden.id}-layout.png`, import.meta.url)));
    const sections = sampleGardenReportSections(garden);
    assert.equal(sections.length, 8);
    assert.ok(sections[0].lines.some(line => line.includes(garden.name)));
    assert.ok(sections[1].lines.some(line => line.includes(garden.production.vegetableM2.toLocaleString('en-ZA', { maximumFractionDigits: 1 }))));
    assert.ok(sections.every(s => s.lines.length >= 4));
  }
  assert.equal(sampleGardenReportUrl('missing-garden'), undefined);
});
