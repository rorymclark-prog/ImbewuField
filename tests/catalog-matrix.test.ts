import test from 'node:test';
import assert from 'node:assert/strict';

// ── Catalog element matrix audit ────────────────────────────────────────────────────────────
//
// docs/ACTIVE-MAP-QUALITY-TASKS.md (~line 222): "Deep-audit every catalog element across editor
// step, layer toggle, foreground/context sheet, prompt vocabulary, label and legend. Enforce the
// matrix in tests." This repo's own documented recurring bug (5+ historical instances, see the
// adversarial-review comments in lib/glossy-filters.ts and lib/design-elements.ts) is exactly
// that these SIX independent systems drift apart:
//
//   1. WIZARD STEP     — which step places/edits an element (CATEGORY_STEP + alsoSteps,
//                         lib/design-elements.ts; enforced by ownedByCurrentStep,
//                         lib/glossy-filters.ts).
//   2. LAYER TOGGLE     — which activeLayers switch shows/hides it (categoryLayerKey,
//                         components/design/DesignCanvas.tsx).
//   3. OUTPUT SHEET      — which printed/rendered sheet it counts as content on (sheetForElement /
//                         SHEET_OVERRIDE / itemInFilter, lib/glossy-filters.ts).
//   4. AI PROMPT VOCABULARY — whether the two illustrated AI render paths (buildShowcasePrompt's
//                         M/SHOWCASE_MARKER_MATCH and buildSatelliteOverlayPrompt's
//                         OVERLAY_ICONS/ICON_MATCH, both lib/producer-prompt.ts) know how to draw
//                         it.
//   5. LABEL             — whether it gets an on-map burned label (producerLabels,
//                         lib/producer-labels.ts).
//   6. LEGEND            — whether it appears in its sheet's legend, and whether that legend
//                         groups it under a named section (sheetLegendRows,
//                         components/design/DesignGlossy.tsx, plus the
//                         water-/planting-/structures-cartography.ts section-lookup helpers).
//
// FILE-OWNERSHIP / IMPORT-SAFETY BOUNDARY — read this before extending this file:
//
//   - lib/producer-prompt.ts is Codex's file (do not edit — see docs/COORDINATION.md). Every
//     assertion below that touches AI vocabulary calls its EXPORTED functions
//     (buildShowcasePrompt / buildSatelliteOverlayPrompt) and inspects their OUTPUT TEXT. It never
//     imports or duplicates the private OVERLAY_ICONS/ICON_MATCH/M/SHOWCASE_MARKER_MATCH tables —
//     duplicating a private regex table outside its single-authority file is exactly the kind of
//     second copy that drifts, which is the bug this whole test file exists to prevent.
//
//   - components/design/DesignCanvas.tsx and components/design/DesignGlossy.tsx are large
//     'use client' React components with JSX. Node's native TypeScript loader (this test suite's
//     `node --import ./tests/register-alias.mjs --test`) strips TYPES but cannot transform JSX, so
//     neither file can be safely imported here — attempting it is a known way to sink hours
//     chasing a loader error for no test coverage. Two systems live in those files:
//
//       * System 2 (LAYER TOGGLE): categoryLayerKey (DesignCanvas.tsx, read at commit time —
//         search "function categoryLayerKey" — currently lines 170-185) is a plain, exhaustive
//         `switch (category)` with NO default case, over the same closed ElementCategory union
//         `lib/design-elements.ts` defines — an unhandled category is a COMPILE ERROR there, not a
//         silent fallthrough. CATEGORY_LAYER_KEY below hand-mirrors it; `npx tsc --noEmit` on the
//         real file is what keeps the mirror honest, and this file's own header comment is the
//         second guard — anyone changing categoryLayerKey's mapping must update this constant too.
//       * System 6's SHEET === 'all' (whole-design masterplan) legend grouping lives in
//         `sheetLegendRows`'s `summaries` array (DesignGlossy.tsx, ~lines 6697-6727) and is NOT
//         exercised dynamically here for the reason above. Reading it by hand (2026-07-27) found
//         three earthworks elements — keyhole_bed, herb_spiral, half_moon — whose circular
//         footprint and non-matching name fall through every one of its six regex/shape buckets,
//         so they get no summarised legend row on the FINAL MASTERPLAN sheet specifically (they
//         are still drawn on the map, still labelled, and still legended correctly on their own
//         Planting/Water layer sheet — see the per-sheet LEGEND tests below, which ARE exercised
//         dynamically). Recorded here and in docs/CATALOG-MATRIX-2026-07-27.md's Gaps section
//         because it cannot be asserted without importing the forbidden file.
//
// Every other system below is asserted against the REAL exported function it names, over the
// WHOLE catalog, so any future drift — a new element with no vocabulary, a category that stops
// resolving to a layer key, a SHEET_OVERRIDE that silently spreads — fails a test here.

