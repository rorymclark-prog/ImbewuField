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

// Missing wind becomes a compatibility zero; only a cleaned provider reading earns provenance.
// Temperature coverage is deliberately independent: a partial wind estimate can still be useful.
test('wind provenance distinguishes absent defaults from partial readings and measured calm', async () => {
  for (const [wind, expected, tagged] of [
    [{ JAN: 4, FEB: -999 }, 4, true],
    [{ JAN: 0 }, 0, true],
    [{ JAN: -999, FEB: -1 }, 0, false],
    [{}, 0, false],
  ] as const) {
    await withFetch(async (input) => String(input).includes('power.larc.nasa.gov')
      ? response(nasaPayload({ WS2M: wind, T2M: {} }))
      : response({}, false, 503), async () => {
      const { climate, rainfall } = await fetchNasaPower(-26.2, 28.05);
      assert.equal(climate.windSpeed, expected);
      assert.equal(climate.windSource, tagged ? 'nasa-power' : undefined);
      assert.equal(climate.monthlyTempCoverage?.status, 'incomplete');
      assert.equal(rainfall.rainfallSource, 'nasa-power');
      assert.ok(rainfall.annual > 0);
    });
  }
});
