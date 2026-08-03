import test from 'node:test';
import assert from 'node:assert/strict';

import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import {
  overlayElementsText,
  type OverlayLegendContentGroup,
} from '../lib/overlay-elements.ts';
import { producerLabels } from '../lib/producer-labels.ts';
import {
  EXACT_CONTEXT_ALPHA,
  EXACT_DRIVEWAY_LEGEND_TEXT,
  EXACT_FULL_STRENGTH_ALPHA,
  INTEGRATED_LEGEND_FAMILIES,
  exactSheetElementLegendGroups,
  exactSheetElementRegister,
  exactSheetGroundLegendGroups,
  exactSheetLineLegendGroups,
  exactSheetLineRegister,
  exactSheetZoneLegendGroups,
  groundRegister,
  lineInFilter,
  type ExactPlanSheetKey,
  type GlossyLayerFilter,
} from '../lib/glossy-filters.ts';

const SHEETS: ExactPlanSheetKey[] = [
  'base',
  'sector',
  'zones',
  'water',
  'earthworks',
  'planting',
  'structures',
  'all',
  'implementation',
];

// Sheets the Satellite Overlay AI prompt actually covers. lib/overlay-elements.ts's own
// OVERLAY_FILTERS set was NOT touched by the Earthworks sheet split — its header comment already
// documented "the three exact sheets that never use Satellite Overlay" (base, sector,
// implementation) as a deliberate exclusion, and Earthworks is now a fourth: it prints
// deterministically today with no Satellite Overlay AI prompt inventory to agree with at all
// (DesignGlossy.tsx's own modelFilters list — the sheets queued for that style — excludes it too).
// Excluding it here is that same deliberate scoping, not a weaker check: the agreement test below
// still holds full strength for every sheet Satellite Overlay actually renders.
const SATELLITE_OVERLAY_SHEETS = SHEETS.filter((sheet) => sheet !== 'earthworks');

function allCatalogFixture(): DesignCanvasState {
  const base = buildDemoDesignCanvasState();
  const items: PlacedItem[] = ELEMENT_CATALOG.map((def, index) => ({
    id: `catalog-${def.id}`,
    defId: def.id,
    x: 0.08 + ((index * 7) % 84) / 100,
    y: 0.08 + ((index * 11) % 84) / 100,
  }));
  // A second instance makes count assertions exercise both the singular and ×N forms without
  // pinning a current catalog total.
  items.push({ ...items[0], id: `${items[0].id}-duplicate`, x: 0.5, y: 0.5 });
  return { ...base, items };
}

const FIXTURES = [
  { name: 'Ubhejane demo', state: buildDemoDesignCanvasState() },
  { name: 'complete catalog demo', state: allCatalogFixture() },
];

const PROMPT_REF_LAYERS = {
  boundary: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]] as Array<[number, number]>,
  house: [] as Array<[number, number]>,
  driveway: [[0.15, 0.75], [0.55, 0.72], [0.9, 0.68]] as Array<[number, number]>,
  drivewayClosed: false,
};

function itemCountsByName(items: PlacedItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (def) counts.set(def.name, (counts.get(def.name) ?? 0) + 1);
  }
  return counts;
}

test('context opacity is always below the explicit full-strength legend boundary', () => {
  for (const alpha of Object.values(EXACT_CONTEXT_ALPHA)) {
    assert.ok(alpha < EXACT_FULL_STRENGTH_ALPHA);
  }
});

