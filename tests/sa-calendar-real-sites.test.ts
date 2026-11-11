import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { RainPattern } from '@/lib/crop-catalog';
import { calendarForGrower, siteClimateFromLocationData, type SiteClimate } from '@/lib/site-climate';
import { sowingCalendarReasons } from '@/lib/sowing-calendar-label';

// DOES A REAL FARM GET THE CALENDAR ITS OWN FROST RECORD CALLS FOR?
//
// Every earlier check of the calendar choice asked whether the rule agreed with itself, on
// synthetic curves. The 10 November 2026 accuracy audit ran it for 44 real South African
// places and found seven Lowveld and Limpopo sites with no frost day in twenty years on the
// hard-frost calendar — shown tomatoes for August to October where their regional guides say
// January to July — and the hot KZN coast on the light-frost one.
//
// The fixture is those 44 places as the app itself read them that day (NASA POWER monthly
// means, monthly rain and record minimum), each with an INDEPENDENT frost record: ERA5 daily
// minimum temperatures for 2001-2020. The app's inputs go through the app's own function;
// the independent record is only ever used to judge the answer. Both are gridded estimates
// for a cell tens of kilometres wide, not weather stations.

interface Site {
  name: string; lat: number; lon: number;
  monthlyTempC: number[]; monthlyRainMm: number[]; rainfallSource: string; recordMinC: number;
  era5: { airFrostDaysPerYear: number; lowestDailyMinC: number; yearsWithFrost: number; years: number };
}
const SITES: Site[] = JSON.parse(readFileSync(new URL('./fixtures/sa-climate-sites-2026-11-10.json', import.meta.url), 'utf8')).sites;
// The 56 places of the 11 November 2026 held-out test, read the same way that day. They were
// held back from the design of the rule; two failed one criterion (CP-103, below). Now that
// they have been seen they are regression evidence, exactly like the 44.
const HELD_OUT_2026_11_11: Site[] = JSON.parse(readFileSync(new URL('./fixtures/sa-climate-holdout-2026-11-11.json', import.meta.url), 'utf8')).sites;
const ALL_SITES: Site[] = [...SITES, ...HELD_OUT_2026_11_11];

const payload = (site: Site, withRecordMinimum = true) => ({
  rainfall: { rainfallSource: site.rainfallSource, monthly: site.monthlyRainMm },
  climate: {
    monthlyTemp: site.monthlyTempC,
    monthlyTempCoverage: { source: 'nasa-power', status: 'complete' },
    ...(withRecordMinimum ? { minTemp: site.recordMinC, minTempSource: 'nasa-power' } : {}),
  },
});
const climateOf = (site: Site, withRecordMinimum = true): SiteClimate => {
  const climate = siteClimateFromLocationData(payload(site, withRecordMinimum), site.lat);
  assert.ok(climate, `${site.name}: the recorded reading must resolve`);
  return climate;
};
const byName = (name: string) => {
  const site = SITES.find((candidate) => candidate.name === name);
  assert.ok(site, `fixture is missing ${name}`);
  return site;
};

test('the fixture is the audited set: 44 places, each with a real record minimum', () => {
  assert.equal(SITES.length, 44);
  for (const site of SITES) {
    assert.equal(site.monthlyTempC.length, 12);
    assert.equal(site.monthlyRainMm.length, 12);
    assert.ok(Number.isFinite(site.recordMinC), `${site.name}: no record minimum`);
    assert.equal(site.era5.years, 20);
  }
});

