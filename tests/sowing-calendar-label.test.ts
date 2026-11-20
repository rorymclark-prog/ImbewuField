import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOWING_CALENDAR_LABEL,
  sowingCalendarLabel,
  sowingCalendarReasons,
} from '@/lib/sowing-calendar-label';
import { calendarForGrower, type SiteClimate } from '@/lib/site-climate';
import { REGIONAL_RAINFALL, describeHarvest, nearestRainfall, referenceSowingCalendar } from '@/lib/water-calc';

function site(over: Partial<SiteClimate> = {}): SiteClimate {
  return {
    pattern: 'all-year',
    rainSeason: 'summer',
    closeCall: null,
    warmerNeighbour: null,
    coldestMonthC: 16.4,
    hottestMonthC: 26.6,
    recordMinC: 4.2,
    annualMm: 768,
    monthlyRainMm: [100, 90, 80, 50, 30, 15, 15, 20, 40, 70, 90, 100],
    monthlyTempC: [26, 26, 25, 22, 19, 17, 16, 18, 21, 23, 24, 26],
    koppen: 'Cwa',
    rainfallSource: 'nasa-power',
    ...over,
  };
}

test('a hot lowveld site is named a frost-free area with summer rain, not "All-year rainfall"', () => {
  assert.equal(sowingCalendarLabel('all-year', 'summer'), 'Hot area, no frost · summer rain');
  assert.doesNotMatch(sowingCalendarLabel('all-year', 'summer'), /All-year rainfall/i);
});

test('calendar labels name the frost regime and add the rain season only where it is not already said', () => {
  assert.equal(sowingCalendarLabel('summer', 'summer'), 'Winter frost · summer rain');
  assert.equal(sowingCalendarLabel('mild-frost', 'all-year'), 'Light frost at most · rain all year');
  // The winter-rainfall calendar already says its rain; a suffix would repeat it.
  assert.equal(sowingCalendarLabel('winter', 'winter'), 'Winter rainfall');
  assert.equal(sowingCalendarLabel('winter'), 'Winter rainfall');
  // No rain season known (no mapped site): the calendar label stands alone, no dangling " · ".
  assert.equal(sowingCalendarLabel('all-year'), 'Hot area, no frost');
  assert.equal(sowingCalendarLabel('all-year', null), 'Hot area, no frost');
});

test('the always-shown reason quotes the climate numbers and the record minimum to one decimal', () => {
  // This test asserted whole degrees ("16 °C", "27 °C", "4 °C") until 11 November 2026.
  // Finding CP-109: the calendar rule decides on the unrounded figure, so a record minimum
  // of 1.7 °C printed as "2 °C", the rule's own frost-free line. The readings carry one
  // decimal and now print it. The fixture's values are unchanged: 16.4, 26.6 and 4.2.
  const [a] = sowingCalendarReasons(site(), { pattern: 'all-year', basis: 'site-climate' });
  assert.match(a, /^Coldest month averages 16\.4 °C and hottest 26\.6 °C here\./);
  assert.match(a, / The lowest temperature on record for this area is 4\.2 °C\./);
  assert.match(a, /satellite-era climate records for the wider area, not a weather station on your land\.$/);
});

test('with no record minimum the reason does not claim one', () => {
  const [a] = sowingCalendarReasons(site({ recordMinC: null }), { pattern: 'all-year', basis: 'site-climate' });
  assert.doesNotMatch(a, /lowest temperature on record/);
});

test('a grower who has not seen frost is told the warmer calendar came from their survey, and what the records said', () => {
  const s = site({ pattern: 'summer', warmerNeighbour: 'mild-frost', closeCall: 'mild-frost' });
  const lines = sowingCalendarReasons(s, { pattern: 'mild-frost', basis: 'grower-frost' });
  assert.equal(lines.length, 2);
  assert.equal(
    lines[1],
    'Your site survey says you have not seen frost here, so this plan uses the "Light frost at most" calendar. The climate records alone would give "Winter frost".',
  );
  const lines2 = sowingCalendarReasons(
    site({ pattern: 'mild-frost', warmerNeighbour: 'all-year' }),
    { pattern: 'all-year', basis: 'grower-frost' },
  );
  assert.match(lines2[1], /have not seen frost here, so this plan uses the "Hot area, no frost" calendar\. The climate records alone would give "Light frost at most"\./);
});