for (const fixture of FIXTURES) {
  test(`${fixture.name}: all nine exact sheets keep full-strength map content and legend counts in agreement`, () => {
    for (const sheet of SHEETS) {
      const registered = fixture.state.items.map((item) => {
        const def = ELEMENTS_BY_ID[item.defId];
        assert.ok(def, `fixture contains unknown element ${item.defId}`);
        return { item, def, register: exactSheetElementRegister(def, sheet) };
      });
      const content = registered.filter((entry) => entry.register === 'content');
      const notContent = registered.filter((entry) => entry.register !== 'content');

      if (sheet === 'base' || sheet === 'sector' || sheet === 'implementation') {
        assert.equal(content.length, 0, `${sheet} uses placed elements only as absent/muted orientation context`);
        continue;
      }

      const itemRows = exactSheetElementLegendGroups(fixture.state, sheet);

      if (sheet === 'zones') {
        assert.equal(content.length, 0);
        assert.equal(itemRows.length, 0, 'zone ghosts are context, never unlabelled zone content');
        continue;
      }

      if (sheet === 'all') {
        for (const entry of content) {
          const families = INTEGRATED_LEGEND_FAMILIES.filter((family) => family.matches(entry.def));
          assert.ok(families.length > 0, `${entry.def.id} is drawn full-strength but has no integrated legend family`);
        }
        for (const family of INTEGRATED_LEGEND_FAMILIES) {
          const matching = content.filter((entry) => family.matches(entry.def));
          const matchingRows = itemRows.filter((row) => row.text === family.text && row.count === matching.length);
          assert.equal(
            matchingRows.length,
            matching.length > 0 ? 1 : 0,
            `${family.text} must have one row exactly when matching markers are drawn`,
          );
        }
        for (const row of itemRows) {
          assert.ok(
            INTEGRATED_LEGEND_FAMILIES.some((family) => row.text === family.text),
            `legend group "${row.text}" has no drawn integrated family`,
          );
        }
        continue;
      }

      const counts = itemCountsByName(content.map((entry) => entry.item));
      for (const [name, count] of counts) {
        assert.equal(
          itemRows.filter((row) => row.text === name && row.count === count).length,
          1,
          `${sheet} must print exactly one counted row for every full-strength marker type`,
        );
      }
      for (const row of itemRows) {
        const def = ELEMENTS_BY_ID[row.defId];
        assert.ok(def && counts.has(def.name), `${sheet} legend group "${row.text}" has no full-strength marker`);
      }
      for (const entry of notContent) {
        assert.equal(
          itemRows.some((row) => row.defId === entry.def.id),
          false,
          `${sheet} must not legend ${entry.def.id} when it is filtered off or context-only`,
        );
      }
    }
  });

  test(`${fixture.name}: AI prompt inventory and exact legend agree in both directions on all eight sheets`, () => {
    for (const sheet of SATELLITE_OVERLAY_SHEETS) {
      const prompt = overlayElementsText(fixture.state, PROMPT_REF_LAYERS, sheet);
      const legend = exactSheetElementLegendGroups(fixture.state, sheet);

      for (const named of prompt.legendElementGroups) {
        assert.equal(
          legend.filter((row) =>
            row.text === named.text
            && row.count === named.count
            && row.defId === named.defId).length,
          1,
          `${sheet}: prompt names "${named.text}" ×${named.count} but the exact legend does not`,
        );
      }
      for (const row of legend) {
        assert.equal(
          prompt.legendElementGroups.filter((named) =>
            named.text === row.text
            && named.count === row.count
            && named.defId === row.defId).length,
          1,
          `${sheet}: legend lists "${row.text}" ×${row.count} but the model was not told it exists`,
        );
      }

      const modelSheets = new Set<ExactPlanSheetKey>([
        'zones',
        'water',
        'planting',
        'structures',
        'all',
      ]);
      const expectedContent: OverlayLegendContentGroup[] = modelSheets.has(sheet)
        ? [
            ...legend.map((row) => ({ kind: 'element' as const, text: row.text, count: row.count })),
            ...exactSheetLineLegendGroups(fixture.state, sheet)
              .map((row) => ({ kind: 'line' as const, text: row.text, count: row.count })),
            ...exactSheetZoneLegendGroups(fixture.state, sheet)
              .map((row) => ({ kind: 'zone' as const, text: row.text })),
            ...exactSheetGroundLegendGroups(
              fixture.state,
              PROMPT_REF_LAYERS,
              sheet as GlossyLayerFilter,
            ).map((row) => ({ kind: 'ground' as const, text: row.text })),
            ...(sheet === 'all'
              ? [{ kind: 'driveway' as const, text: EXACT_DRIVEWAY_LEGEND_TEXT }]
              : []),
          ]
        : [];

      for (const named of prompt.legendContentGroups) {
        assert.equal(
          expectedContent.filter((row) =>
            row.kind === named.kind
            && row.text === named.text
            && row.count === named.count).length,
          1,
          `${sheet}: prompt content "${named.text}" has no exact legend row`,
        );
      }
      for (const row of expectedContent) {
        assert.equal(
          prompt.legendContentGroups.filter((named) =>
            named.kind === row.kind
            && named.text === row.text
            && named.count === row.count).length,
          1,
          `${sheet}: exact legend content "${row.text}" was not named to the model`,
        );
      }
    }
  });
}

