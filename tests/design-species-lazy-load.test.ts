import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// lib/species-catalog.ts is 197 species / ~224KB, and DesignCanvas.tsx + DesignPalette.tsx are
// statically imported by app/design/page.tsx — so a plain top-level `import { SPECIES } from
// '@/lib/species-catalog'` in either file ships that whole catalogue to every farmer who opens
// /design, whether or not they ever open the species picker. Both real reads (placing a species
// in DesignCanvas's runTapAction, and reconciling shape on pick in DesignPalette's onSelect)
// only run inside a tap/click handler, so the catalogue is loaded there with a dynamic import
// instead. This guards the three places that fix can quietly regress: either file reverting to
// a static SPECIES import, or DesignPalette reverting SpeciesPicker (which carries its own
// top-level SPECIES import) to a plain static import — any one of the three re-inflates the
// bundle even if the other two stay fixed.

const canvasSrc = readFileSync(new URL('../components/design/DesignCanvas.tsx', import.meta.url), 'utf8');
const paletteSrc = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');

const staticSpeciesImport = /^import\s*\{[^}]*\bSPECIES\b[^}]*\}\s*from\s*['"]@\/lib\/species-catalog['"]/m;
const dynamicSpeciesImport = /\bawait\s+import\(\s*['"]@\/lib\/species-catalog['"]\s*\)/;

test('DesignCanvas.tsx does not statically import the species catalogue', () => {
  assert.doesNotMatch(
    canvasSrc,
    staticSpeciesImport,
    'a top-level SPECIES import ships all 197 species to every /design visit, not just the ones who place a species',
  );
  assert.match(
    canvasSrc,
    dynamicSpeciesImport,
    'the species catalogue must still be reachable via a dynamic import inside the tap handler that places an item',
  );
});

test('DesignPalette.tsx does not statically import the species catalogue', () => {
  assert.doesNotMatch(
    paletteSrc,
    staticSpeciesImport,
    'a top-level SPECIES import ships all 197 species to every /design visit, not just the ones who open the species picker',
  );
  assert.match(
    paletteSrc,
    dynamicSpeciesImport,
    'the species catalogue must still be reachable via a dynamic import inside the picker\'s onSelect handler',
  );
});

test('DesignPalette.tsx loads SpeciesPicker lazily, not as a static import', () => {
  // SpeciesPicker.tsx carries its own top-level `import { SPECIES } from '@/lib/species-catalog'`
  // (it needs the full list to render the picker's sections). A plain
  // `import SpeciesPicker from './SpeciesPicker'` here would drag that whole catalogue back into
  // this file's bundle regardless of how DesignPalette's own SPECIES reference is loaded.
  assert.doesNotMatch(
    paletteSrc,
    /^import\s+SpeciesPicker\s+from\s+['"]\.\/SpeciesPicker['"]/m,
    'SpeciesPicker must not be a static import — it transitively pulls in the full species catalogue',
  );
  assert.match(
    paletteSrc,
    /\bdynamic\(\s*\(\)\s*=>\s*import\(\s*['"]\.\/SpeciesPicker['"]\s*\)/,
    'SpeciesPicker must be loaded via next/dynamic so its own species-catalog import stays out of the initial /design bundle',
  );
});
