import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// design-03: SpeciesPicker.tsx (the Planting step's "Plant Catalog") already called t() for its
// close button, but the header, the biome-filtered/broad-reach note, the honesty banner, the size
// line and the use-tag chips were literal English with no t() call at all. Guard the fix: chrome
// text goes through t()/translatedSpeciesSection/translatedSpeciesUse, while plant common and
// botanical names (per-species data, not app chrome) stay untouched.

const SOURCE = readFileSync(new URL('../components/design/SpeciesPicker.tsx', import.meta.url), 'utf8');

test('SpeciesPicker chrome is translated, not hard-coded English', () => {
  assert.match(SOURCE, /\buseLanguage\(\)/, 'SpeciesPicker must read the active language context');
  assert.match(SOURCE, /t\('designSpeciesPickerTitle'\)/, 'the "Plant Catalog" header must be translated');
  assert.match(SOURCE, /t\('designSpeciesFilteredForBiome'\)/, 'the "Filtered for X biome" note must be translated');
  assert.match(SOURCE, /t\('designSpeciesBroadReach'\)/, 'the "Showing broad-reach species" note must be translated');
  assert.match(SOURCE, /t\('designSpeciesBroadReachSection'\)/, 'the broad-reach section heading must be translated');
  assert.match(SOURCE, /t\('designSpeciesReviewNote'\)/, 'the agronomist-review honesty banner must be translated');
  assert.match(SOURCE, /t\('designSpeciesFrostHidden'\)/, 'the frost-hidden note must be translated');
  assert.match(SOURCE, /translatedSpeciesSection\(t, sec\.section\)/, 'section names must resolve through translatedSpeciesSection');
  assert.match(SOURCE, /translatedSpeciesUse\(t, u\)/, 'use tags must resolve through translatedSpeciesUse');
  assert.match(SOURCE, /formatDesignTranslation\(t\('designSpeciesSize'\)/, 'the "m h × m w" size line must be a translated, interpolated template');

  // The defect this guards against: these exact hard-coded English literals.
  assert.doesNotMatch(SOURCE, /<h3[^>]*>Plant Catalog<\/h3>/, 'header regressed to hard-coded English');
  assert.doesNotMatch(SOURCE, /Filtered for \$\{siteBiomeName\} biome/, 'biome-filtered note regressed to a raw template literal');
  assert.doesNotMatch(SOURCE, /'Showing broad-reach species'/, 'broad-reach note regressed to a hard-coded string outside t()');
  assert.doesNotMatch(SOURCE, /Not yet agronomist-reviewed\. Use as a starting point\./, 'honesty banner regressed to hard-coded English');
  assert.doesNotMatch(SOURCE, /\{s\.matureHeightM\}m h × \{s\.matureWidthM\}m w/, 'size line regressed to a raw template literal');
});

test('plant common and botanical names stay as species data, not translated chrome', () => {
  // Names are per-species facts (lib/species-palette.ts), not app chrome — inventing a botanical
  // translation would be worse than showing the English/scientific name. No SPECIES record
  // currently carries an isiZulu common name field, so there is nothing to switch on yet.
  assert.match(SOURCE, /\{s\.commonName\}/, 'common name must still render straight from species data');
  assert.match(SOURCE, /\{s\.botanicalName\}/, 'botanical name must still render straight from species data');
  assert.doesNotMatch(SOURCE, /t\(s\.commonName\)/, 'common name must not be routed through the UI translator');
});