test('prompt-only context is structurally context, never an unlegended content exception', () => {
  const state = allCatalogFixture();
  for (const sheet of SHEETS) {
    const prompt = overlayElementsText(state, PROMPT_REF_LAYERS, sheet);
    for (const group of prompt.contextElementGroups) {
      const def = ELEMENTS_BY_ID[group.defId];
      assert.ok(def);
      assert.equal(
        exactSheetElementRegister(def, sheet),
        'context',
        `${sheet}: ${group.text} may be prompt-only only when the sheet register declares context`,
      );
      assert.equal(
        prompt.legendElementGroups.some((content) => content.defId === group.defId),
        false,
        `${sheet}: context ${group.text} leaked into the content legend`,
      );
    }

    if (sheet === 'water' || sheet === 'zones') {
      assert.equal(groundRegister('lawn', sheet), 'context');
    } else if (sheet === 'planting' || sheet === 'structures' || sheet === 'all') {
      assert.equal(groundRegister('lawn', sheet), 'content');
    }
  }
});

test('driveway uses the content channel only on the masterplan and context fabric elsewhere', () => {
  const state = buildDemoDesignCanvasState();
  for (const sheet of ['zones', 'water', 'planting', 'structures'] as const) {
    const prompt = overlayElementsText(state, PROMPT_REF_LAYERS, sheet);
    assert.doesNotMatch(prompt.elements, /Tarred driveway/i, `${sheet}: context became content`);
    assert.match(prompt.fabric, /Tarred driveway/i, `${sheet}: context must still be named to the model`);
  }
  const masterplan = overlayElementsText(state, PROMPT_REF_LAYERS, 'all');
  assert.match(masterplan.elements, /Tarred driveway/i);
  assert.doesNotMatch(masterplan.fabric, /Tarred driveway/i);
});

// A label the legend cannot explain is worse than no label. The Ubhejane render at v80 carried a
// leadered DRIVEWAY callout on sheet 05 (Planting) and sheet 06 (Structures) while neither legend
// held a driveway row — correctly, because on a layer sheet the driveway is CONTEXT, and
// groundRegister's contract for context is "never captioned, never legended". So the one label on
// the sheet that was not part of the plan was the one label the legend could not decode.
//
// DesignGlossy already stated the rule where it decides a sheet's named parts — "Only the
// whole-design sheet lists the driveway. On a layer sheet it is context, and listing it there gave
// an access track a legend row and a label alongside the actual design work" — but producerLabels
// emitted the pill on every sheet regardless, and only the masterplan's curated callout layer
// filtered it back out. Every layer sheet, and both paths that call producerLabels straight into
// drawBlueprintLabelPills with no curation at all, kept it.

const DRIVEWAY_FIXTURE_REF = {
  boundary: [] as Array<[number, number]>,
  house: [] as Array<[number, number]>,
  // A traced access track: enough points for the >= 2 gate, with a real midpoint to label.
  driveway: [[0.2, 0.2], [0.5, 0.25], [0.8, 0.3]] as Array<[number, number]>,
  drivewayClosed: false,
};

const drivewayLabels = (filter: GlossyLayerFilter) =>
  producerLabels(buildDemoDesignCanvasState(), DRIVEWAY_FIXTURE_REF, 2000, 1200, filter, false)
    .filter((label) => /DRIVEWAY/.test(label.text));

test('the driveway is only ever called out on the masterplan, where the legend lists it', () => {
  // Layer sheets: context. Drawn so the plan orients, never named.
  for (const filter of ['water', 'planting', 'structures', 'zones', 'sector', 'base'] as GlossyLayerFilter[]) {
    assert.deepEqual(
      drivewayLabels(filter).map((l) => l.text),
      [],
      `${filter}: a DRIVEWAY callout with no legend row to explain it`,
    );
  }
  // Masterplan: the driveway IS content and earns a legend row, so the pill is produced here and
  // the curated callout layer drops it as a duplicate. Producing it is what keeps that curation
  // meaningful — assert it still exists rather than silently deleting the whole feature.
  assert.equal(drivewayLabels('all').length, 1, 'the masterplan still knows about the driveway');
});

test('no driveway geometry means no driveway label on any sheet', () => {
  const noDriveway = { ...DRIVEWAY_FIXTURE_REF, driveway: [] as Array<[number, number]> };
  for (const filter of ['all', 'planting', 'water'] as GlossyLayerFilter[]) {
    const labels = producerLabels(buildDemoDesignCanvasState(), noDriveway, 2000, 1200, filter, false);
    assert.equal(labels.filter((l) => /DRIVEWAY/.test(l.text)).length, 0, filter);
  }
});

