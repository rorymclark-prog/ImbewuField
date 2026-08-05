import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyKoppen, rainPatternFor, summerMonthIndices, type MonthlyClimate } from '@/lib/koppen-global';

// These tests check the RULES, not the weather.
//
// The obvious way to test a climate classifier is to assert that Durban is Cfa and
// Cairo is BWh. That would require writing twelve monthly temperatures and twelve
// monthly rainfall totals for each city into this file — real-world figures, from
// memory, presented as fact. The owner's standing rule is that an invented
// agronomic or climatic number is the worst thing this codebase can contain, and a
// fabricated climate normal that happens to produce the right three letters is
// exactly that: wrong data hiding behind a passing test.
//
// So every input below is SYNTHETIC and chosen to sit unambiguously inside one
// branch of the published Köppen-Geiger definition. They prove the implementation
// follows the standard. Whether NASA POWER's numbers for a given point are right is
// NASA's business, and is checked by looking at real output, not by asserting here.

/** Twelve identical months — the simplest input that can exercise a branch. */
function flat(tempC: number, precipMm: number, lat = -29): MonthlyClimate {
  return { tempC: Array(12).fill(tempC), precipMm: Array(12).fill(precipMm), lat };
}

/** Seasonal input: `hot`/`cold` temps and `wet`/`dry` rainfall split by hemisphere summer. */
function seasonal(
  opts: { summerTemp: number; winterTemp: number; summerRain: number; winterRain: number; lat: number },
): MonthlyClimate {
  const summer = new Set(summerMonthIndices(opts.lat));
  return {
    lat: opts.lat,
    tempC: Array.from({ length: 12 }, (_, m) => (summer.has(m) ? opts.summerTemp : opts.winterTemp)),
    precipMm: Array.from({ length: 12 }, (_, m) => (summer.has(m) ? opts.summerRain : opts.winterRain)),
  };
}

test('unusable input returns ? rather than a guess', () => {
  for (const bad of [
    { tempC: [], precipMm: [], lat: 0 },
    { tempC: Array(11).fill(20), precipMm: Array(12).fill(50), lat: 0 },
    { tempC: Array(12).fill(Number.NaN), precipMm: Array(12).fill(50), lat: 0 },
    { tempC: Array(12).fill(20), precipMm: Array(12).fill(-5), lat: 0 },
  ] as MonthlyClimate[]) {
    const r = classifyKoppen(bad);
    assert.equal(r.code, '?', 'incomplete input must not produce a confident class');
    assert.equal(r.growerNote, '', 'an unknown climate must not carry growing advice');
  }
});

test('the summer half-year flips with the hemisphere', () => {
  // Getting this backwards turns every Mediterranean climate into a monsoon one.
  assert.deepEqual(summerMonthIndices(45), [3, 4, 5, 6, 7, 8], 'northern summer is Apr-Sep');
  assert.deepEqual(summerMonthIndices(-29), [9, 10, 11, 0, 1, 2], 'southern summer is Oct-Mar');
  assert.deepEqual(summerMonthIndices(0), [3, 4, 5, 6, 7, 8], 'the equator takes the northern convention');
});

test('aridity is judged against the threshold, and outranks every other group', () => {
  // Worked from the definition rather than from intuition, because intuition is
  // wrong here: at MAT 25 with rain spread evenly the threshold is 2*25 + 14 = 64,
  // so ARID is anything under 640mm/yr and DESERT anything under 320. A 300mm year
  // sounds like steppe and is in fact desert. (This assertion was written the
  // intuitive way first and the implementation was right.)
  assert.equal(classifyKoppen(flat(25, 5)).code.slice(0, 2), 'BW', '60mm/yr at 25C is a desert');
  assert.equal(classifyKoppen(flat(25, 40)).code.slice(0, 2), 'BS', '480mm/yr at 25C is steppe: above 5x but below 10x the threshold');
  assert.equal(classifyKoppen(flat(25, 25)).code.slice(0, 2), 'BW', '300mm/yr at 25C is still desert: below 5x the threshold');
  assert.equal(classifyKoppen(flat(25, 60)).group, 'A', '720mm/yr at 25C clears the arid test entirely');
  // Same dryness, cold: the third letter tracks mean annual temperature at 18C.
  assert.equal(classifyKoppen(flat(25, 5)).code, 'BWh', 'mean >= 18C is hot');
  assert.equal(classifyKoppen(flat(5, 1)).code, 'BWk', 'mean < 18C is cold');
  // Precedence: a bone-dry site whose coldest month is above 18C is still B, not A.
  assert.equal(classifyKoppen(flat(25, 5)).group, 'B', 'aridity outranks the tropical test');
});

