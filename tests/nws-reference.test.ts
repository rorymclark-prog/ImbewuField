import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeNwsReference,
  type NwsReferenceProvenance,
} from '@/lib/international/providers/nws-reference';

const VALID_PROVENANCE: NwsReferenceProvenance = {
  providerId: 'nws-forecast-reference',
  fetchedAt: '2026-11-04T23:24:28.400Z',
  endpoint: 'https://api.weather.gov/gridpoints/LWX/98,72/forecast?units=si',
  demoPlace: 'Washington public coarse demo',
  referenceOnly: true,
};

function createValidSyntheticFeature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'Feature',
    properties: {
      units: 'si',
      generatedAt: '2026-11-04T23:24:28+00:00',
      updateTime: '2026-11-04T20:53:33+00:00',
      validTimes: '2026-11-04T14:00:00+00:00/P7DT11H',
      periods: [
        {
          number: 1,
          name: 'Tonight',
          startTime: '2026-11-04T18:00:00-05:00',
          endTime: '2026-11-05T06:00:00-05:00',
          isDaytime: false,
          temperature: 18,
          temperatureUnit: 'C',
          probabilityOfPrecipitation: {
            unitCode: 'wmoUnit:percent',
            value: 23,
          },
          shortForecast: 'Mostly Cloudy',
          detailedForecast: 'Mostly cloudy with a low around 18.',
        },
        {
          number: 2,
          name: 'Thursday',
          startTime: '2026-11-05T06:00:00-05:00',
          endTime: '2026-11-05T18:00:00-05:00',
          isDaytime: true,
          temperature: 24,
          temperatureUnit: 'C',
          probabilityOfPrecipitation: {
            unitCode: 'wmoUnit:percent',
            value: 41,
          },
          shortForecast: 'Chance Rain',
          detailedForecast: 'Chance of rain with a high near 24.',
        },
      ],
      ...overrides,
    },
  };
}

// -----------------------------------------------------------------------------
// Existing 16 test cases preserved intact
// -----------------------------------------------------------------------------

test('decodeNwsReference decodes valid legacy integer C payload as available', () => {
  const payload = createValidSyntheticFeature();
  const result = decodeNwsReference(payload, VALID_PROVENANCE);

  assert.equal(result.status, 'available');
  if (result.status !== 'available') return;
  assert.equal(result.units, 'C');
  assert.equal(result.metadata.sourceUnits, 'si');
  assert.equal(result.metadata.generatedAt, '2026-11-04T23:24:28+00:00');
  assert.equal(result.metadata.updateTime, '2026-11-04T20:53:33+00:00');
  assert.equal(result.metadata.validTimes, '2026-11-04T14:00:00+00:00/P7DT11H');
  assert.equal(result.periods.length, 2);
  assert.equal(result.periods[0].number, 1);
  assert.equal(result.periods[0].temperatureC, 18);
  assert.equal(result.periods[0].precipitationPercent, 23);
  assert.equal(result.periods[1].number, 2);
  assert.equal(result.periods[1].temperatureC, 24);
  assert.equal(result.periods[1].precipitationPercent, 41);
  assert.equal(result.provenance.providerId, 'nws-forecast-reference');
});

test('decodeNwsReference preserves fractional QuantitativeValue temperature exactly', () => {
  const payload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Tonight',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        isDaytime: false,
        temperature: {
          unitCode: 'wmoUnit:degC',
          value: 17.77777777777778,
        },
        probabilityOfPrecipitation: {
          unitCode: 'wmoUnit:percent',
          value: 0,
        },
        shortForecast: 'Partly Cloudy',
        detailedForecast: 'Partly cloudy with low near 18.',
      },
    ],
  });

  const result = decodeNwsReference(payload, VALID_PROVENANCE);
  assert.equal(result.status, 'available');
  if (result.status !== 'available') return;
  assert.equal(result.periods[0].temperatureC, 17.77777777777778);
  assert.equal(result.periods[0].precipitationPercent, 0);
});