test('no place with frost on its independent record is given a frost-free or light-frost calendar', () => {
  const wrong: string[] = [];
  // Both sets: the 56 held-out places passed these three rules without exception.
  for (const site of ALL_SITES) {
    const { pattern } = climateOf(site);
    const { airFrostDaysPerYear: frostDays, lowestDailyMinC: lowest } = site.era5;
    // The hot-area column sows tender crops through winter: its sites must never have frozen.
    if (pattern === 'all-year' && (frostDays > 0 || lowest <= 0)) {
      wrong.push(`${site.name} is on the hot, frost-free calendar but froze (${frostDays} frost days a year, lowest ${lowest} °C)`);
    }
    // The light-frost column tolerates frost in hollows, not a frost season.
    if (pattern === 'mild-frost' && frostDays >= 0.5) {
      wrong.push(`${site.name} is on the light-frost calendar with ${frostDays} frost days a year`);
    }
    // A place that frosts every year belongs on a calendar that waits for frost to pass.
    if (frostDays >= 1 && pattern !== 'summer' && pattern !== 'winter') {
      wrong.push(`${site.name} frosts ${frostDays} days a year and is on '${pattern}'`);
    }
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

test('no place that never froze in twenty years is shown the hard-frost season, unless its record minimum says frost', () => {
  // The finding itself (CP-073), as a rule: a frost-free independent record AND a frost-free
  // record minimum from the app's own source must never produce the hard-frost calendar on
  // summer or all-year rain. Polokwane and Mthatha (lowest daily minimum exactly 0.0 °C,
  // record minimum below zero) are frost sites and correctly stay.
  const wrong = SITES.filter((site) => {
    const climate = climateOf(site);
    return climate.pattern === 'summer' && site.era5.yearsWithFrost === 0 && site.era5.lowestDailyMinC > 0 && site.recordMinC > 0;
  }).map((site) => site.name);
  assert.deepEqual(wrong, []);
});

test('the frost rules are one-sided: an answer that ignores the place can pass them, so they are not an accuracy score', () => {
  // Independent review of 11 November 2026 (Codex, CBR-01). The frost rules above only forbid
  // particular frost mistakes. Giving EVERY place the winter-rainfall calendar breaks none of
  // them, at all 100 places: two rules constrain only the hot-area and light-frost answers,
  // one allows the winter calendar at any frost count, one forbids only the hard-frost
  // calendar. So "54 of 56 passed" is frost-constraint compliance, never the share of places
  // given the right calendar. What pins the calendar itself is the named list for each set
  // below, which is regression evidence, and nothing here measures sowing months or crops.
  const breaks = (pattern: RainPattern, site: Site): boolean => {
    const { airFrostDaysPerYear: frostDays, lowestDailyMinC: lowest, yearsWithFrost } = site.era5;
    return (pattern === 'all-year' && (frostDays > 0 || lowest <= 0))
      || (pattern === 'mild-frost' && frostDays >= 0.5)
      || (frostDays >= 1 && pattern !== 'summer' && pattern !== 'winter')
      || (pattern === 'summer' && yearsWithFrost === 0 && lowest > 0 && site.recordMinC > 0);
  };
  const passing = (pattern: RainPattern) => ALL_SITES.filter((site) => !breaks(pattern, site)).length;
  assert.equal(passing('winter'), 100, 'the degenerate answer passes everywhere: the rules cannot see it');
  // The other place-blind answers are caught, which is all these rules are for.
  assert.equal(passing('summer'), 62);
  assert.equal(passing('mild-frost'), 53);
  assert.equal(passing('all-year'), 43);
  // The app's own answers: every place except the two named in CP-103.
  assert.deepEqual(ALL_SITES.filter((site) => breaks(climateOf(site).pattern, site)).map((site) => site.name).sort(), ['Butterworth', 'Mossel Bay']);
  // And the app does not give the degenerate answer: 9 of 100 places are on the winter calendar.
  assert.equal(ALL_SITES.filter((site) => climateOf(site).pattern === 'winter').length, 9);
});

// CP-103, OPEN. The held-out test of 11 November 2026 applied the rule just above to 56 new
// places and two failed it: Butterworth (record minimum 1.4 °C, coldest month 12.9 °C) and
// Mossel Bay (1.7 °C, 12.5 °C) never froze on either record and are given the hard-frost
// calendar, because a record minimum between 0 and 2 °C with a coldest month under 13 °C
// falls through to it. The rule was NOT changed: moving such a site to the light-frost
// calendar would also move Pietermaritzburg, and today it would take away the eight crops
// that have no light-frost months (CP-082). So this test does not claim the calendar is
// right. It pins what makes the miss tolerable until that is decided: both places are told
// they are close to the light-frost line, and the grower's own "no frost" moves them.
test('CP-103 (open): the two held-out places wrongly on hard frost are told so and can be moved by the grower', () => {
  const failing = HELD_OUT_2026_11_11.filter((site) =>
    climateOf(site).pattern === 'summer' && site.era5.yearsWithFrost === 0 && site.era5.lowestDailyMinC > 0 && site.recordMinC > 0);
  assert.deepEqual(failing.map((site) => site.name).sort(), ['Butterworth', 'Mossel Bay'],
    'the held-out failures, by name: a change here is a change to the rule and needs a new held-back set');
  for (const site of failing) {
    assert.ok(site.recordMinC > 0 && site.recordMinC < 2, `${site.name}: in the 0-2 °C band`);
    const climate = climateOf(site);
    assert.equal(climate.closeCall, 'mild-frost', site.name);
    assert.equal(climate.warmerNeighbour, 'mild-frost', site.name);
    assert.deepEqual(calendarForGrower(climate, 'no'), { pattern: 'mild-frost', basis: 'grower-frost' }, site.name);
    assert.deepEqual(calendarForGrower(climate, 'unknown'), { pattern: 'summer', basis: 'site-climate' }, site.name);
    assert.match(sowingCalendarReasons(climate, { pattern: climate.pattern, basis: 'site-climate' }).join(' '),
      /close to the line for the "Light frost at most" calendar\. If you have never seen frost on these beds, say so in the site survey/, site.name);
  }
});

test('Eshowe is told it is close to the hot-area line, and its grower\'s "no frost" can use that calendar (Argon F-07)', () => {
  // The only one of the 100 recorded places where a neighbour is reachable by moving both
  // monthly means together and by neither alone (coldest 15.1 °C, hottest 23.9 °C, record
  // minimum 2.9 °C, no frost day on the second record). Its own calendar does not change.
  const eshowe = HELD_OUT_2026_11_11.find((site) => site.name === 'Eshowe');
  assert.ok(eshowe);
  assert.equal(eshowe.era5.airFrostDaysPerYear, 0, 'fixture: no frost on the second record');
  const climate = climateOf(eshowe);
  assert.equal(climate.pattern, 'mild-frost');
  assert.equal(climate.closeCall, 'all-year');
  assert.equal(climate.warmerNeighbour, 'all-year');
  assert.deepEqual(calendarForGrower(climate, 'unknown'), { pattern: 'mild-frost', basis: 'site-climate' });
  assert.deepEqual(calendarForGrower(climate, 'yes'), { pattern: 'mild-frost', basis: 'site-climate' });
  assert.deepEqual(calendarForGrower(climate, 'no'), { pattern: 'all-year', basis: 'grower-frost' });
  assert.match(sowingCalendarReasons(climate, { pattern: climate.pattern, basis: 'site-climate' }).join(' '),
    /close to the line for the "Hot area, no frost" calendar\. If you have never seen frost on these beds, say so/);
  // No other recorded place gained or lost a neighbour from the joint nudges: every place whose
  // calendar changes when all twelve months move by one degree already names that calendar.
  const shifted = (site: Site, by: number) => siteClimateFromLocationData({ ...payload(site), climate: { ...payload(site).climate, monthlyTemp: site.monthlyTempC.map((t) => t + by) } }, site.lat);
  for (const site of ALL_SITES) {
    const here = climateOf(site);
    for (const by of [-1, 1]) {
      const moved = shifted(site, by)?.pattern;
      if (!moved || moved === here.pattern) continue;
      assert.ok(here.closeCall === moved || here.warmerNeighbour === moved, `${site.name}: one degree ${by > 0 ? 'warmer' : 'colder'} gives '${moved}', which the site is not told about`);
    }
  }
});

// Where the rule puts each of the 56, as recorded on 11 November 2026. Butterworth and
// Mossel Bay are under 'summer' because that is what the rule does, not because it is right.
const HELD_OUT_RECORDED: Record<RainPattern, string[]> = {
  'all-year': ['Hoedspruit', 'Giyani', 'Hazyview', 'Letsitele', 'KwaDukuza', 'Mtubatuba', 'Jozini', 'Pongola'],
  'mild-frost': ['Malelane', 'Barberton', 'Port Shepstone', 'Eshowe', 'Makhanda', 'Qonce', 'Lusikisiki', 'Jeffreys Bay',
    'Hermanus', 'Knysna', 'Ulundi', 'Makhado'],
  winter: ['Paarl', 'Malmesbury', 'Clanwilliam', 'Calvinia'],
  summer: ['Mokopane', 'Bela-Bela', 'Brits', 'Zeerust', 'Thabazimbi', 'eMalahleni', 'Standerton', 'Kroonstad', 'Welkom',
    'Klerksdorp', 'Lichtenburg', 'Harrismith', 'Vereeniging', 'Middelburg (Mpumalanga)', 'Estcourt', 'Ladysmith',
    'Greytown', 'Ixopo', 'Dundee', 'Aliwal North', 'Cradock', 'Butterworth', 'Swellendam', 'Mossel Bay', 'Robertson',
    'Caledon', 'De Aar', 'Prieska', 'Kakamas', 'Colesberg', 'Victoria West', 'Vryburg'],
};

test('each of the 56 held-out places lands on the calendar recorded for it on 11 November 2026', () => {
  assert.equal(HELD_OUT_2026_11_11.length, 56);
  const got: Record<string, string[]> = { 'all-year': [], 'mild-frost': [], winter: [], summer: [] };
  for (const site of HELD_OUT_2026_11_11) {
    assert.equal(site.monthlyTempC.length, 12, site.name);
    assert.ok(Number.isFinite(site.recordMinC), `${site.name}: no record minimum`);
    assert.equal(site.era5.years, 20, site.name);
    got[climateOf(site).pattern].push(site.name);
  }
  for (const pattern of Object.keys(HELD_OUT_RECORDED) as RainPattern[]) {
    assert.deepEqual(got[pattern].sort(), [...HELD_OUT_RECORDED[pattern]].sort(), `places on '${pattern}'`);
  }
});

// The audited outcome for every place. The two tests above are the rule; this is the record
// of where the rule put each one on 10 November 2026, so a threshold cannot be moved without
// seeing exactly which towns change calendar.
const EXPECTED: Record<RainPattern, string[]> = {
  // Hot, frost-free: the Lowveld, the Limpopo valley, Zululand and the KZN coast.
  'all-year': ['Komatipoort', 'Phalaborwa', 'Musina', 'Thohoyandou', 'Mkuze sample farm', 'Durban', 'Richards Bay'],
  // Light frost at most — including frost-free coasts whose summer is mild, and the three
  // Lowveld-edge towns that sit just on the cold side of a line (see the close-call test).
  'mild-frost': ['Hillcrest', 'Port St Johns', 'East London', 'Gqeberha', 'George', 'Mbombela', 'Tzaneen', 'Lephalale'],
  winter: ['Cape Town', 'Stellenbosch', 'Ceres', 'Vredendal', 'Springbok'],
  summer: ['Pietermaritzburg', 'Underberg', 'Kokstad', 'Newcastle', 'Vryheid', 'Johannesburg', 'Pretoria', 'Ermelo',
    'Bethlehem', 'Bloemfontein', 'Potchefstroom', 'Mahikeng', 'Kimberley', 'Rustenburg', 'Polokwane', 'Mthatha',
    'Komani', 'Graaff-Reinet', 'Worcester', 'Oudtshoorn', 'Beaufort West', 'Sutherland', 'Upington', 'Kuruman'],
};

test('each of the 44 places lands on its audited calendar', () => {
  const got: Record<string, string[]> = { 'all-year': [], 'mild-frost': [], winter: [], summer: [] };
  for (const site of SITES) got[climateOf(site).pattern].push(site.name);
  for (const pattern of Object.keys(EXPECTED) as RainPattern[]) {
    assert.deepEqual(got[pattern].sort(), [...EXPECTED[pattern]].sort(), `places on '${pattern}'`);
  }
});

test('a hot Lowveld farm is on the frost-free calendar and still has summer rain', () => {
  // One setting used to answer both questions, so "frost-free" could only mean "rain all
  // year". Tank sizing reads rainSeason; if it read the calendar it would under-size the tank.
  for (const name of ['Komatipoort', 'Phalaborwa', 'Musina', 'Thohoyandou', 'Mkuze sample farm', 'Durban']) {
    const climate = climateOf(byName(name));
    assert.equal(climate.pattern, 'all-year', name);
    assert.equal(climate.rainSeason, 'summer', `${name}: rain timing must not follow the calendar name`);
  }
  assert.equal(climateOf(byName('George')).rainSeason, 'all-year');
  assert.equal(climateOf(byName('Sutherland')).pattern, 'summer');
  assert.equal(climateOf(byName('Sutherland')).rainSeason, 'all-year', 'hard frost with rain in both halves of the year');
});

test('a site just on the cold side of a line is told so, and the grower\'s own frost answer can move it one column', () => {
  // Mbombela: coldest month 15.9 °C against the 16 °C warm-winter line. The rule leans cold.
  const mbombela = climateOf(byName('Mbombela'));
  assert.equal(mbombela.pattern, 'mild-frost');
  assert.equal(mbombela.closeCall, 'all-year');
  assert.equal(mbombela.warmerNeighbour, 'all-year');
  assert.deepEqual(calendarForGrower(mbombela, 'no'), { pattern: 'all-year', basis: 'grower-frost' });
  assert.deepEqual(calendarForGrower(mbombela, 'unknown'), { pattern: 'mild-frost', basis: 'site-climate' });

  // The sample farm every visitor sees: hot-area by its readings, and one frost sighting
  // on the actual ground puts it back on the light-frost calendar.
  const mkuze = climateOf(byName('Mkuze sample farm'));
  assert.equal(mkuze.pattern, 'all-year');
  assert.deepEqual(calendarForGrower(mkuze, 'yes'), { pattern: 'mild-frost', basis: 'grower-frost' });

  // A grower's "no frost" never lifts a clear frost site: Johannesburg has no warmer neighbour.
  const johannesburg = climateOf(byName('Johannesburg'));
  assert.equal(johannesburg.warmerNeighbour, null);
  assert.deepEqual(calendarForGrower(johannesburg, 'no'), { pattern: 'summer', basis: 'site-climate' });
});

test('losing the record minimum never moves a place to a warmer calendar', () => {
  // A cached payload from before the record minimum was tagged, or a NASA outage, must lean
  // cold: a site may drop a column, never gain one on a mean alone.
  const rank: Record<RainPattern, number> = { summer: 0, 'mild-frost': 1, 'all-year': 2, winter: -1 };
  for (const site of SITES) {
    const withMinimum = climateOf(site).pattern;
    const without = climateOf(site, false).pattern;
    if (withMinimum === 'winter' || without === 'winter') { assert.equal(without, withMinimum, site.name); continue; }
    assert.ok(rank[without] <= rank[withMinimum], `${site.name}: '${without}' without a record minimum is warmer than '${withMinimum}' with it`);
  }
  assert.equal(climateOf(byName('Musina'), false).pattern, 'summer', 'an arid site with no frost evidence is not cleared of frost');
});

test('a missing-value marker in a stored payload is "no record minimum" at every place, and real cold readings are kept', () => {
  // Independent review of PR #1328 (comment 6762553064): the record-minimum helper checked
  // the provenance tag and then took any finite number, so NASA POWER's missing-value
  // marker (-999; the cleaning rule's cutoff is -900) was read as a record low of -999 °C.
  // Measured on this fixture before the fix: every one of the 44 places carried -999 as
  // its record low and printed "-999 °C" to the grower, and four (Durban, Richards Bay,
  // Komatipoort, Phalaborwa) were moved off the calendar their no-minimum reading gives.
  // A marker must behave exactly like a payload that carries no minimum at all.
  const withMinimum = (site: Site, minTemp: unknown) => {
    const base = payload(site, false);
    return siteClimateFromLocationData({ ...base, climate: { ...base.climate, minTemp, minTempSource: 'nasa-power' } }, site.lat);
  };
  for (const site of SITES) {
    const none = climateOf(site, false);
    assert.equal(none.recordMinC, null, site.name);
    for (const marker of [-999, -900, -901, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const marked = withMinimum(site, marker);
      assert.deepEqual(marked, none, `${site.name}: a ${marker} minimum must read as no minimum`);
      const reasons = sowingCalendarReasons(marked!, { pattern: marked!.pattern, basis: 'site-climate' }).join(' ');
      assert.doesNotMatch(reasons, /lowest temperature on record|-9\d\d|NaN|Infinity/, `${site.name}: the grower is shown a missing marker`);
    }
    // The place's own reading is untouched by the cleaning rule.
    assert.equal(climateOf(site).recordMinC, site.recordMinC, site.name);
  }

  // Frost and exactly zero are real readings, not missing ones.
  const frosty = SITES.filter((site) => site.recordMinC < 0);
  const zeroOrBelow = SITES.filter((site) => site.recordMinC <= 0);
  assert.ok(frosty.length >= 10, 'fixture: the set must hold real sub-zero record minimums');
  for (const site of zeroOrBelow) assert.equal(climateOf(site).recordMinC, site.recordMinC, site.name);
  const durban = byName('Durban');
  assert.equal(withMinimum(durban, 0)?.recordMinC, 0, 'a record minimum of exactly 0 °C is kept, not treated as missing');
  assert.equal(withMinimum(durban, -4)?.recordMinC, -4);
  assert.notEqual(withMinimum(durban, -4)?.pattern, 'all-year', 'a site whose record shows -4 °C is not given the frost-free calendar');
});