import { ELEMENT_CATALOG, CATEGORY_STEP, type ElementCategory } from '../lib/design-elements.ts';
import {
  sheetForElement,
  sheetsForElement,
  itemInFilter,
  ownedByCurrentStep,
} from '../lib/glossy-filters.ts';
import { producerLabels } from '../lib/producer-labels.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import {
  buildShowcasePrompt,
  buildSatelliteOverlayPrompt,
  type ShowcaseSheetKind,
} from '../lib/producer-prompt.ts';
import { waterLegendSectionForFeature } from '../lib/water-cartography.ts';
import { plantingLegendSectionForFeature } from '../lib/planting-cartography.ts';
import { structuresLegendSectionForFeature } from '../lib/structures-cartography.ts';

type LayerSheet = 'water' | 'planting' | 'structures';
const WIZARD_STEPS = ['water', 'planting', 'structures'] as const;
const NON_ITEM_STEPS = ['base', 'sector', 'zones', 'review', 'glossy'] as const;

// Mirrors components/design/DesignCanvas.tsx's categoryLayerKey (read-only — see header comment).
const CATEGORY_LAYER_KEY: Record<ElementCategory, string> = {
  water: 'water',
  earthworks: 'earthworks',
  growing: 'planting',
  structure: 'structures',
  animal: 'animals',
  access: 'access',
};

// ── Shared fixtures/helpers ─────────────────────────────────────────────────────────────────

const FRAME_W = 2224;
const FRAME_H = 1488;
const REF_LAYERS = { boundary: [[0, 0], [1, 0], [1, 1], [0, 1]] as Array<[number, number]>, house: [], driveway: [] };

function singleItemState(defId: string): DesignCanvasState {
  return {
    siteId: 'catalog-matrix-fixture',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.1 },
    items: [{ id: 'i1', defId, x: 0.5, y: 0.5 }],
    zones: [],
    lines: [],
    step: 'review',
    updatedAt: '2026-07-27T00:00:00.000Z',
  };
}

/** System 5 — does this element earn its own producerLabels row on its primary sheet? */
function hasLabel(id: string, name: string, sheet: LayerSheet): boolean {
  const out = producerLabels(singleItemState(id), REF_LAYERS, FRAME_W, FRAME_H, sheet, false);
  return out.some((l) => l.text === name.toUpperCase());
}

/** System 4a — buildShowcasePrompt's marker glossary (M / SHOWCASE_MARKER_MATCH), tested on the
 *  element's own bare catalog name in isolation (the worst case: a sheet containing only this one
 *  element). Reads the "Marker glossary for this sheet only: …" line the function itself prints. */
function showcaseVocabCovered(name: string, sheet: LayerSheet): boolean {
  const text = buildShowcasePrompt('Catalog Matrix Test', 'precision_atlas', name, '', sheet as ShowcaseSheetKind);
  const line = text.split('\n').find((l) => l.includes('Marker glossary for this sheet only:'));
  return !!line && !line.includes('no additional marker types');
}

/** System 4b — buildSatelliteOverlayPrompt's icon language (OVERLAY_ICONS / ICON_MATCH), same
 *  isolation strategy. Detects the covered/uncovered branch by the presence of the ": " that only
 *  the non-empty iconSpec branch emits after "ICON LANGUAGE … shading". */
function overlayVocabCovered(name: string, sheet: LayerSheet): boolean {
  const text = buildSatelliteOverlayPrompt({
    layerLabel: 'Catalog Matrix Test',
    stylePreset: 'satellite_overlay',
    elementsText: name,
    sheetKind: sheet as ShowcaseSheetKind,
  });
  return text.includes('ICON LANGUAGE') && / shading: /.test(text);
}

/** System 6b — the named legend SECTION a layer sheet's deterministic legend groups this element
 *  under (water-/planting-/structures-cartography.ts), or null when it falls through ungrouped —
 *  it still gets a legend row (see the LEGEND PRESENCE test below), just no section heading. */
function legendSection(id: string, sheet: LayerSheet): string | null {
  if (sheet === 'water') return waterLegendSectionForFeature(id);
  if (sheet === 'planting') return plantingLegendSectionForFeature(id);
  return structuresLegendSectionForFeature(id);
}

const CATALOG = ELEMENT_CATALOG; // include deprecated ids too — old saved maps still render them