test('decodeNwsReference accepts non-contiguous strictly increasing period numbers (e.g. 3..16)', () => {
  const payload = createValidSyntheticFeature({
    periods: [
      {
        number: 3,
        name: 'Period 3',
        startTime: '2026-11-05T06:00:00-05:00',
        endTime: '2026-11-05T18:00:00-05:00',
        isDaytime: true,
        temperature: 15,
        temperatureUnit: 'C',
        probabilityOfPrecipitation: {
          unitCode: 'wmoUnit:percent',
          value: 10,
        },
        shortForecast: 'Sunny',
        detailedForecast: 'Sunny day.',
      },
      {
        number: 16,
        name: 'Period 16',
        startTime: '2026-11-05T18:00:00-05:00',
        endTime: '2026-11-06T06:00:00-05:00',
        isDaytime: false,
        temperature: 8,
        temperatureUnit: 'C',
        probabilityOfPrecipitation: {
          unitCode: 'wmoUnit:percent',
          value: 5,
        },
        shortForecast: 'Clear',
        detailedForecast: 'Clear night.',
      },
    ],
  });

  const result = decodeNwsReference(payload, VALID_PROVENANCE);
  assert.equal(result.status, 'available');
  if (result.status !== 'available') return;
  assert.equal(result.periods.length, 2);
  assert.equal(result.periods[0].number, 3);
  assert.equal(result.periods[1].number, 16);
});

test('decodeNwsReference rejects float in legacy integer temperature branch', () => {
  const payload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Tonight',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: 18.5,
        temperatureUnit: 'C',
      },
    ],
  });

  const result = decodeNwsReference(payload, VALID_PROVENANCE);
  assert.equal(result.status, 'failed');
  assert.match((result as { reason: string }).reason, /must be an integer/);
});

test('decodeNwsReference rejects conflicting or present wrong units even if metric is null or QV', () => {
  // Conflicting legacy temperatureUnit F with valid QVdegC
  const conflictingUnits = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Tonight',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: {
          unitCode: 'wmoUnit:degC',
          value: 15,
        },
        temperatureUnit: 'F',
      },
    ],
  });
  assert.equal(decodeNwsReference(conflictingUnits, VALID_PROVENANCE).status, 'failed');

  // Null temperature but wrong legacy unit F
  const nullWithWrongUnit = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Tonight',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: null,
        temperatureUnit: 'F',
      },
    ],
  });
  assert.equal(decodeNwsReference(nullWithWrongUnit, VALID_PROVENANCE).status, 'failed');
});

test('decodeNwsReference accepts all three concrete ISO validTimes interval forms', () => {
  // Form 1: <start>/<end>
  const form1 = createValidSyntheticFeature({ validTimes: '2026-11-04T14:00:00+00:00/2026-11-11T01:00:00+00:00' });
  assert.equal(decodeNwsReference(form1, VALID_PROVENANCE).status, 'available');

  // Form 2: <start>/<duration>
  const form2 = createValidSyntheticFeature({ validTimes: '2026-11-04T14:00:00+00:00/P7DT11H' });
  assert.equal(decodeNwsReference(form2, VALID_PROVENANCE).status, 'available');

  // Form 3: <duration>/<end>
  const form3 = createValidSyntheticFeature({ validTimes: 'P7DT11H/2026-11-11T01:00:00+00:00' });
  assert.equal(decodeNwsReference(form3, VALID_PROVENANCE).status, 'available');
});

test('decodeNwsReference normalises finite -0 to 0 for temperature and precipitation', () => {
  const payload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Zero Test',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: -0,
        temperatureUnit: 'C',
        probabilityOfPrecipitation: {
          unitCode: 'wmoUnit:percent',
          value: -0,
        },
      },
    ],
  });

  const result = decodeNwsReference(payload, VALID_PROVENANCE);
  assert.equal(result.status, 'partial'); // missing descriptions/daytime
  if (result.status !== 'partial') return;
  assert.equal(Object.is(result.periods[0].temperatureC, 0), true);
  assert.equal(Object.is(result.periods[0].precipitationPercent, 0), true);
});

