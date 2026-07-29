import test from 'node:test';
import assert from 'node:assert/strict';

import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import {
  EXACT_CONTEXT_ALPHA,
  EXACT_FULL_STRENGTH_ALPHA,
  INTEGRATED_LEGEND_FAMILIES,
  exactSheetElementLegendGroups,
  exactSheetElementRegister,
  type ExactPlanSheetKey,
} from '../lib/glossy-filters.ts';

const SHEETS: ExactPlanSheetKey[] = [
  'base',
  'sector',
  'zones',
  'water',
  'planting',
  'structures',
  'all',
  'implementation',
];

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
  test(`${fixture.name}: all eight exact sheets keep full-strength map content and legend counts in agreement`, () => {
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
}
