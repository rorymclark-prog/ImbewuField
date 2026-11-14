import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchNasaPower,
  fetchOpenMeteoRainfall,
  monthlyNormalsFromDailyRainfall,
} from '../lib/nasa-power.ts';

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function monthValues(value: number): Record<string, number> {
  return Object.fromEntries(MONTH_KEYS.map((month) => [month, value]));
}

function nasaPayload(overrides: Record<string, Record<string, number>> = {}) {
  return {
    properties: {
      parameter: {
        PRECTOTCORR: monthValues(1),
        T2M: monthValues(18),
        T2M_MAX: monthValues(28),
        T2M_MIN: monthValues(8),
        ALLSKY_SFC_SW_DWN: monthValues(18),
        WS2M: monthValues(3),
        WD10M: monthValues(90),
        ...overrides,
      },
    },
  };
}

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function dailySeries(
  startYear: number,
  endYear: number,
  value: number,
): { dates: string[]; values: number[] } {
  const dates: string[] = [];
  const values: number[] = [];
  const cursor = new Date(Date.UTC(startYear, 0, 1));
  const end = new Date(Date.UTC(endYear, 11, 31));
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    values.push(value);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { dates, values };
}

async function withFetch<T>(
  replacement: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = replacement;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('one mm per day becomes the calendar number of mm in each complete month', () => {
  const { dates, values } = dailySeries(2021, 2022, 1);
  const monthly = monthlyNormalsFromDailyRainfall(dates, values);
  assert.ok(monthly);

  for (let month = 0; month < 12; month++) {
    const calendarDays = new Date(Date.UTC(2021, month + 1, 0)).getUTCDate();
    assert.equal(monthly[month], calendarDays);
  }
});

test('a partial Open-Meteo history is rejected rather than averaged as missing rain', () => {
  const complete = dailySeries(2021, 2022, 1);
  const missingDayDates = complete.dates.filter((_, index) => index !== 100);
  const missingDayValues = complete.values.filter((_, index) => index !== 100);
  assert.equal(monthlyNormalsFromDailyRainfall(missingDayDates, missingDayValues), null);
  assert.equal(monthlyNormalsFromDailyRainfall(complete.dates.slice(0, -31), complete.values.slice(0, -31)), null);
  assert.equal(monthlyNormalsFromDailyRainfall(complete.dates, complete.values.slice(1)), null);
});

test('invalid daily precipitation never creates a finite-looking monthly normal', () => {
  const complete = dailySeries(2021, 2021, 1);
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    null,
    undefined,
  ]) {
    const values: unknown[] = [...complete.values];
    values[50] = invalid;
    assert.equal(monthlyNormalsFromDailyRainfall(complete.dates, values), null);
  }
  assert.equal(
    monthlyNormalsFromDailyRainfall(complete.dates, complete.values.map(() => Number.MAX_VALUE)),
    null,
  );
  assert.equal(
    monthlyNormalsFromDailyRainfall(
      [2021 as unknown as string, ...complete.dates.slice(1)],
      complete.values,
    ),
    null,
  );
});

test('Open-Meteo outage, bad status and partial payload all return null', async () => {
  await withFetch(
    (async () => { throw new Error('offline'); }) as typeof fetch,
    async () => assert.equal(await fetchOpenMeteoRainfall(-29, 31), null),
  );
  await withFetch(
    (async () => response({}, false, 503)) as typeof fetch,
    async () => assert.equal(await fetchOpenMeteoRainfall(-29, 31), null),
  );
  await withFetch(
    (async () => response({
      daily_units: { time: 'iso8601', precipitation_sum: 'mm' },
      daily: {
        time: ['1991-01-01', '1991-01-02'],
        precipitation_sum: [1, 1],
      },
    })) as typeof fetch,
    async () => assert.equal(await fetchOpenMeteoRainfall(-29, 31), null),
  );
});

test('NASA daily climatology is multiplied by each month length before annual sum', async () => {
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload())
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  for (let month = 0; month < 12; month++) {
    const calendarDays = new Date(Date.UTC(2021, month + 1, 0)).getUTCDate();
    assert.equal(result.rainfall.monthly[month], calendarDays);
  }
  assert.equal(
    result.rainfall.annual,
    result.rainfall.monthly.reduce((sum, mm) => sum + mm, 0),
  );
  assert.equal(result.rainfall.rainfallSource, 'nasa-power');
  assert.equal(result.climate.minTempSource, 'nasa-power');
});

test('a missing monthly minimum cannot be stamped as evidence that a site is warm', async () => {
  const incomplete = monthValues(-1.9);
  delete incomplete.JUL;
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload({ T2M_MIN: incomplete }))
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-23.9, 29.45),
  );
  assert.equal(result.climate.minTempSource, undefined,
    'the fallback numeric minimum must never count as a complete frost reading');
});