test('decodeNwsReference audits provenance and rejects invalid fetchedAt or throwing getters safely', () => {
  // Invalid fetchedAt
  const badProv = { ...VALID_PROVENANCE, fetchedAt: 'not-a-date' };
  assert.equal(decodeNwsReference(createValidSyntheticFeature(), badProv).status, 'failed');

  // Throwing provenance getter
  let getterRan = 0;
  const throwingProv = {
    get providerId() {
      getterRan++;
      throw new Error('Provenance getter exploded');
    },
    fetchedAt: '2026-11-04T23:24:28.400Z',
    endpoint: 'https://api.weather.gov/gridpoints/LWX/98,72/forecast?units=si',
    demoPlace: 'Washington public coarse demo',
    referenceOnly: true as const,
  };
  const res = decodeNwsReference(createValidSyntheticFeature(), throwingProv as unknown as NwsReferenceProvenance);
  assert.equal(res.status, 'failed');
  assert.equal(getterRan, 0, 'No caller getters on provenance were executed');
});

test('decodeNwsReference does not throw when encountering objects without toString in error paths', () => {
  const hostileUnitPayload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: {
          unitCode: Object.create(null, {
            toString: { value: null },
            valueOf: { value: null },
          }),
          value: 15,
        },
      },
    ],
  });

  assert.doesNotThrow(() => {
    const res = decodeNwsReference(hostileUnitPayload, VALID_PROVENANCE);
    assert.equal(res.status, 'failed');
  });
});

test('decodeNwsReference reads own data properties and ignores inherited prototype values', () => {
  // Malicious property on Object.prototype must not satisfy required unitCode check
  const originalDesc = Object.getOwnPropertyDescriptor(Object.prototype, 'unitCode');
  try {
    Object.defineProperty(Object.prototype, 'unitCode', {
      value: 'wmoUnit:percent',
      configurable: true,
    });

    const missingOwnUnitPayload = createValidSyntheticFeature({
      periods: [
        {
          number: 1,
          startTime: '2026-11-04T18:00:00-05:00',
          endTime: '2026-11-05T06:00:00-05:00',
          temperature: 15,
          temperatureUnit: 'C',
          probabilityOfPrecipitation: {
            value: 20,
            // unitCode deliberately missing on own object
          },
        },
      ],
    });

    const res = decodeNwsReference(missingOwnUnitPayload, VALID_PROVENANCE);
    assert.equal(res.status, 'failed');
  } finally {
    if (originalDesc) {
      Object.defineProperty(Object.prototype, 'unitCode', originalDesc);
    } else {
      delete (Object.prototype as Record<string, unknown>).unitCode;
    }
  }
});

test('decodeNwsReference rejects duplicate or decreasing period numbers', () => {
  const duplicates = createValidSyntheticFeature({
    periods: [
      {
        number: 5,
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: 15,
        temperatureUnit: 'C',
      },
      {
        number: 5,
        startTime: '2026-11-05T06:00:00-05:00',
        endTime: '2026-11-05T18:00:00-05:00',
        temperature: 16,
        temperatureUnit: 'C',
      },
    ],
  });
  assert.equal(decodeNwsReference(duplicates, VALID_PROVENANCE).status, 'failed');

  const decreasing = createValidSyntheticFeature({
    periods: [
      {
        number: 8,
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: 15,
        temperatureUnit: 'C',
      },
      {
        number: 4,
        startTime: '2026-11-05T06:00:00-05:00',
        endTime: '2026-11-05T18:00:00-05:00',
        temperature: 16,
        temperatureUnit: 'C',
      },
    ],
  });
  assert.equal(decodeNwsReference(decreasing, VALID_PROVENANCE).status, 'failed');
});