test('a grower who has seen frost on a "no frost" site is told why the plan turned colder', () => {
  const lines = sowingCalendarReasons(site({ pattern: 'all-year' }), { pattern: 'mild-frost', basis: 'grower-frost' });
  assert.equal(
    lines[1],
    'Your site survey says you have seen frost here, so this plan uses the "Light frost at most" calendar. The climate records alone would give "Hot area, no frost".',
  );
});

test('a close call with a warmer neighbour tells the grower how to reach the warmer calendar', () => {
  const lines = sowingCalendarReasons(
    site({ pattern: 'summer', closeCall: 'mild-frost', warmerNeighbour: 'mild-frost' }),
    { pattern: 'summer', basis: 'site-climate' },
  );
  assert.equal(lines.length, 2);
  assert.equal(
    lines[1],
    'This site is close to the line for the "Light frost at most" calendar. If you have never seen frost on these beds, say so in the site survey and the plan will use the warmer calendar.',
  );
});

test('a hot site close to the light-frost line tells the grower to report frost', () => {
  const lines = sowingCalendarReasons(
    site({ pattern: 'all-year', closeCall: 'mild-frost', warmerNeighbour: null }),
    { pattern: 'all-year', basis: 'site-climate' },
  );
  assert.equal(
    lines[1],
    'This site is close to the line for the "Light frost at most" calendar. If frost does reach these beds, say so in the site survey and the plan will use the light-frost calendar.',
  );
});

test('any other close call falls back to checking sowing months locally', () => {
  const lines = sowingCalendarReasons(
    site({ pattern: 'mild-frost', closeCall: 'summer', warmerNeighbour: null }),
    { pattern: 'mild-frost', basis: 'site-climate' },
  );
  assert.equal(
    lines[1],
    'This site is close to the line for the "Winter frost" calendar. Check sowing months against what grows well near you.',
  );
});

test('a grower in the coldest places is warned that frost outlasts the calendar\'s August', () => {
  // CP-081: the hard-frost calendar assumes frost from May to August. Sutherland frosted in
  // September in 80% of years 2001-2020 and Underberg in 45%; both have a coldest month under 9 °C.
  const sutherland = site({ pattern: 'summer', rainSeason: 'all-year', coldestMonthC: 7.8, hottestMonthC: 22.3, recordMinC: -4.8 });
  const lines = sowingCalendarReasons(sutherland, { pattern: 'summer', basis: 'site-climate' });
  assert.ok(lines.some((line) => /Frost often lasts into September/.test(line) && /after your own last frost/.test(line)), lines.join('\n'));
  // Johannesburg (9.9 °C) frosted in September in one year in ten: no warning.
  const johannesburg = site({ pattern: 'summer', rainSeason: 'summer', coldestMonthC: 9.9, hottestMonthC: 21.6, recordMinC: -4.8 });
  assert.ok(!sowingCalendarReasons(johannesburg, { pattern: 'summer', basis: 'site-climate' }).some((line) => /September/.test(line)));
  // A frosty winter-rainfall valley (Ceres, 8.8 °C) is warned too; a hot or light-frost site never is.
  const ceres = site({ pattern: 'winter', rainSeason: 'winter', coldestMonthC: 8.8, hottestMonthC: 21.8, recordMinC: -2.3 });
  assert.ok(sowingCalendarReasons(ceres, { pattern: 'winter', basis: 'site-climate' }).some((line) => /September/.test(line)));
  for (const pattern of ['all-year', 'mild-frost'] as const) {
    assert.ok(!sowingCalendarReasons(site({ pattern, coldestMonthC: 8 }), { pattern, basis: 'site-climate' }).some((line) => /September/.test(line)));
  }
});

test('a clear-cut site gets only the climate line', () => {
  assert.equal(sowingCalendarReasons(site(), { pattern: 'all-year', basis: 'site-climate' }).length, 1);
});