test('tropical splits on the driest month, not on the annual total', () => {
  // Coldest month >= 18C, and wet enough to clear the arid threshold.
  const perHumid = flat(26, 200); // driest month 200mm >= 60
  assert.equal(classifyKoppen(perHumid).code, 'Af');

  // A real dry month, but a very wet year: Am's compensation rule (Pdry >= 100 - MAP/25).
  const monsoon: MonthlyClimate = {
    lat: -10,
    tempC: Array(12).fill(26),
    // 3000mm total => the Am floor is 100 - 120 = negative, so any dry month qualifies.
    precipMm: [10, 10, 10, 400, 400, 400, 400, 400, 400, 200, 200, 170],
  };
  assert.equal(classifyKoppen(monsoon).code, 'Am', 'a very wet year tolerates a dry month');

  // A modest year with a hard dry season falls through to savanna.
  const savanna: MonthlyClimate = {
    lat: -20,
    tempC: Array(12).fill(24),
    precipMm: [150, 150, 100, 5, 0, 0, 0, 0, 20, 100, 150, 150],
  };
  const r = classifyKoppen(savanna);
  assert.equal(r.group, 'A');
  assert.ok(['Aw', 'As'].includes(r.code), `savanna, got ${r.code}`);
});

test('a dry season in the summer half reads differently from one in the winter half', () => {
  // The distinction Peel folds away, kept because it inverts the planting calendar.
  const base = { tempC: Array(12).fill(24), lat: -25 };
  const drySouthernWinter: MonthlyClimate = {
    ...base,
    // Southern winter = Apr-Sep (indices 3-8). Put the drought there.
    precipMm: [180, 180, 160, 0, 0, 0, 0, 0, 5, 160, 180, 180],
  };
  const drySouthernSummer: MonthlyClimate = {
    ...base,
    // Southern summer = Oct-Mar. Put the drought there instead.
    precipMm: [0, 0, 5, 180, 180, 160, 160, 180, 180, 0, 0, 0],
  };
  assert.equal(classifyKoppen(drySouthernWinter).code, 'Aw', 'dry winter');
  assert.equal(classifyKoppen(drySouthernSummer).code, 'As', 'dry summer');
});

test('temperate second letter distinguishes dry-summer, dry-winter and no dry season', () => {
  const lat = -33; // southern hemisphere: summer is Oct-Mar
  // Dry summer: driest summer month < 40mm AND < wettest winter month / 3.
  const medIsh = seasonal({ summerTemp: 21, winterTemp: 11, summerRain: 10, winterRain: 120, lat });
  assert.equal(classifyKoppen(medIsh).code[1], 's', `expected dry-summer, got ${classifyKoppen(medIsh).code}`);

  // Dry winter: driest winter month < wettest summer month / 10.
  const summerRainfall = seasonal({ summerTemp: 21, winterTemp: 11, summerRain: 150, winterRain: 5, lat });
  assert.equal(classifyKoppen(summerRainfall).code[1], 'w', `expected dry-winter, got ${classifyKoppen(summerRainfall).code}`);

  // Even rainfall: neither rule fires.
  const even = seasonal({ summerTemp: 21, winterTemp: 11, summerRain: 90, winterRain: 90, lat });
  assert.equal(classifyKoppen(even).code[1], 'f', `expected no-dry-season, got ${classifyKoppen(even).code}`);
});

