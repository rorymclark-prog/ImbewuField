import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// This file guards a single defect class across several screens: a failed READ that renders
// exactly like a genuinely empty or genuinely zero result, offline or on a weak signal — the
// worst version of the "loading/empty/offline/error" states this app has to get right, because a
// farmer or facilitator cannot tell "there is nothing here" from "we could not check". Each test
// below reads the real shipped source so it fails again if the fix is ever reverted or rewritten
// away, and two exercise the actual fetch call to prove the request can no longer hang forever.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('a stalled sheet image decode exits with an error instead of freezing exact lock forever', () => {
  const glossy = source('../components/design/DesignGlossy.tsx');
  const start = glossy.indexOf('function loadImage(src: string)');
  const end = glossy.indexOf('\n}\n', start);
  const loader = glossy.slice(start, end);
  assert.ok(start > 0, 'the shared sheet image loader disappeared');
  assert.match(glossy, /const RENDER_IMAGE_WAIT_MS = 20_000;/,
    'sheet image decoding is unbounded again');
  assert.match(loader, /window\.setTimeout\(/,
    'the loader has no deadline, so Safari can leave Step 1 open forever');
  assert.match(loader, /finish\('timeout'\)/,
    'the deadline does not reject the same Promise the exact renderer awaits');
  assert.match(loader, /img\.onload = null;[\s\S]*img\.onerror = null;/,
    'a timed-out decode keeps its handlers and can settle the render twice');
});

test('a failed replies read on the contact screen says so and offers Retry, instead of looking like no replies', () => {
  const page = source('../app/contact/page.tsx');
  assert.match(page, /const \[repliesError, setRepliesError\] = useState/,
    'the contact screen must track a distinct failed-read state, not just an empty replies array');
  assert.match(page, /setRepliesError\(true\)/,
    'a rejected contact_replies read must flip the error state, not disappear into an empty catch');
  assert.match(page, /\{repliesError && \(/, 'a failed read must render a banner');
  assert.match(page, /onClick=\{loadReplies\}/,
    'the failure banner must offer a way to retry the same read, not just an apology');
});

test('a failed photo-analysis call on the design panel keeps the sheet open and says so, instead of opening a report that analysed nothing', () => {
  const panel = source('../components/DataPanel.tsx');
  assert.match(panel, /const \[promptError, setPromptError\] = useState/,
    'DataPanel must track that the analyse call itself failed, separate from promptSkipped');
  // The regression this guards: the catch block used to call setPhotoPromptOpen(false) and
  // onOpenReport(photoAnalysis) on failure — closing the sheet and opening a report as if the
  // photos had been read, with no error and no analysis behind it.
  assert.match(panel, /setPromptError\(true\)/, 'a failed analyse-photos call must set the error state');
  assert.match(panel, /\{promptError && \(/, 'a failed analyse-photos call must render an error message on the sheet');
  assert.match(panel, /t\('photoAnalyseError'\)/, 'the error message must come from i18n, not an inline string');

  const i18n = source('../lib/i18n.tsx');
  assert.match(i18n, /photoAnalyseError:/, 'photoAnalyseError must exist in the translation dictionary DataPanel reads');
});

test('My Records surfaces a failed read instead of quietly showing an empty ledger', () => {
  const records = source('../components/MyRecords.tsx');
  // Promise.all previously meant one rejected read (e.g. production_logs offline) threw before
  // setProduction/setSales/setDesigns ran at all, blanking every list even when only one source
  // had actually failed.
  assert.doesNotMatch(records, /const \[prod, saleRows, des\] = await Promise\.all\(/,
    'loadData must not go back to Promise.all, where one failed read blanks every list');
  assert.match(records, /await Promise\.allSettled\(\[/,
    'loadData must let each of production/sales/designs degrade independently');
  assert.match(records, /const \[loadError, setLoadError\] = useState/,
    'a failed read must be tracked separately from a genuinely empty list');
  assert.match(records, /\{loadError && !dataLoading && \(/, 'a failed read must render a banner once loading settles');
  assert.match(records, /onClick=\{\(\) => \{ void loadData\(\); \}\}/,
    'the failure banner must retry the same load, not just apologise');

  const i18n = source('../lib/i18n.tsx');
  assert.match(i18n, /myRecordsLoadError:/);
  assert.match(i18n, /myRecordsRetry:/);
});

test('a facilitator who opens a gardener whose full profile fails to load sees an error, not a false zero', () => {
  const dashboard = source('../components/NgoDashboard.tsx');
  assert.match(dashboard, /const \[gardenerError, setGardenerError\] = useState/,
    'a failed gardener-detail read must be tracked, not just left as the skeleton shape');
  // The regression this guards: the catch block used to comment "keep the partial gardener shape
  // already set" — the mapDbGardener skeleton — which reads as verified real zeros (0kg produced,
  // 0% training) rather than "we could not check", for a decision a facilitator might act on.
  assert.match(dashboard, /setGardenerError\(true\)/, 'a failed full-profile read must set the error state');
  assert.match(dashboard, /gardenerError \? \(/, 'the gardener detail panel must branch on the error state before rendering the (possibly stale) skeleton figures');
});

test('fetchSoilData bounds its ISRIC request so one slow upstream cannot hang the whole location-data request forever', async () => {
  const { fetchSoilData } = await import('../lib/isric-soil.ts');
  const layer = (name: string, mean: number) => ({
    name,
    unit_measure: { d_factor: 10 },
    depths: [
      { label: '0-5cm', values: { mean } },
      { label: '5-15cm', values: { mean } },
      { label: '15-30cm', values: { mean } },
    ],
  });
  const payload = {
    properties: {
      layers: ['phh2o', 'soc', 'clay', 'sand', 'silt', 'bdod'].map((name) => layer(name, 65)),
    },
  };

  let capturedSignal: AbortSignal | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedSignal = init?.signal ?? undefined;
    return { ok: true, status: 200, json: async () => payload } as Response;
  }) as typeof fetch;
  try {
    await fetchSoilData(-27.7262, 31.9632);
  } finally {
    globalThis.fetch = original;
  }

  assert.ok(capturedSignal instanceof AbortSignal,
    'fetchSoilData must pass an abort signal — otherwise a hung ISRIC response hangs the Promise.allSettled in app/api/location-data/route.ts forever');
  assert.equal(capturedSignal?.aborted, false);
});

test('fetchVegetation bounds its SANBI request so one slow upstream cannot hang the whole location-data request forever', async () => {
  const { fetchVegetation } = await import('../lib/sanbi.ts');
  const payload = {
    results: [{ attributes: { Name_18: 'KwaZulu-Natal Coastal Belt Grassland', BIOME_18: 'Indian Ocean Coastal Belt', BIOREGION_: 'Maputaland Coastal Belt' } }],
  };

  let capturedSignal: AbortSignal | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedSignal = init?.signal ?? undefined;
    return { ok: true, status: 200, json: async () => payload } as Response;
  }) as typeof fetch;
  try {
    await fetchVegetation(-27.7262, 31.9632);
  } finally {
    globalThis.fetch = original;
  }

  assert.ok(capturedSignal instanceof AbortSignal,
    'fetchVegetation must pass an abort signal — otherwise a hung SANBI response hangs the Promise.allSettled in app/api/location-data/route.ts forever');
  assert.equal(capturedSignal?.aborted, false);
});