test('no reason line ever shows "undefined", "null" or "NaN" to a grower', () => {
  const patterns = ['summer', 'mild-frost', 'all-year', 'winter'] as const;
  for (const p of patterns) {
    for (const closeCall of [null, ...patterns]) {
      for (const warmerNeighbour of [null, 'mild-frost' as const]) {
        for (const recordMinC of [null, -3.4, 7]) {
          for (const chosen of patterns) {
            for (const basis of ['site-climate', 'grower-frost'] as const) {
              const lines = sowingCalendarReasons(
                site({ pattern: p, closeCall, warmerNeighbour, recordMinC }),
                { pattern: chosen, basis },
              );
              for (const line of lines) assert.doesNotMatch(line, /undefined|null|NaN/);
            }
          }
        }
      }
    }
  }
  for (const p of patterns) assert.ok(SOWING_CALENDAR_LABEL[p].length > 0);
});

test('calendarForGrower: frost seen on a hot site moves the plan to light frost, on the grower\'s word', () => {
  assert.deepEqual(calendarForGrower({ pattern: 'all-year', warmerNeighbour: null }, 'yes'), { pattern: 'mild-frost', basis: 'grower-frost' });
});

test('calendarForGrower: no frost seen on a close-call site gives the warmer calendar', () => {
  assert.deepEqual(calendarForGrower({ pattern: 'summer', warmerNeighbour: 'mild-frost' }, 'no'), { pattern: 'mild-frost', basis: 'grower-frost' });
  assert.deepEqual(calendarForGrower({ pattern: 'mild-frost', warmerNeighbour: 'all-year' }, 'no'), { pattern: 'all-year', basis: 'grower-frost' });
});

test('calendarForGrower: "not sure" or no answer never changes the calendar', () => {
  for (const answer of ['unknown', undefined] as const) {
    assert.deepEqual(calendarForGrower({ pattern: 'all-year', warmerNeighbour: null }, answer), { pattern: 'all-year', basis: 'site-climate' });
    assert.deepEqual(calendarForGrower({ pattern: 'summer', warmerNeighbour: 'mild-frost' }, answer), { pattern: 'summer', basis: 'site-climate' });
  }
});

test('calendarForGrower: frost seen where the climate already says frost does not change anything', () => {
  assert.deepEqual(calendarForGrower({ pattern: 'summer', warmerNeighbour: 'mild-frost' }, 'yes'), { pattern: 'summer', basis: 'site-climate' });
  assert.deepEqual(calendarForGrower({ pattern: 'mild-frost', warmerNeighbour: null }, 'yes'), { pattern: 'mild-frost', basis: 'site-climate' });
});

test('calendarForGrower: no frost seen with no warmer neighbour does not skip a column', () => {
  assert.deepEqual(calendarForGrower({ pattern: 'summer', warmerNeighbour: null }, 'no'), { pattern: 'summer', basis: 'site-climate' });
});

test('the reference fallback never hands a far-away guess the frost-free hot-area calendar', () => {
  for (const region of REGIONAL_RAINFALL) {
    assert.notEqual(referenceSowingCalendar(region), 'all-year', region.name);
  }
});

test('reference fallback: Karoo is hard-frost, Eastern Cape coast and Durban are light-frost, Cape Town is winter, no site is hard-frost-free by guesswork', () => {
  const byName = (re: RegExp) => REGIONAL_RAINFALL.find((r) => re.test(r.name));
  const karoo = byName(/karoo/i);
  assert.ok(karoo);
  assert.equal(referenceSowingCalendar(karoo), 'summer');
  const ec = REGIONAL_RAINFALL.find((r) => r.name === 'Eastern Cape coast');
  assert.ok(ec);
  assert.equal(referenceSowingCalendar(ec), 'mild-frost');
  assert.equal(referenceSowingCalendar(nearestRainfall(-29.86, 31.02)), 'mild-frost');
  assert.equal(referenceSowingCalendar(nearestRainfall(-33.93, 18.42)), 'winter');
  assert.equal(referenceSowingCalendar(null), 'summer');
});

test('a hot summer-rain site gets the same tank as a summer-rain site, and more than a rain-all-year one', () => {
  const annualMm = 768;
  const args = [120, -27.73, 31.96] as const;
  const hot = describeHarvest(...args, { annualMm, pattern: 'all-year', rainSeason: 'summer' });
  const summer = describeHarvest(...args, { annualMm, pattern: 'summer' });
  const evenRain = describeHarvest(...args, { annualMm, pattern: 'all-year', rainSeason: 'all-year' });
  assert.ok(hot && summer && evenRain);
  assert.equal(hot.recommendedTank, summer.recommendedTank);
  assert.ok(hot.recommendedTank > evenRain.recommendedTank);
});