test('decodeNwsReference marks explicit null optional fields as partial status', () => {
  const explicitNullsPayload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: null,
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        isDaytime: null,
        temperature: 18,
        temperatureUnit: 'C',
        probabilityOfPrecipitation: {
          unitCode: 'wmoUnit:percent',
          value: 23,
        },
        shortForecast: null,
        detailedForecast: null,
      },
    ],
  });

  const res = decodeNwsReference(explicitNullsPayload, VALID_PROVENANCE);
  assert.equal(res.status, 'partial');
  if (res.status !== 'partial') return;
  assert.equal(res.periods[0].name, null);
  assert.equal(res.periods[0].isDaytime, null);
  assert.equal(res.periods[0].shortForecast, null);
  assert.equal(res.periods[0].detailedForecast, null);
  assert.equal(res.periods[0].temperatureC, 18);
  assert.equal(res.periods[0].precipitationPercent, 23);
});

test('decodeNwsReference rejects present temperatureUnit:null even with valid QVdegC', () => {
  const nullUnitWithQV = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        temperature: {
          unitCode: 'wmoUnit:degC',
          value: 17.5,
        },
        temperatureUnit: null,
      },
    ],
  });

  const res = decodeNwsReference(nullUnitWithQV, VALID_PROVENANCE);
  assert.equal(res.status, 'failed');
  assert.match((res as { reason: string }).reason, /Unsupported, null, or conflicting/);
});

test('decodeNwsReference accepts compact numeric offsets in ISO8601Interval (+0000)', () => {
  const compactOffsetsPayload = createValidSyntheticFeature({
    validTimes: '2026-11-04T14:00:00+0000/2026-11-11T01:00:00-0500',
  });
  const res = decodeNwsReference(compactOffsetsPayload, VALID_PROVENANCE);
  assert.equal(res.status, 'available');
  if (res.status !== 'available') return;
  assert.equal(res.metadata.validTimes, '2026-11-04T14:00:00+0000/2026-11-11T01:00:00-0500');
});

test('decodeNwsReference rejects unsupported duration grammar (e.g. P1W weeks or fractional PT1.5S)', () => {
  const weeksDuration = createValidSyntheticFeature({
    validTimes: '2026-11-04T14:00:00+00:00/P1W',
  });
  assert.equal(decodeNwsReference(weeksDuration, VALID_PROVENANCE).status, 'failed');

  const fractionalDuration = createValidSyntheticFeature({
    validTimes: '2026-11-04T14:00:00+00:00/PT1.5S',
  });
  assert.equal(decodeNwsReference(fractionalDuration, VALID_PROVENANCE).status, 'failed');
});

test('decodeNwsReference table-driven validation for envelope and metadata', () => {
  const table = [
    { name: 'null root', input: null },
    { name: 'array root', input: [] },
    { name: 'wrong envelope type', input: { type: 'Point', properties: {} } },
    { name: 'missing properties', input: { type: 'Feature' } },
    { name: 'empty periods', input: createValidSyntheticFeature({ periods: [] }) },
    { name: 'bad generatedAt date', input: createValidSyntheticFeature({ generatedAt: '2026-02-29T12:00:00Z' }) }, // 2026 not leap year
    { name: 'bad updateTime format', input: createValidSyntheticFeature({ updateTime: 'not-a-date' }) },
  ];

  for (const entry of table) {
    const res = decodeNwsReference(entry.input, VALID_PROVENANCE);
    assert.equal(res.status, 'failed', `Expected failure for: ${entry.name}`);
  }
});

// -----------------------------------------------------------------------------
// Extended synthetic test matrix covering COORDINATOR-REVIEW-3 exact items
// -----------------------------------------------------------------------------