// ── System 1: WIZARD STEP ───────────────────────────────────────────────────────────────────

test('WIZARD STEP: ownedByCurrentStep matches CATEGORY_STEP + alsoSteps exactly, for every catalog element and every step', () => {
  const mismatches: string[] = [];
  for (const def of CATALOG) {
    const owningSteps = new Set<string>([CATEGORY_STEP[def.category], ...(def.alsoSteps ?? [])]);
    for (const step of WIZARD_STEPS) {
      const expected = owningSteps.has(step);
      const actual = ownedByCurrentStep(step, { kind: 'item', category: def.category, defId: def.id });
      if (actual !== expected) mismatches.push(`${def.id} on step '${step}': expected ${expected}, got ${actual}`);
    }
    // Non-item wizard steps (base/sector/zones/review/glossy) never own a placed item — a shape
    // that falls through every branch of ownedByCurrentStep renders as foreign/locked, which is
    // the deliberately-safer reading (see that function's own doc comment).
    for (const step of NON_ITEM_STEPS) {
      const actual = ownedByCurrentStep(step, { kind: 'item', category: def.category, defId: def.id });
      if (actual !== false) mismatches.push(`${def.id} on non-item step '${step}': expected false, got ${actual}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

// KNOWN GAP: greywater_basin declares `alsoSteps: ['water']` (lib/design-elements.ts) but its
// category is 'earthworks', whose CATEGORY_STEP primary is ALREADY 'water' — ownedByCurrentStep
// returns true for it on the category check alone, before alsoSteps is ever consulted (see that
// function's own switch order). The declaration is inert: harmless, but it asserts nothing that
// wasn't already true. Encoded explicitly so a future CATEGORY_STEP change that actually needs
// this alsoSteps entry to do work doesn't silently keep passing on the old inert copy.
test('WIZARD STEP: greywater_basin\'s alsoSteps is a documented no-op — KNOWN GAP', () => {
  const def = CATALOG.find((d) => d.id === 'greywater_basin')!;
  assert.deepEqual(def.alsoSteps, ['water']);
  assert.equal(CATEGORY_STEP[def.category], 'water', 'the alsoSteps entry duplicates the already-true primary step');
});

// ── System 2: LAYER TOGGLE ──────────────────────────────────────────────────────────────────

test('LAYER TOGGLE: every catalog category resolves to a defined activeLayers key (mirrors DesignCanvas.tsx categoryLayerKey)', () => {
  const categories = new Set(CATALOG.map((d) => d.category));
  for (const category of categories) {
    assert.ok(CATEGORY_LAYER_KEY[category], `category '${category}' has no mirrored layer-toggle key`);
  }
});

// ── System 1 + 2 + 3 cross-check: the deliberate divergence ────────────────────────────────
//
// A raised bed, keyhole bed, herb spiral, banana circle and tree basin are category 'earthworks'
// (WIZARD STEP + LAYER TOGGLE = 'water', via CATEGORY_STEP/categoryLayerKey) but SHEET_OVERRIDE'd
// onto the Planting OUTPUT SHEET — a farmer places them from the Water step's palette but expects
// to find them printed where he plants, not where he dug (lib/design-elements.ts's own comment on
// CATEGORY_STEP). This is DESIGNED behaviour, twice adversarially reviewed (2026-07-21) after an
// earlier version conflated "which step placed it" with "which sheet it prints on" and locked
// these five elements the instant they were placed — step, layer toggle and output sheet all
// three disagree for this group.
//
// The Earthworks sheet split (05, docs/PLAN-SET-SPEC.md) added a SECOND, differently-shaped
// divergence: half_moon, berm and terrace are also category 'earthworks' (step = Water) but their
// OUTPUT SHEET is now the new 'earthworks' sheet — the same answer as their LAYER TOGGLE. Unlike
// the five SHEET_OVERRIDE beds, only their step disagrees; layer toggle and output sheet now
// agree with each other. Both groups still trip the same step-vs-sheet filter below, so this test
// locks in the WHOLE eight-element divergent set, split into its two distinct shapes, so a future
// change that collapses either group back to agreement — or blurs the difference between them —
// fails a test instead of shipping quietly.
test('eight elements diverge from their wizard step: five three-way (SHEET_OVERRIDE beds) and three step-only (Earthworks-native land-shaping)', () => {
  const divergent = CATALOG
    .filter((def) => CATEGORY_STEP[def.category] !== sheetForElement(def.category, def.id))
    .map((def) => def.id)
    .sort();
  assert.deepEqual(divergent, ['banana_circle', 'berm', 'half_moon', 'herb_spiral', 'keyhole_bed', 'raised_bed', 'terrace', 'tree_basin']);

  const SHEET_OVERRIDE_BEDS = ['banana_circle', 'herb_spiral', 'keyhole_bed', 'raised_bed', 'tree_basin'];
  const EARTHWORKS_NATIVE = ['berm', 'half_moon', 'terrace'];
  assert.deepEqual(
    [...SHEET_OVERRIDE_BEDS, ...EARTHWORKS_NATIVE].sort(),
    divergent,
    'the two groups must together account for every divergent element, with no third kind hiding in the count',
  );

  for (const id of SHEET_OVERRIDE_BEDS) {
    const def = CATALOG.find((d) => d.id === id)!;
    assert.equal(def.category, 'earthworks', `${id} should be category 'earthworks'`);
    assert.equal(CATEGORY_STEP[def.category], 'water', `${id} step should be Water`);
    assert.equal(CATEGORY_LAYER_KEY[def.category], 'earthworks', `${id} layer toggle should be Earthworks`);
    assert.equal(sheetForElement(def.category, id), 'planting', `${id} output sheet should be Planting`);
    assert.notEqual(
      CATEGORY_LAYER_KEY[def.category],
      sheetForElement(def.category, id),
      `${id} layer toggle and output sheet must ALSO disagree with each other — the three-way divergence`,
    );
  }
  for (const id of EARTHWORKS_NATIVE) {
    const def = CATALOG.find((d) => d.id === id)!;
    assert.equal(def.category, 'earthworks', `${id} should be category 'earthworks'`);
    assert.equal(CATEGORY_STEP[def.category], 'water', `${id} step should be Water`);
    assert.equal(CATEGORY_LAYER_KEY[def.category], 'earthworks', `${id} layer toggle should be Earthworks`);
    assert.equal(sheetForElement(def.category, id), 'earthworks', `${id} output sheet should be Earthworks`);
    assert.equal(
      CATEGORY_LAYER_KEY[def.category],
      sheetForElement(def.category, id),
      `${id} layer toggle and output sheet now AGREE — only the wizard step disagrees`,
    );
  }
});

// ── System 3: OUTPUT SHEET ──────────────────────────────────────────────────────────────────
//
// glossy-filters.test.ts already covers sheetForElement/itemInFilter in depth; this is the
// matrix's own completeness check, phrased as "system 3 has an answer for every element" so this
// file stands alone as the audit record.

test('OUTPUT SHEET: every catalog element has exactly one primary sheet, and sheetsForElement agrees', () => {
  for (const def of CATALOG) {
    const primary = sheetForElement(def.category, def.id);
    assert.ok(primary, `${def.id} (${def.category}) has no output sheet at all`);
    assert.equal(sheetsForElement(def.category, def.id)[0], primary, `${def.id} sheetsForElement primary mismatch`);
  }
});

// ── System 5: LABEL ──────────────────────────────────────────────────────────────────────────
//
// producerLabels buckets every placed item by `labelFamily` — an exhaustive `Record<LabelFamily,
// string>` over 'trees' + every ElementCategory — so label coverage is structurally universal.
// This test proves that behaviourally: EVERY catalog element, placed alone, earns its own on-map
// label spelling its exact catalog name. No known gaps.

test('LABEL: every catalog element earns a producerLabels row on its own primary sheet', () => {
  const missing: string[] = [];
  for (const def of CATALOG) {
    const sheet = sheetForElement(def.category, def.id) as LayerSheet;
    if (!hasLabel(def.id, def.name, sheet)) missing.push(`${def.id} (${def.name}) on ${sheet}`);
  }
  assert.deepEqual(missing, []);
});

// ── System 6a: LEGEND PRESENCE ──────────────────────────────────────────────────────────────
//
// sheetLegendRows' per-layer-sheet branch (components/design/DesignGlossy.tsx, non-'all' filter)
// pushes a legend row for every item that passes `itemInFilter(def.category, filter, def.id)` —
// unconditionally, whether or not a named section is found for it (see System 6b below). That
// gate is exactly itemInFilter, already exercised end-to-end by System 3 above, so legend
// PRESENCE on the primary sheet is structurally guaranteed by "every element has a primary sheet"
// — asserted here as its own named system so the matrix documents the connection explicitly
// rather than leaving a reader to infer it.

test('LEGEND presence: every catalog element passes the same itemInFilter gate sheetLegendRows uses on its own sheet', () => {
  for (const def of CATALOG) {
    const sheet = sheetForElement(def.category, def.id) as LayerSheet;
    assert.ok(itemInFilter(def.category, sheet, def.id), `${def.id} would not appear in its own sheet's legend`);
  }
});

// ── System 6b: LEGEND SECTION GROUPING ──────────────────────────────────────────────────────
//
// FIXED (was "Minor — Gap 4" in docs/CATALOG-MATRIX-2026-07-27.md): structuresLegendSectionForFeature
// (lib/structures-cartography.ts) used to only name a section for 8 curated "special visual
// treatment" ids; every other structures/animal/access element still got a legend row (System 6a
// above) but with NO section heading, so it listed above the grouped rows instead of under SITE
// ACCESS & SERVICE / COMPOST & NURSERY / LIVESTOCK & APIARY / PROTECTED GROWING.
// structuresLegendSectionForFeature now has its own independent, catalog-ID-keyed section registry
// (decoupled from the narrower FEATURE_VISUALS symbol/scale map that used to double as its only
// source), matching waterLegendSectionForFeature / plantingLegendSectionForFeature's idiom — every
// Water, Planting AND Structures element now gets a named legend section.
//
// The Earthworks sheet split moved half_moon, berm and terrace off Water onto the new 'earthworks'
// output sheet (lib/glossy-filters.ts's sheetForElement). There is no earthworks-cartography.ts
// section registry (this system is explicitly scoped to water/planting/structures, per its own
// name), so those three are out of scope here rather than silently ungrouped — System 6a's LEGEND
// PRESENCE test above still guarantees they get a legend row on their own Earthworks sheet.

test('LEGEND section grouping: water, planting and structures each section every element', () => {
  const ungroupedByOutputSheet: Record<LayerSheet, string[]> = { water: [], planting: [], structures: [] };
  for (const def of CATALOG) {
    const sheet = sheetForElement(def.category, def.id);
    if (sheet !== 'water' && sheet !== 'planting' && sheet !== 'structures') continue; // Earthworks: out of this system's scope, see comment above
    if (legendSection(def.id, sheet) === null) ungroupedByOutputSheet[sheet].push(def.id);
  }
  assert.deepEqual(ungroupedByOutputSheet.water, [], 'every Water element should have a named legend section');
  assert.deepEqual(ungroupedByOutputSheet.planting, [], 'every Planting element should have a named legend section');
  assert.deepEqual(ungroupedByOutputSheet.structures, [], 'every Structures element should have a named legend section');
});

// ── System 4: AI PROMPT VOCABULARY ──────────────────────────────────────────────────────────
//
// Two independent illustrated AI paths, two independent private vocabularies. Both are tested
// through their PUBLIC exported prompt builders only (see the file-ownership header comment).
//
// This used to pin the documented gaps. It now pins the stronger rule the list was measuring:
// every farmer-reachable catalog element must emit tailored vocabulary on its own primary sheet.
const SHOWCASE_VOCAB_GAP_IDS: string[] = [];

test('AI PROMPT VOCABULARY (Showcase family): exactly the documented ids have no marker glossary entry', () => {
  const gaps: string[] = [];
  for (const def of CATALOG) {
    if (def.deprecated) continue; // hidden from new placement; not farmer-reachable going forward
    const sheet = sheetForElement(def.category, def.id) as LayerSheet;
    if (!showcaseVocabCovered(def.name, sheet)) gaps.push(def.id);
  }
  assert.deepEqual(gaps.sort(), SHOWCASE_VOCAB_GAP_IDS);
});

// Same complete-coverage rule for the independently maintained Satellite Overlay vocabulary.
const OVERLAY_VOCAB_GAP_IDS: string[] = [];

test('AI PROMPT VOCABULARY (Satellite Overlay): exactly the documented ids have no icon-language entry', () => {
  const gaps: string[] = [];
  for (const def of CATALOG) {
    if (def.deprecated) continue;
    const sheet = sheetForElement(def.category, def.id) as LayerSheet;
    if (!overlayVocabCovered(def.name, sheet)) gaps.push(def.id);
  }
  assert.deepEqual(gaps.sort(), OVERLAY_VOCAB_GAP_IDS);
});

// The severe subset remains explicit so a later drift in both tables cannot hide behind two
// independently updated gap arrays.
test('AI PROMPT VOCABULARY: no catalog element has zero vocabulary in both illustrated AI paths', () => {
  const both = SHOWCASE_VOCAB_GAP_IDS.filter((id) => OVERLAY_VOCAB_GAP_IDS.includes(id)).sort();
  assert.deepEqual(both, []);
});
