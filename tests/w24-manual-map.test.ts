import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// w24-09: Lima launcher covered "Next" and the credit at the end of a manual chapter (phone).
test('w24-09: chapter page keeps its end clear of the Lima launcher', () => {
  const page = source('../app/manual/[lang]/[slug]/page.tsx');
  const main = page.match(/<main [^>]*>/)?.[0] ?? '';
  assert.match(main, /paddingBottom: 'max\(64px, var\(--lima-fab-clearance, 0px\)\)'/);
  assert.ok(page.indexOf('<main') < page.indexOf('ui.credit') && page.indexOf('ui.credit') < page.indexOf('</main>'),
    'the credit line must sit inside the padded <main>');
});

// w24-10: without a token the mapbox:// style makes the Map constructor throw half-built.
test('w24-10: a missing Mapbox token never mounts a mapbox:// style', () => {
  const map = source('../components/Map.tsx');
  assert.match(map, /const offlineCanvas=!connected\|\|canvasOnly\|\|!TOKEN;/);
  assert.match(map, /mapStyle=\{offlineCanvas \? OFFLINE_MAP_STYLE : `mapbox:\/\/styles/);
});