test('decodeNwsReference validates envelope units and metadata presence strictly', () => {
  // Source units missing or wrong
  const missingUnits = createValidSyntheticFeature();
  delete (missingUnits.properties as Record<string, unknown>).units;
  assert.equal(decodeNwsReference(missingUnits, VALID_PROVENANCE).status, 'failed');

  const usUnits = createValidSyntheticFeature({ units: 'us' });
  assert.equal(decodeNwsReference(usUnits, VALID_PROVENANCE).status, 'failed');

  // Metadata timestamps missing
  const missingGeneratedAt = createValidSyntheticFeature();
  delete (missingGeneratedAt.properties as Record<string, unknown>).generatedAt;
  assert.equal(decodeNwsReference(missingGeneratedAt, VALID_PROVENANCE).status, 'failed');

  const missingUpdateTime = createValidSyntheticFeature();
  delete (missingUpdateTime.properties as Record<string, unknown>).updateTime;
  assert.equal(decodeNwsReference(missingUpdateTime, VALID_PROVENANCE).status, 'failed');

  const missingValidTimes = createValidSyntheticFeature();
  delete (missingValidTimes.properties as Record<string, unknown>).validTimes;
  assert.equal(decodeNwsReference(missingValidTimes, VALID_PROVENANCE).status, 'failed');

  // Malformed validTimes intervals
  const malformedIntervals = [
    '2026-11-04T14:00:00Z', // no slash
    '2026-11-04T14:00:00Z/', // empty second
    '/P7D', // empty first
    '2026-11-11T01:00:00Z/2026-11-04T14:00:00Z', // end before start
    'P7D/P7D', // duration / duration
  ];
  for (const interval of malformedIntervals) {
    const bad = createValidSyntheticFeature({ validTimes: interval });
    assert.equal(decodeNwsReference(bad, VALID_PROVENANCE).status, 'failed', `Expected fail for interval: ${interval}`);
  }
});

test('decodeNwsReference verifies individual optional field absence or null independently yields partial status', () => {
  const fields = ['name', 'isDaytime', 'shortForecast', 'detailedForecast'] as const;

  for (const field of fields) {
    // Test explicit null
    const nullPayload = createValidSyntheticFeature({
      periods: [
        {
          number: 1,
          name: 'Day 1',
          startTime: '2026-11-04T18:00:00-05:00',
          endTime: '2026-11-05T06:00:00-05:00',
          isDaytime: true,
          temperature: 0,
          temperatureUnit: 'C',
          probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 },
          shortForecast: 'Clear',
          detailedForecast: 'Clear conditions.',
          [field]: null,
        },
      ],
    });
    const nullRes = decodeNwsReference(nullPayload, VALID_PROVENANCE);
    assert.equal(nullRes.status, 'partial', `Expected partial for null ${field}`);
    if (nullRes.status === 'partial') {
      assert.equal(nullRes.periods[0][field], null);
      assert.equal(nullRes.periods[0].temperatureC, 0); // genuine zero preserved
      assert.equal(nullRes.periods[0].precipitationPercent, 0); // genuine zero preserved
    }

    // Test absence
    const omittedPayload = createValidSyntheticFeature();
    const periodObj = (omittedPayload.properties as Record<string, unknown>).periods as Record<string, unknown>[];
    const singlePeriod: Record<string, unknown> = { ...periodObj[0], temperature: 0, temperatureUnit: 'C', probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 } };
    delete singlePeriod[field];
    (omittedPayload.properties as Record<string, unknown>).periods = [singlePeriod];

    const omitRes = decodeNwsReference(omittedPayload, VALID_PROVENANCE);
    assert.equal(omitRes.status, 'partial', `Expected partial for omitted ${field}`);
    if (omitRes.status === 'partial') {
      assert.equal(omitRes.periods[0][field], null);
    }
  }

  // Single metric null/absence yields partial while retaining genuine zero in the other
  const nullTempPayload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Day 1',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        isDaytime: true,
        temperature: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 },
        shortForecast: 'Sunny',
        detailedForecast: 'Sunny day.',
      },
    ],
  });
  const nullTempRes = decodeNwsReference(nullTempPayload, VALID_PROVENANCE);
  assert.equal(nullTempRes.status, 'partial');
  if (nullTempRes.status === 'partial') {
    assert.equal(nullTempRes.periods[0].temperatureC, null);
    assert.equal(nullTempRes.periods[0].precipitationPercent, 0);
  }

  const nullPopPayload = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        name: 'Day 1',
        startTime: '2026-11-04T18:00:00-05:00',
        endTime: '2026-11-05T06:00:00-05:00',
        isDaytime: true,
        temperature: 0,
        temperatureUnit: 'C',
        probabilityOfPrecipitation: null,
        shortForecast: 'Sunny',
        detailedForecast: 'Sunny day.',
      },
    ],
  });
  const nullPopRes = decodeNwsReference(nullPopPayload, VALID_PROVENANCE);
  assert.equal(nullPopRes.status, 'partial');
  if (nullPopRes.status === 'partial') {
    assert.equal(nullPopRes.periods[0].temperatureC, 0);
    assert.equal(nullPopRes.periods[0].precipitationPercent, null);
  }
});

