import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// A FIX NOBODY RECEIVES IS NOT A FIX.
//
// 12 August. The biome was corrected to come from SANBI's national vegetation map instead of a
// lat/lon rectangle, tested, merged, deployed — and Rory opened the app: "On the main app it still
// says this", with Ubhejane still reading Indian Ocean Coastal Belt.
//
// Nothing was wrong with the fix. app/farmer/page.tsx caches each analysed site's location-data in
// localStorage under `imbewu_loc_v<N>_{lat}_{lon}` and returns the cached copy before it will call
// the API again. Every farmer who had already analysed their farm kept the old answer, forever.
//
// The instruction was already written at the call site — "bump when the location-data shape gains
// a field ... so already-analysed sites refetch instead of serving a stale pre-field cache" — and
// I read it, and shipped without bumping, because what changed was the VALUE rather than the
// shape. That distinction is invisible to a farmer and invisible to the cache. The rule is: if the
// endpoint would now answer differently, bump.
//
// FIVE FILES, ONE VERSION. Bumping only the writers is worse than bumping nothing: the readers go
// looking for a key that is never written again, and the sector card and tank calculator quietly
// lose their data instead of showing stale data.

const FILES = [
  '../app/farmer/page.tsx',        // writes
  '../app/design/page.tsx',        // writes
  '../components/design/SectorSummary.tsx', // reads
  '../components/design/TankCalculator.tsx', // reads
  '../lib/site-climate.ts',        // reads AND writes — the crop planner's per-site RainPattern
] as const;

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('every reader and writer of the location cache is on the same version', () => {
  const versions = new Map<string, Set<string>>();
  for (const rel of FILES) {
    const found = new Set<string>();
    for (const m of source(rel).matchAll(/imbewu_loc_v(\d+)_/g)) found.add(m[1]);
    assert.ok(found.size > 0, `${rel} no longer references the location cache at all`);
    assert.equal(found.size, 1, `${rel} mentions more than one cache version: ${[...found].join(', ')}`);
    versions.set(rel, found);
  }
  const all = new Set([...versions.values()].flatMap((s) => [...s]));
  assert.equal(
    all.size, 1,
    `the location cache version has drifted apart: ${[...versions].map(([f, v]) => `${f}=v${[...v][0]}`).join(', ')}`,
  );
});

test('the version is at least v4 — the SANBI biome change required it', () => {
  // A floor rather than an exact match, so a future bump does not fail this file. What it stops is
  // someone reverting to a version that predates a correction farmers have already been promised.
  const [version] = [...source(FILES[0]).matchAll(/imbewu_loc_v(\d+)_/g)].map((m) => Number(m[1]));
  assert.ok(version >= 4, `location cache is at v${version}; the SANBI biome fix needs v4 or later`);
});

test('the reason to bump is written down where the bump happens', () => {
  // The note at the call site is what should have stopped this, so it now says that a changed
  // ANSWER counts, not only a changed shape.
  const farmer = source(FILES[0]);
  const at = farmer.indexOf('imbewu_loc_v');
  const note = farmer.slice(Math.max(0, at - 1400), at);
  assert.match(note, /bump/i, 'the bump instruction has gone missing from the call site');
  assert.match(note, /biomeSource|SANBI/,
    'the v4 reason should be recorded here, so the next person sees what counts as a reason');
});
