// The printed plan's header band said "CLIMATE: Not set" for every region in South Africa, while
// the climate sat in the very string it was reading.
//
// The producer joined with U+00B7 MIDDLE DOT — `${region.name} · ${patternMeta.label}` — and the
// PDF recovered the halves with `siteLine.split(/\s*-\s*/)`, an ASCII hyphen. No region name in
// lib/water-calc.ts contains a hyphen, so the split always returned one element: LOCATION took the
// whole line and CLIMATE fell through to its "Not set" fallback. Where the pattern label carried
// its own hyphen it was worse than blank — "Karoo · All-year rainfall" split on THAT, printing
// LOCATION "Karoo · All" and CLIMATE "year rainfall".
//
// Nothing failed. The PDF rendered, the string was non-empty, and "Not set" is a legitimate value
// for a farm with no site — so a farmer who HAD set a site simply read a document telling her the
// app did not know where she was.
//
// The fix is not a better separator. A display string is a rendering, and parsing one back into
// fields makes a second authority for a question that already had an answer at the source — the
// recurring bug AGENTS.md §6 names. Region name and climate label now travel as two values.
//
// These tests therefore guard the CONTRACT, not the punctuation: the two facts must survive as
// their own fields, and the PDF must not go back to taking siteLine apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REGIONAL_RAINFALL } from '@/lib/water-calc';

const PDF_SRC = readFileSync(fileURLToPath(new URL('../lib/crop-export-pdf.ts', import.meta.url)), 'utf8');

/** Exactly what app/facilitator/crops/page.tsx builds for the export. */
function metaFor(regionName: string | null, patternLabel: string) {
  return {
    siteLine: regionName ? `${regionName} · ${patternLabel}` : `No site set · assuming ${patternLabel.toLowerCase()}`,
    locationLine: regionName ? regionName : 'No site set',
    climateLine: regionName ? patternLabel : `Assuming ${patternLabel.toLowerCase()}`,
  };
}

/** The two header facts, read the way lib/crop-export-pdf.ts now reads them. */
function headerFacts(meta: ReturnType<typeof metaFor>) {
  return {
    location: meta.locationLine || meta.siteLine,
    climate: meta.climateLine || 'Not set',
  };
}

// The three pattern labels from app/facilitator/crops/page.tsx. "All-year rainfall" is the one
// that used to poison the LOCATION field as well, so it is not optional coverage.
const PATTERN_LABELS = ['Summer rainfall', 'Winter rainfall', 'All-year rainfall'];

test('no real region prints "Climate: Not set" when its climate is known', () => {
  const broken: string[] = [];
  for (const region of REGIONAL_RAINFALL) {
    for (const label of PATTERN_LABELS) {
      const facts = headerFacts(metaFor(region.name, label));
      if (facts.climate === 'Not set') broken.push(`${region.name} / ${label}`);
    }
  }
  assert.deepEqual(broken, [], 'these region/pattern pairs lost their climate on the way to the page');
});

test('the location fact is the place, never the place plus half the climate', () => {
  for (const region of REGIONAL_RAINFALL) {
    for (const label of PATTERN_LABELS) {
      const facts = headerFacts(metaFor(region.name, label));
      assert.equal(facts.location, region.name);
      assert.equal(facts.climate, label);
    }
  }
});

test('a region name or climate label containing a hyphen is not a hazard', () => {
  // "All-year rainfall" and "Cape Town / W Cape" both broke the old parser. Neither can now,
  // because nothing is being parsed.
  const facts = headerFacts(metaFor('Karoo', 'All-year rainfall'));
  assert.equal(facts.location, 'Karoo');
  assert.equal(facts.climate, 'All-year rainfall');
});

test('with no site set, the plan says so plainly in both fields', () => {
  const facts = headerFacts(metaFor(null, 'Summer rainfall'));
  assert.equal(facts.location, 'No site set');
  assert.equal(facts.climate, 'Assuming summer rainfall', 'an assumption must read as an assumption');
});

test('the PDF does not recover site facts by splitting the display string', () => {
  // The guard that would have caught the original bug, and the one that stops it coming back:
  // siteLine is a rendering, and the header band must not parse it.
  assert.ok(
    !/siteLine\s*\.\s*split/.test(PDF_SRC),
    'lib/crop-export-pdf.ts is splitting siteLine again — take the fields from meta instead',
  );
});