test('decodeNwsReference rejects numeric strings, nonfinite numbers, wrong QV units, and percentage bounds', () => {
  const badCases = [
    { name: 'temperature numeric string', patch: { temperature: '18', temperatureUnit: 'C' } },
    { name: 'temperature NaN', patch: { temperature: NaN, temperatureUnit: 'C' } },
    { name: 'temperature Infinity', patch: { temperature: Infinity, temperatureUnit: 'C' } },
    { name: 'QV temperature numeric string', patch: { temperature: { unitCode: 'wmoUnit:degC', value: '18' } } },
    { name: 'QV temperature wrong unit', patch: { temperature: { unitCode: 'wmoUnit:degF', value: 18 } } },
    { name: 'precipitation numeric string', patch: { probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: '25' } } },
    { name: 'precipitation negative (-1)', patch: { probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: -1 } } },
    { name: 'precipitation over bounds (101)', patch: { probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 101 } } },
    { name: 'precipitation wrong unit', patch: { probabilityOfPrecipitation: { unitCode: 'wmoUnit:ratio', value: 0.5 } } },
  ];

  for (const c of badCases) {
    const payload = createValidSyntheticFeature({
      periods: [
        {
          number: 1,
          name: 'Test',
          startTime: '2026-11-04T18:00:00-05:00',
          endTime: '2026-11-05T06:00:00-05:00',
          isDaytime: true,
          temperature: 15,
          temperatureUnit: 'C',
          probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 },
          shortForecast: 'Fair',
          detailedForecast: 'Fair.',
          ...c.patch,
        },
      ],
    });
    const res = decodeNwsReference(payload, VALID_PROVENANCE);
    assert.equal(res.status, 'failed', `Expected failure for: ${c.name}`);
  }
});

