import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cropByKey } from '../lib/crop-catalog.ts';
import { CATALOG_KEY_FOR_CROP } from '../lib/crop-display.ts';
import { sowMarksForPattern } from '../lib/crop-calendar.ts';

// THE MONTH CARDS ON /calendar MUST AGREE WITH THE CATALOG.
//
// The page carried two answers to "when does maize happen" and they disagreed IN THE SAME FILE:
// the grid derived sow marks from the catalog, while the month cards were hand-typed. January
// read "Harvest ready: Maize" and "Plant now: Sweet potato slips" — the first inviting a farmer to
// cut cobs months before the catalog says grain exists, the second spending a bed and 25-45 slips
// outside the sowing window. Neither costs money; both cost a SEASON, which is worse.
//
// These tests pin the two halves: the source may not reintroduce hand-typed crop lists, and the
// derivation the page now uses must actually match the catalog.

const PAGE = readFileSync(join(process.cwd(), 'app', 'calendar', 'page.tsx'), 'utf8');

test('the month cards carry no hand-typed crop lists', () => {
  // The whole defect was a second, unsourced source of truth living beside the derived one.
  assert.ok(
    !/^ {4}(plant|harvest): \[/m.test(PAGE),
    'a hand-typed plant/harvest list came back — derive it from CROPS instead',
  );
  assert.ok(
    PAGE.includes('plant: CROPS.filter(') && PAGE.includes('harvest: CROPS.filter('),
    'the month cards stopped deriving their crops from the catalog-backed CROPS array',
  );
});

// READ THE PAGE'S OWN CROP ROWS, do not mirror them. A copy of the harvest windows here would
// test this file against itself and pass happily while the page drifted back to claiming maize in
// January — which is the entire defect these tests exist for.
const PAGE_CROPS = [...PAGE.matchAll(
  /\{\s*name: '([^']+)',\s*catalogKey: CATALOG_KEY_FOR_CROP(?:\.(\w+)|\['([^']+)'\]),\s*harvestMonths: \[([^\]]*)\]/g,
)].map((match) => ({
  name: match[1],
  key: (CATALOG_KEY_FOR_CROP as Record<string, string>)[match[2] ?? match[3]],
  harvestMonths: match[4].split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n)),
}));

test('the crop rows were actually parsed out of the page', () => {
  // Guards the guard: a regex that silently matches nothing would make every assertion below
  // vacuous, and a vacuous green test is worse than no test.
  assert.ok(PAGE_CROPS.length >= 8, `parsed only ${PAGE_CROPS.length} crop rows from the page`);
  assert.ok(PAGE_CROPS.every((crop) => crop.key && cropByKey(crop.key)), 'a parsed crop has no catalog entry');
  assert.ok(PAGE_CROPS.every((crop) => crop.harvestMonths.length > 0), 'a parsed crop has no harvest months');
});

test('every "Plant now" month is inside that crop\'s catalog sowing window', () => {
  for (const crop of PAGE_CROPS) {
    const marks = sowMarksForPattern(crop.key, 'summer');
    const sowMonths = new Set(cropByKey(crop.key)!.sowMonths.summer);
    for (let month = 0; month < 12; month++) {
      if (marks[month] !== 'B') continue;
      assert.ok(
        sowMonths.has(month + 1),
        `${crop.name} is offered for planting in month ${month + 1}, outside its catalog window`,
      );
    }
  }
});

test('January no longer invites a maize harvest or a sweet-potato planting', () => {
  // The two headline defects, named directly so a regression is unmistakable rather than merely
  // failing a general rule.
  const maize = PAGE_CROPS.find((crop) => crop.name === 'Maize')!;
  assert.ok(!maize.harvestMonths.includes(0), 'maize must not be harvestable in January');

  const sweetPotato = PAGE_CROPS.find((crop) => crop.name === 'Sweet Potato')!;
  assert.equal(
    sowMarksForPattern(sweetPotato.key, 'summer')[0], '',
    'sweet potato must not be offered for planting in January',
  );
});

test('a crop is never shown ripening before its own days-to-harvest allow', () => {
  // The arithmetic the grid's harvest months are supposed to encode: earliest sow + maturity.
  // Maize sows Oct at 140 days, so nothing before February — which is exactly what January got
  // wrong. Checking it for every crop stops the next hand-tuned window from drifting.
  for (const crop of PAGE_CROPS) {
    const def = cropByKey(crop.key)!;
    const sowMonths = def.sowMonths.summer;
    if (!sowMonths.length) continue;
    const monthsToRipen = Math.ceil(def.daysToHarvest / 30);
    const reachable = new Set(sowMonths.map((sow) => (sow - 1 + monthsToRipen) % 12));
    // Allow the window to extend past the first ripe month — a crop keeps yielding — but its
    // START must be a month some permitted sowing can actually reach.
    assert.ok(
      crop.harvestMonths.some((month) => reachable.has(month)),
      `${crop.name}'s harvest window contains no month any permitted sowing can reach`,
    );
  }
});