test('Planting callouts use the same species identities as the Planting legend', () => {
  const state = buildDemoDesignCanvasState();
  // referenceBlueprintLabels canonicalises farmer nicknames before the exact reference sheet is
  // painted, so exercise the same path here rather than comparing "BED 1" with "Vegetable Bed".
  const canonicalState = {
    ...state,
    items: state.items.map(({ label: _label, ...item }) => item),
  };
  const labels = producerLabels(canonicalState, DRIVEWAY_FIXTURE_REF, 1936, 1268, 'planting', false)
    .filter((label) => label.leader !== false);
  const legendNames = new Set(
    exactSheetElementLegendGroups(state, 'planting').map((row) => row.text.toUpperCase()),
  );

  assert.equal(
    labels.some((label) => label.kind === 'header'),
    false,
    'a grouped tree header cannot be decoded from species-specific legend rows',
  );
  assert.ok(labels.some((label) => /^AVOCADO TREE(?: ×\d+)?$/.test(label.text)));
  assert.ok(labels.some((label) => /^MANGO TREE(?: ×\d+)?$/.test(label.text)));
  const moringas = labels.filter((label) => label.id?.startsWith('demo-di-moringa-'));
  assert.equal(moringas.length, 2, 'distant Moringas need one leader each, not one empty-centroid leader');
  assert.ok(moringas.every((label) => !/×2/.test(label.text)));
  assert.deepEqual(
    moringas.map((label) => label.cx).sort((a, b) => a - b),
    state.items
      .filter((item) => item.id.startsWith('demo-di-moringa-'))
      .map((item) => item.x * 1936)
      .sort((a, b) => a - b),
    'each Moringa leader must stay anchored to a saved tree',
  );
  for (const label of labels) {
    // Repeated specimens in separate clusters retain a compass prefix so their leaders remain
    // distinguishable; the species identity after that prefix must still be a real legend row.
    const identity = label.text
      .replace(/^(?:(?:NORTH|SOUTH|CENTRAL)-(?:WESTERN|EASTERN)|NORTHERN|SOUTHERN|EASTERN|WESTERN|CENTRAL) /, '')
      .replace(/ ×\d+$/, '');
    assert.ok(legendNames.has(identity), `Planting callout "${label.text}" has no matching legend identity`);
  }
});

// EVERY LINE KIND THE LEGEND CLAIMS MUST BE ONE THIS SHEET WILL ACTUALLY PAINT.
//
// This file's other line check compares the legend against the AI PROMPT inventory — and both are
// built from exactSheetLineLegendGroups, so the two agree with each other by construction and
// neither notices what the canvas did. That blind spot let a real regression through: a membership
// check inside the route painter was written with the sheet hard-coded to 'water', but that same
// painter is the ONLY route painter for the masterplan (filter 'all'), so every swale silently
// vanished from sheet 08 while the legend carried on listing it. An adversarial audit found it;
// no test did.
//
// The rule this pins is the one the renderer must obey: a line kind may only be legended on a
// sheet whose shared draw register admits it. `lineInFilter` owns step focus, while the register
// separately admits the Water sheet's quiet swale context; that distinction prevents a stated
// width from disappearing without falsely making Water own the earthwork.
test('no sheet legends a line kind that its shared draw register excludes', () => {
  const kinds = ['swale', 'pipe', 'drip', 'greywater', 'fence', 'path', 'bedpath', 'windbreak'] as const;
  const state = {
    lines: kinds.map((kind, index) => ({
      id: `line-${kind}`,
      kind,
      points: [[0.3, 0.3 + index * 0.01], [0.7, 0.32 + index * 0.01]] as Array<[number, number]>,
    })),
  } as unknown as Parameters<typeof exactSheetLineLegendGroups>[0];

  // 'base', 'sector' and 'implementation' legend no line kinds at all, so they have nothing to
  // check; the layer sheets and the masterplan are where a mismatch can occur.
  const lineSheets: GlossyLayerFilter[] = ['zones', 'water', 'earthworks', 'planting', 'structures', 'all'];
  for (const sheet of lineSheets) {
    for (const group of exactSheetLineLegendGroups(state, sheet as ExactPlanSheetKey)) {
      if (!group.lineKind) continue;
      assert.ok(
        exactSheetLineRegister(group.lineKind, sheet) !== 'absent',
        `sheet ${sheet} legends "${group.text}" but exactSheetLineRegister(${group.lineKind}, ${sheet}) is absent — `
        + 'the legend would print a row for a mark the renderer is not allowed to draw',
      );
    }
  }
});