test('decodeNwsReference validates calendar dates, leap years, timezone offsets, and temporal ordering strictly', () => {
  // Leap day in leap year (2028 is leap year) passes
  const leapPass = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        startTime: '2028-02-29T06:00:00Z',
        endTime: '2028-02-29T18:00:00Z',
        temperature: 5,
        temperatureUnit: 'C',
      },
    ],
  });
  assert.equal(decodeNwsReference(leapPass, VALID_PROVENANCE).status, 'partial');

  // Leap day in non-leap year (2027) fails
  const leapFail = createValidSyntheticFeature({
    periods: [
      {
        number: 1,
        startTime: '2027-02-29T06:00:00Z',
        endTime: '2027-02-29T18:00:00Z',
        temperature: 5,
        temperatureUnit: 'C',
      },
    ],
  });
  assert.equal(decodeNwsReference(leapFail, VALID_PROVENANCE).status, 'failed');

  // Invalid hour or minute in offset
  const badHour = createValidSyntheticFeature({
    periods: [{ number: 1, startTime: '2026-11-04T24:00:00Z', endTime: '2026-11-05T06:00:00Z', temperature: 5, temperatureUnit: 'C' }],
  });
  assert.equal(decodeNwsReference(badHour, VALID_PROVENANCE).status, 'failed');

  const badOffset = createValidSyntheticFeature({
    periods: [{ number: 1, startTime: '2026-11-04T12:00:00+25:00', endTime: '2026-11-05T06:00:00+25:00', temperature: 5, temperatureUnit: 'C' }],
  });
  assert.equal(decodeNwsReference(badOffset, VALID_PROVENANCE).status, 'failed');

  // Overlapping ordered periods (P2 starts before P1 ends)
  const overlapping = createValidSyntheticFeature({
    periods: [
      { number: 1, startTime: '2026-11-04T00:00:00Z', endTime: '2026-11-04T12:00:00Z', temperature: 5, temperatureUnit: 'C' },
      { number: 2, startTime: '2026-11-04T10:00:00Z', endTime: '2026-11-04T22:00:00Z', temperature: 6, temperatureUnit: 'C' },
    ],
  });
  assert.equal(decodeNwsReference(overlapping, VALID_PROVENANCE).status, 'failed');

  // Valid non-overlapping adjacent periods pass
  const validAdjacent = createValidSyntheticFeature({
    periods: [
      { number: 1, startTime: '2026-11-04T00:00:00Z', endTime: '2026-11-04T12:00:00Z', temperature: 5, temperatureUnit: 'C' },
      { number: 2, startTime: '2026-11-04T12:00:00Z', endTime: '2026-11-04T22:00:00Z', temperature: 6, temperatureUnit: 'C' },
    ],
  });
  assert.equal(decodeNwsReference(validAdjacent, VALID_PROVENANCE).status, 'partial');
});

test('decodeNwsReference allows exactly 100 periods and rejects 101 as software cap', () => {
  // Generate 100 non-overlapping 1-hour periods starting 2026-01-01
  const periods100 = [];
  const baseEpochMs = Date.parse('2026-01-01T00:00:00Z');
  for (let i = 1; i <= 100; i++) {
    const startIso = new Date(baseEpochMs + (i - 1) * 3600000).toISOString();
    const endIso = new Date(baseEpochMs + i * 3600000).toISOString();
    periods100.push({
      number: i,
      name: `Period ${i}`,
      startTime: startIso,
      endTime: endIso,
      isDaytime: true,
      temperature: 15,
      temperatureUnit: 'C',
      probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 },
      shortForecast: 'Clear',
      detailedForecast: 'Clear.',
    });
  }

  const payload100 = createValidSyntheticFeature({ periods: periods100 });
  const res100 = decodeNwsReference(payload100, VALID_PROVENANCE);
  assert.equal(res100.status, 'available');
  if (res100.status === 'available') {
    assert.equal(res100.periods.length, 100);
  }

  // 101 periods exceeds software cap
  const start101Iso = new Date(baseEpochMs + 100 * 3600000).toISOString();
  const end101Iso = new Date(baseEpochMs + 101 * 3600000).toISOString();
  const periods101 = [
    ...periods100,
    {
      number: 101,
      name: 'Period 101',
      startTime: start101Iso,
      endTime: end101Iso,
      isDaytime: true,
      temperature: 15,
      temperatureUnit: 'C',
    },
  ];
  const payload101 = createValidSyntheticFeature({ periods: periods101 });
  const res101 = decodeNwsReference(payload101, VALID_PROVENANCE);
  assert.equal(res101.status, 'failed');
  assert.match((res101 as { reason: string }).reason, /exceeds software bound of 100/);
});