test('temperate third letter tracks how hot and how long the summer is', () => {
  const lat = -33;
  const hotSummer = seasonal({ summerTemp: 24, winterTemp: 10, summerRain: 90, winterRain: 90, lat });
  assert.equal(classifyKoppen(hotSummer).code[2], 'a', 'warmest month >= 22C');

  // Warm but under 22C, with at least four months at or above 10C.
  const warmSummer = seasonal({ summerTemp: 18, winterTemp: 6, summerRain: 90, winterRain: 90, lat });
  assert.equal(classifyKoppen(warmSummer).code[2], 'b');

  // Short cool summer: only the six summer months clear 10C... so build a shorter one.
  const shortSummer: MonthlyClimate = {
    lat,
    tempC: [12, 12, 4, 3, 2, 2, 2, 3, 4, 6, 9, 12], // 4 months >= 10 -> b; drop to 3
    precipMm: Array(12).fill(90),
  };
  const shorter: MonthlyClimate = { ...shortSummer, tempC: [12, 12, 4, 3, 2, 2, 2, 3, 4, 6, 9, 9] };
  assert.equal(classifyKoppen(shorter).code[2], 'c', '1-3 months above 10C is a cold-summer temperate');
});

test('cold and polar groups are separated by the coldest and warmest months', () => {
  const lat = 55;
  // Coldest month at or below 0C, warmest above 10C -> D.
  const continental = seasonal({ summerTemp: 18, winterTemp: -8, summerRain: 80, winterRain: 80, lat });
  assert.equal(classifyKoppen(continental).group, 'D');

  // Warmest month at or below 10C -> E, and above freezing -> tundra.
  const tundra = seasonal({ summerTemp: 6, winterTemp: -20, summerRain: 40, winterRain: 40, lat });
  assert.equal(classifyKoppen(tundra).code, 'ET');

  // Never above freezing -> ice cap.
  const iceCap = seasonal({ summerTemp: -5, winterTemp: -40, summerRain: 30, winterRain: 30, lat });
  assert.equal(classifyKoppen(iceCap).code, 'EF');
});

test('every code the classifier can emit carries a description and a grower note', () => {
  // A code with no entry in the description table would reach a farmer as
  // "Unclassified" with no advice — a silent gap rather than a visible one.
  const samples: MonthlyClimate[] = [
    flat(26, 200), flat(25, 5), flat(5, 1), flat(25, 25),
    seasonal({ summerTemp: 24, winterTemp: 10, summerRain: 90, winterRain: 90, lat: -33 }),
    seasonal({ summerTemp: 21, winterTemp: 11, summerRain: 10, winterRain: 120, lat: -33 }),
    seasonal({ summerTemp: 21, winterTemp: 11, summerRain: 150, winterRain: 5, lat: -33 }),
    seasonal({ summerTemp: 18, winterTemp: -8, summerRain: 80, winterRain: 80, lat: 55 }),
    seasonal({ summerTemp: 6, winterTemp: -20, summerRain: 40, winterRain: 40, lat: 55 }),
  ];
  for (const s of samples) {
    const r = classifyKoppen(s);
    assert.notEqual(r.description, 'Unclassified', `${r.code} has no description`);
    assert.ok(r.growerNote.length > 0, `${r.code} has no grower note`);
  }
});

test('the rainfall pattern bridge matches the planner\'s four patterns', () => {
  const lat = -29;
  const summerRain = seasonal({ summerTemp: 24, winterTemp: 14, summerRain: 140, winterRain: 10, lat });
  assert.equal(rainPatternFor(summerRain, classifyKoppen(summerRain)), 'summer');

  const winterRain = seasonal({ summerTemp: 24, winterTemp: 14, summerRain: 10, winterRain: 140, lat });
  assert.equal(rainPatternFor(winterRain, classifyKoppen(winterRain)), 'winter');

  const evenRain = seasonal({ summerTemp: 24, winterTemp: 16, summerRain: 100, winterRain: 100, lat });
  assert.equal(rainPatternFor(evenRain, classifyKoppen(evenRain)), 'all-year');

  // A cold month implies frost nights, and the planner treats that as the binding
  // constraint regardless of when the rain falls.
  const frosty = seasonal({ summerTemp: 22, winterTemp: 2, summerRain: 140, winterRain: 10, lat });
  assert.equal(rainPatternFor(frosty, classifyKoppen(frosty)), 'mild-frost');

  // ...but a tropical climate is never called mild-frost, however the numbers fall.
  const tropical = flat(26, 200, -10);
  assert.notEqual(rainPatternFor(tropical, classifyKoppen(tropical)), 'mild-frost');
});