test('both climate requests carry bounded abort signals', async () => {
  const signals: AbortSignal[] = [];
  await withFetch(
    (async (_input, init) => {
      assert.ok(init?.signal instanceof AbortSignal);
      signals.push(init.signal);
      return signals.length === 1
        ? response(nasaPayload())
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => !signal.aborted));
});

test('missing or sentinel NASA rainfall months reject instead of becoming zero-rain months', async () => {
  const partial = monthValues(1);
  delete partial.FEB;
  for (const precipitation of [
    partial,
    { ...monthValues(1), FEB: -999 },
    { ...monthValues(1), FEB: Number.NaN },
    { ...monthValues(1), FEB: Number.POSITIVE_INFINITY },
    { ...monthValues(1), FEB: Number.MAX_VALUE },
  ]) {
    await withFetch(
      (async () => response(nasaPayload({ PRECTOTCORR: precipitation }))) as typeof fetch,
      async () => assert.rejects(
        fetchNasaPower(-29, 31),
        /incomplete.*rainfall/i,
      ),
    );
  }
});

test('March rainfall cannot be misclassified as austral summer DJF rain', async () => {
  const precipitation = monthValues(1);
  precipitation.MAR = 100;
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload({ PRECTOTCORR: precipitation }))
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  assert.equal(result.rainfall.pattern, 'year-round');
});

test('a partial Open-Meteo response leaves complete NASA rainfall in charge', async () => {
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload())
        : response({
          daily_units: { time: 'iso8601', precipitation_sum: 'mm' },
          daily: {
            time: ['1991-01-01', '1991-01-02'],
            precipitation_sum: [20, 20],
          },
        });
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  assert.equal(result.rainfall.rainfallSource, 'nasa-power');
  assert.ok(result.rainfall.monthly.every(Number.isFinite));
});

test('a complete, materially different Open-Meteo normal can replace coarse NASA rainfall', async () => {
  const openMeteo = dailySeries(1991, 2020, 10);
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload())
        : response({
          daily_units: { time: 'iso8601', precipitation_sum: 'mm' },
          daily: {
            time: openMeteo.dates,
            precipitation_sum: openMeteo.values,
          },
        });
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  assert.equal(result.rainfall.rainfallSource, 'open-meteo');
  assert.deepEqual(
    result.rainfall.monthly,
    monthlyNormalsFromDailyRainfall(openMeteo.dates, openMeteo.values),
  );
});

test('missing wind directions stay unknown rather than averaging sentinels to north', async () => {
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload({ WD10M: monthValues(-999) }))
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  assert.equal(result.climate.windFromSummer, '—');
  assert.equal(result.climate.windFromWinter, '—');
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
});