test('decodeNwsReference enforces immutability, safe reflection, and caller mutation isolation', () => {
  // Throwing getOwnPropertyDescriptor reflection
  const throwingProxy = new Proxy(createValidSyntheticFeature(), {
    getOwnPropertyDescriptor(_target, prop) {
      if (prop === 'type') throw new Error('Hostile reflection trap');
      return Reflect.getOwnPropertyDescriptor(_target, prop);
    },
  });
  assert.equal(decodeNwsReference(throwingProxy, VALID_PROVENANCE).status, 'failed');

  // Throwing ownKeys reflection
  const throwingOwnKeysProxy = new Proxy(createValidSyntheticFeature(), {
    ownKeys() {
      throw new Error('Hostile ownKeys trap');
    },
  });
  assert.equal(decodeNwsReference(throwingOwnKeysProxy, VALID_PROVENANCE).status, 'failed');

  // Input and provenance stay unchanged after decode
  const input = createValidSyntheticFeature();
  const inputCopy = JSON.parse(JSON.stringify(input));
  const prov: NwsReferenceProvenance = { ...VALID_PROVENANCE };
  const provCopy = { ...prov };

  const res = decodeNwsReference(input, prov);
  assert.equal(res.status, 'available');
  assert.deepEqual(input, inputCopy, 'Input object was not mutated');
  assert.deepEqual(prov, provCopy, 'Provenance object was not mutated');

  // Mutating input and provenance after decode does not alter decoded output
  (input.properties as Record<string, unknown>).units = 'corrupted';
  (prov as Record<string, unknown>).endpoint = 'https://malicious.endpoint';
  if (res.status === 'available') {
    assert.equal(res.metadata.sourceUnits, 'si');
    assert.equal(res.provenance.endpoint, VALID_PROVENANCE.endpoint);
  }
});

// Coordinator additions close the two remaining coverage gaps from the bounded
// source review; these are separate from the native-authored 22 cases above.
test('a forecast accessor is held without reading it, and reversed period bounds cannot become a reference', () => {
  const unsafe = createValidSyntheticFeature();
  let calls = 0;
  Object.defineProperty(unsafe, 'properties', { enumerable: true, get() { calls++; return {}; } });
  assert.equal(decodeNwsReference(unsafe, VALID_PROVENANCE).status, 'failed');
  assert.equal(calls, 0);
  const reversed = createValidSyntheticFeature();
  const periods = (reversed.properties as Record<string, unknown>).periods as Record<string, unknown>[];
  periods[0].endTime = '2026-11-04T17:00:00-05:00';
  assert.equal(decodeNwsReference(reversed, VALID_PROVENANCE).status, 'failed');
});

test('absent or nullable measured values remain unknown beside a real zero or negative fractional value', () => {
  for (const metric of ['temperature', 'probabilityOfPrecipitation']) {
    for (const mode of ['absent', 'nullable-value']) {
      const input = createValidSyntheticFeature();
      const periods = (input.properties as Record<string, unknown>).periods as Record<string, unknown>[];
      const period = periods[0];
      period.temperature = { unitCode: 'wmoUnit:degC', value: -3.25 };
      period.probabilityOfPrecipitation = { unitCode: 'wmoUnit:percent', value: 0 };
      if (mode === 'absent') delete period[metric];
      else period[metric] = { unitCode: metric === 'temperature' ? 'wmoUnit:degC' : 'wmoUnit:percent', value: null };
      const result = decodeNwsReference(input, VALID_PROVENANCE);
      if (result.status === 'failed') throw Error('Expected measured-value output');
      assert.equal(result.status, 'partial');
      assert.equal(result.periods[0].temperatureC, metric === 'temperature' ? null : -3.25);
      assert.equal(result.periods[0].precipitationPercent, metric === 'probabilityOfPrecipitation' ? null : 0);
    }
  }
});