test('negative wind and solar values and out-of-domain directions stay unavailable', async () => {
  let calls = 0;
  const result = await withFetch(
    (async () => {
      calls += 1;
      return calls === 1
        ? response(nasaPayload({
          ALLSKY_SFC_SW_DWN: monthValues(-1),
          WS2M: monthValues(-1),
          WD10M: monthValues(361),
        }))
        : response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );

  assert.equal(result.climate.solarRadiation, 0);
  assert.equal(result.climate.windSpeed, 0);
  assert.equal(result.climate.windFromSummer, '—');
  assert.equal(result.climate.windFromWinter, '—');
});

test('a malformed NASA payload fails with a stable data error', async () => {
  await withFetch(
    (async () => response({ properties: {} })) as typeof fetch,
    async () => assert.rejects(fetchNasaPower(-29, 31), /climate data/i),
  );
});

test('invalid coordinates are rejected before spending a network request', async () => {
  let called = false;
  await withFetch(
    (async () => {
      called = true;
      return response(nasaPayload());
    }) as typeof fetch,
    async () => {
      assert.equal(await fetchOpenMeteoRainfall(Number.NaN, 31), null);
      await assert.rejects(fetchNasaPower(-29, Number.POSITIVE_INFINITY), /coordinates/i);
    },
  );
  assert.equal(called, false);
});

async function fetchMonthlyMeanFixture(means: unknown, minima: unknown = monthValues(8)) {
  const payload = nasaPayload();
  const parameters: Record<string, unknown> = payload.properties.parameter;
  parameters.T2M = means;
  parameters.T2M_MIN = minima;
  let requests = 0;
  const result = await withFetch(
    (async (input) => {
      requests++;
      const url = new URL(String(input));
      if (url.hostname === 'power.larc.nasa.gov') return response(payload);
      assert.equal(url.hostname, 'archive-api.open-meteo.com', 'only the two existing provider boundaries are used');
      return response({}, false, 503);
    }) as typeof fetch,
    () => fetchNasaPower(-29, 31),
  );
  assert.equal(requests, 2);
  return result;
}

test('complete raw monthly means retain cold and zero values and carry their own coverage', async () => {
  const result = await fetchMonthlyMeanFixture({ ...monthValues(18), JAN: -5, FEB: 0, ANN: 18 });
  assert.deepEqual(result.climate.monthlyTempCoverage, { source: 'nasa-power', status: 'complete' });
  assert.deepEqual(result.climate.monthlyTemp, [-5, 0, ...Array(10).fill(18)]);
  assert.equal(result.climate.meanTemp, 14.6);
  assert.equal(result.climate.minTempSource, 'nasa-power');
  assert.equal(result.climate.minTemp, 8);
});

test('missing or invalid monthly means cannot acquire coverage from the unchanged display fill or complete minima', async () => {
  // A supplied value equal to the display fill and an absent value can look
  // identical on screen. Only the raw supplied month may carry complete coverage.
  const control = await fetchMonthlyMeanFixture({ ...monthValues(18), JAN: 20 });
  const { monthlyTempCoverage: controlCoverage, ...displayControl } = control.climate;
  assert.deepEqual(controlCoverage, { source: 'nasa-power', status: 'complete' });
  const missing = monthValues(18); delete missing.JAN;
  const invalidMeans: unknown[] = [missing, ...[
    -999, -900, null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '18', false,
  ].map(JAN => ({ ...monthValues(18), JAN }))];
  for (const means of invalidMeans) {
    const result = await fetchMonthlyMeanFixture(means);
    const { monthlyTempCoverage, ...display } = result.climate;
    assert.deepEqual(monthlyTempCoverage, { source: 'nasa-power', status: 'incomplete' });
    assert.deepEqual(display, displayControl, 'coverage must not alter any existing display fallback or reduction');
    assert.deepEqual(result.rainfall, control.rainfall, 'mean coverage must not alter rainfall selection or values');
    assert.equal(result.climate.minTempSource, 'nasa-power', 'complete minimum readings stay independent');
  }
});

test('sparse arrays, annual-only data and wrong month-key shapes stay incomplete rather than pretending to be monthly records', async () => {
  const sparse = new Array<number>(12); sparse[0] = 18;
  const wrongKeys = Object.fromEntries(MONTH_KEYS.map(key => [key.toLowerCase(), 18]));
  for (const means of [undefined, null, [], sparse, Array(12).fill(18), { ANN: 18 }, wrongKeys, 'monthly means']) {
    const result = await fetchMonthlyMeanFixture(means);
    assert.deepEqual(result.climate.monthlyTempCoverage, { source: 'nasa-power', status: 'incomplete' });
    assert.deepEqual(result.climate.monthlyTemp, Array(12).fill(20), 'existing absent-record numeric display remains unchanged');
    assert.equal(result.climate.meanTemp, 20);
    assert.equal(result.climate.minTempSource, 'nasa-power');
  }
});

test('complete monthly means do not stamp absent monthly minimum readings as frost evidence', async () => {
  const missingMinimum = monthValues(8); delete missingMinimum.JAN;
  const partial = await fetchMonthlyMeanFixture(monthValues(18), missingMinimum);
  assert.deepEqual(partial.climate.monthlyTempCoverage, { source: 'nasa-power', status: 'complete' });
  assert.equal(partial.climate.minTempSource, undefined);
  assert.equal(partial.climate.minTemp, 8);
  const absent = await fetchMonthlyMeanFixture(monthValues(18), monthValues(-999));
  assert.deepEqual(absent.climate.monthlyTempCoverage, { source: 'nasa-power', status: 'complete' });
  assert.equal(absent.climate.minTempSource, undefined);
  assert.equal(absent.climate.minTemp, 5, 'the existing numeric minimum fallback stays unchanged');
});

// ── Hardening from the 11 November 2026 reviews (Argon ISS-04/ISS-05, Codex CBR-02).
// Record: docs/audits/2026-11-14/nasa-power-hardening-claude.md

/** The shape Open-Meteo's archive actually returns (checked against the 118 raw
 *  responses archived under docs/audits/2026-11-1x): units sit beside the series. */
const NO_UNITS_BLOCK = Symbol('no daily_units block');
function openMeteoArchive(dates: string[], values: unknown[], units: unknown = { time: 'iso8601', precipitation_sum: 'mm' }) {
  return {
    ...(units === NO_UNITS_BLOCK ? {} : { daily_units: units }),
    daily: { time: dates, precipitation_sum: values },
  };
}

test('a rainfall record that states inches, another unit or no unit is refused, so NASA POWER rainfall stays', async () => {
  // Ten a day, every day for thirty years: complete in every date, finite and
  // non-negative. Read as mm it is ~3,650 mm a year and replaces NASA's 365 mm. If the
  // series is in inches, the real rain is 25.4 times more. Completeness cannot tell the
  // two apart; only the stated unit can.
  const series = dailySeries(1991, 2020, 10);
  const refused: unknown[] = [
    NO_UNITS_BLOCK,                              // no daily_units block at all
    { time: 'iso8601' },                         // block present, rainfall unit absent
    {},                                          // empty block
    { time: 'iso8601', precipitation_sum: 'inch' },
    { time: 'iso8601', precipitation_sum: 'in' },
    { time: 'iso8601', precipitation_sum: 'MM' },
    { time: 'iso8601', precipitation_sum: '' },
    { time: 'iso8601', precipitation_sum: null },
    'mm',                                        // a bare string where an object belongs
  ];
  for (const units of refused) {
    const body = openMeteoArchive(series.dates, series.values, units);
    await withFetch(
      (async () => response(body)) as typeof fetch,
      async () => assert.equal(await fetchOpenMeteoRainfall(-29, 31), null, `units ${String(JSON.stringify(units) ?? 'block absent')} must be refused`),
    );
    let calls = 0;
    const result = await withFetch(
      (async () => (++calls === 1 ? response(nasaPayload()) : response(body))) as typeof fetch,
      () => fetchNasaPower(-29, 31),
    );
    assert.equal(result.rainfall.rainfallSource, 'nasa-power', `units ${String(JSON.stringify(units) ?? 'block absent')} must leave NASA POWER in charge`);
    assert.equal(result.rainfall.annual, 365);
  }
  // Control: the same series stating mm is still accepted, so the refusal above is the unit.
  await withFetch(
    (async () => response(openMeteoArchive(series.dates, series.values))) as typeof fetch,
    async () => assert.ok(await fetchOpenMeteoRainfall(-29, 31)),
  );
});

test('the rainfall request leaves model and grid-cell choice to the provider until a measured decision changes it', async () => {
  // Not a fix: a tripwire. Pinning a model changes the rainfall growers see, so it must
  // arrive with a before/after comparison on the recorded places and Rory's decision,
  // not as a one-line parameter. If this fails, that comparison belongs in the same PR.
  const urls: URL[] = [];
  await withFetch(
    (async (input) => { urls.push(new URL(String(input))); return response({}, false, 503); }) as typeof fetch,
    () => fetchOpenMeteoRainfall(-29, 31),
  );
  assert.equal(urls.length, 1);
  assert.equal(urls[0].searchParams.has('models'), false);
  assert.equal(urls[0].searchParams.has('cell_selection'), false);
  assert.equal(urls[0].searchParams.get('daily'), 'precipitation_sum');
});

async function patternAt(lat: number, precipitation: Record<string, number>) {
  let calls = 0;
  const result = await withFetch(
    (async () => (++calls === 1 ? response(nasaPayload({ PRECTOTCORR: precipitation })) : response({}, false, 503))) as typeof fetch,
    () => fetchNasaPower(lat, 10),
  );
  return result.rainfall;
}

test('north of the equator, rain in December to February is winter rain, not summer rain', async () => {
  const decToFeb = { ...monthValues(0.5), DEC: 4, JAN: 4, FEB: 4 };
  const junToAug = { ...monthValues(0.5), JUN: 4, JUL: 4, AUG: 4 };

  // A Mediterranean-type northern site: wet Dec–Feb is its winter.
  const north = await patternAt(38, decToFeb);
  assert.equal(north.pattern, 'winter');
  // The month ranges name calendar months and were already right; they must not move.
  assert.equal(north.wetSeason, 'Oct–Mar');
  assert.equal(north.drySeason, 'May–Aug');

  // A northern monsoon site: wet Jun–Aug is its summer.
  const monsoon = await patternAt(20, junToAug);
  assert.equal(monsoon.pattern, 'summer');
  assert.equal(monsoon.wetSeason, 'May–Sep');
  assert.equal(monsoon.drySeason, 'Nov–Mar');

  // South Africa is unchanged, word for word.
  const south = await patternAt(-29, decToFeb);
  assert.deepEqual([south.pattern, south.wetSeason, south.drySeason], ['summer', 'Oct–Mar', 'May–Aug']);
  const cape = await patternAt(-34, junToAug);
  assert.deepEqual([cape.pattern, cape.wetSeason, cape.drySeason], ['winter', 'May–Sep', 'Nov–Mar']);

  // The equator takes the classifier's tie (summerMonthIndices: lat >= 0 is northern).
  assert.equal((await patternAt(0, decToFeb)).pattern, 'winter');
});
