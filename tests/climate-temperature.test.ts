import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanPowerValue,
  completeMonthlyTemperatures,
  monthlyTemperatureStatus,
  recordMinimumC,
  completeMonthlyRainfallMm,
} from '../lib/climate-temperature.ts';

test('cleanPowerValue retains finite numbers above -900, rejects sentinels/non-numbers, and does not coerce hostile objects', () => {
  // Valid numbers including cold and zero
  assert.equal(cleanPowerValue(0), 0);
  assert.equal(cleanPowerValue(-15.4), -15.4);
  assert.equal(cleanPowerValue(25.6), 25.6);
  assert.equal(cleanPowerValue(-899.9), -899.9);

  // Sentinels and numbers at or below -900
  assert.equal(cleanPowerValue(-900), null);
  assert.equal(cleanPowerValue(-999), null);
  assert.equal(cleanPowerValue(-1500), null);

  // Non-finite and non-numbers without coercion
  assert.equal(cleanPowerValue(NaN), null);
  assert.equal(cleanPowerValue(Infinity), null);
  assert.equal(cleanPowerValue(-Infinity), null);
  assert.equal(cleanPowerValue('20'), null);
  assert.equal(cleanPowerValue(null), null);
  assert.equal(cleanPowerValue(undefined), null);
  assert.equal(cleanPowerValue({}), null);
  assert.equal(cleanPowerValue([]), null);

  // Hostile object coercion method-call counter expected 0
  let toStringCalls = 0;
  let valueOfCalls = 0;
  const hostileCoercion = {
    toString() {
      toStringCalls += 1;
      return '25';
    },
    valueOf() {
      valueOfCalls += 1;
      return 25;
    },
  };
  assert.equal(cleanPowerValue(hostileCoercion), null);
  assert.equal(toStringCalls, 0, 'cleanPowerValue must not invoke toString');
  assert.equal(valueOfCalls, 0, 'cleanPowerValue must not invoke valueOf');
});

test('completeMonthlyTemperatures accepts dense 12-element arrays of clean numbers and rejects invalid shapes including inherited prototype properties', () => {
  const validSeries = [12.1, 14.2, 16.5, 18.0, 21.2, 24.5, 23.8, 22.1, 19.4, 16.8, 14.1, 11.9];
  assert.equal(completeMonthlyTemperatures(validSeries), true);

  // Valid series with cold and zero readings
  const coldSeries = [-8.5, -4.2, 0, 5.2, 11.0, 15.6, 17.2, 16.1, 10.4, 3.2, -2.1, -6.8];
  assert.equal(completeMonthlyTemperatures(coldSeries), true);

  // Input array is not mutated
  const seriesCopy = [...coldSeries];
  completeMonthlyTemperatures(coldSeries);
  assert.deepEqual(coldSeries, seriesCopy);

  // Invalid lengths
  assert.equal(completeMonthlyTemperatures([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), false);
  assert.equal(completeMonthlyTemperatures([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), false);

  // Sparse holes in array
  const sparseArray = new Array(12);
  sparseArray[0] = 20;
  sparseArray[11] = 20;
  assert.equal(completeMonthlyTemperatures(sparseArray), false);

  // Real 12-slot array with deleted own index and prototype-supplied valid numeric value
  // Uses a local prototype inheriting Array.prototype without mutating global Array.prototype
  const localArrayProto = Object.create(Array.prototype, {
    11: {
      value: 20,
      enumerable: true,
      configurable: true,
      writable: true,
    },
  });
  const fixtureWithHole = Array(12).fill(20);
  Object.setPrototypeOf(fixtureWithHole, localArrayProto);
  delete fixtureWithHole[11];

  assert.equal(fixtureWithHole.length, 12);
  assert.equal(Array.isArray(fixtureWithHole), true);
  assert.equal(11 in fixtureWithHole, true);
  assert.equal(Object.prototype.hasOwnProperty.call(fixtureWithHole, 11), false);
  assert.equal(completeMonthlyTemperatures(fixtureWithHole), false, 'Array with inherited prototype property in slot must be rejected');

  // Sentinel, null, string, NaN, Infinity inside array
  assert.equal(completeMonthlyTemperatures([20, 20, 20, -999, 20, 20, 20, 20, 20, 20, 20, 20]), false);
  assert.equal(completeMonthlyTemperatures([20, 20, 20, null, 20, 20, 20, 20, 20, 20, 20, 20]), false);
  assert.equal(completeMonthlyTemperatures([20, 20, 20, '20', 20, 20, 20, 20, 20, 20, 20, 20]), false);
  assert.equal(completeMonthlyTemperatures([20, 20, 20, NaN, 20, 20, 20, 20, 20, 20, 20, 20]), false);
  assert.equal(completeMonthlyTemperatures([20, 20, 20, Infinity, 20, 20, 20, 20, 20, 20, 20, 20]), false);

  // Non-array types
  assert.equal(completeMonthlyTemperatures(null), false);
  assert.equal(completeMonthlyTemperatures({ length: 12 }), false);
});

test('monthlyTemperatureStatus maps coverage metadata and guards against false completeness', () => {
  const completeMonthly = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

  // Real complete positive
  const validClimate = {
    monthlyTemp: completeMonthly,
    monthlyTempCoverage: { source: 'nasa-power', status: 'complete' },
  };
  assert.equal(monthlyTemperatureStatus(validClimate), 'complete');

  // Status check does not mutate input object
  const validClimateSnapshot = JSON.parse(JSON.stringify(validClimate));
  monthlyTemperatureStatus(validClimate);
  assert.deepEqual(validClimate, validClimateSnapshot);

  // Explicit incomplete remains incomplete even when monthlyTemp is filled with numbers (e.g. ?? 20 fill)
  const filledIncompleteClimate = {
    monthlyTemp: Array(12).fill(20),
    monthlyTempCoverage: { source: 'nasa-power', status: 'incomplete' },
  };
  assert.equal(monthlyTemperatureStatus(filledIncompleteClimate), 'incomplete');

  // Explicit incomplete receipt with MISSING display array => incomplete (no accidental array prerequisite)
  const missingArrayIncompleteClimate = {
    monthlyTempCoverage: { source: 'nasa-power', status: 'incomplete' },
  };
  assert.equal(monthlyTemperatureStatus(missingArrayIncompleteClimate), 'incomplete');

  // Legacy payload with no coverage receipt evaluates to unknown (no guessing from filled arrays)
  const legacyClimate = {
    monthlyTemp: completeMonthly,
  };
  assert.equal(monthlyTemperatureStatus(legacyClimate), 'unknown');

  // Minima-only marker never grants mean completeness
  const minimaOnlyClimate = {
    monthlyTemp: completeMonthly,
    minTempSource: 'nasa-power',
  };
  assert.equal(monthlyTemperatureStatus(minimaOnlyClimate), 'unknown');

  // Contradictory metadata: claims complete, but monthlyTemp array is corrupted/sparse/incomplete
  const contradictoryClimate = {
    monthlyTemp: [20, 20, 20, -999, 20, 20, 20, 20, 20, 20, 20, 20],
    monthlyTempCoverage: { source: 'nasa-power', status: 'complete' },
  };
  assert.equal(monthlyTemperatureStatus(contradictoryClimate), 'unknown');

  const missingArrayContradiction = {
    monthlyTempCoverage: { source: 'nasa-power', status: 'complete' },
  };
  assert.equal(monthlyTemperatureStatus(missingArrayContradiction), 'unknown');

  // Malformed receipt: receipt is an array with source/status properties
  const arrayReceipt = Object.assign(['unexpected', 'elements'], {
    source: 'nasa-power',
    status: 'complete',
  });
  assert.equal(
    monthlyTemperatureStatus({
      monthlyTemp: completeMonthly,
      monthlyTempCoverage: arrayReceipt,
    }),
    'unknown',
    'Coverage receipt that is an Array must be rejected as unknown'
  );

  // Climate itself is an Array with otherwise valid named fields (must be rejected)
  const climateArray = Object.assign([1, 2, 3], {
    monthlyTemp: completeMonthly,
    monthlyTempCoverage: { source: 'nasa-power', status: 'complete' },
  });
  assert.equal(monthlyTemperatureStatus(climateArray), 'unknown', 'Climate that is an Array must be rejected as unknown');

  // Wrong source or invalid status
  assert.equal(
    monthlyTemperatureStatus({
      monthlyTemp: completeMonthly,
      monthlyTempCoverage: { source: 'other-source', status: 'complete' },
    }),
    'unknown'
  );
  assert.equal(
    monthlyTemperatureStatus({
      monthlyTemp: completeMonthly,
      monthlyTempCoverage: { source: 'nasa-power', status: 'valid' },
    }),
    'unknown'
  );

  // Malformed or non-object inputs
  assert.equal(monthlyTemperatureStatus(null), 'unknown');
  assert.equal(monthlyTemperatureStatus(undefined), 'unknown');
  assert.equal(monthlyTemperatureStatus('climate-string'), 'unknown');
  assert.equal(monthlyTemperatureStatus([]), 'unknown');
  assert.equal(monthlyTemperatureStatus({ monthlyTempCoverage: null }), 'unknown');
});

// Independent review of PR #1328 (comment 6762553064) ran the published helper and got
// recordMinimumC({ minTemp: -999, minTempSource: 'nasa-power' }) === -999: it checked the
// provenance tag and then accepted any finite number, while cleanPowerValue, the cleaning
// rule in the same file, rejects everything at or below POWER's -900 cutoff. A missing
// marker in a stored payload was therefore a "record low" that chose a sowing calendar.
test('recordMinimumC applies the POWER cleaning rule after the provenance check: a missing marker is not a record low', () => {
  const tagged = (minTemp: unknown) => recordMinimumC({ minTemp, minTempSource: 'nasa-power' });

  // Missing-value markers, on and below the cutoff.
  assert.equal(tagged(-999), null);
  assert.equal(tagged(-900), null);
  assert.equal(tagged(-901), null);
  assert.equal(tagged(-1500), null);
  // The cutoff is exclusive, as in cleanPowerValue: just above it is still a number.
  assert.equal(tagged(-899.9), -899.9);

  // Real readings are kept, including frost and exactly zero. Zero is the case a
  // truthiness check would silently drop, and it is the freezing point.
  assert.equal(tagged(-4), -4);
  assert.equal(tagged(-0.3), -0.3);
  assert.equal(tagged(0), 0);
  assert.equal(tagged(2), 2);
  assert.equal(tagged(11.6), 11.6);

  // Not numbers: never coerced.
  assert.equal(tagged(Number.NaN), null);
  assert.equal(tagged(Number.POSITIVE_INFINITY), null);
  assert.equal(tagged(Number.NEGATIVE_INFINITY), null);
  assert.equal(tagged('3'), null);
  assert.equal(tagged(null), null);
  assert.equal(tagged(undefined), null);
  assert.equal(tagged([3]), null);
  assert.equal(tagged({ valueOf: () => 3 }), null);

  // Every accepted or rejected value agrees with the canonical rule.
  for (const value of [-1500, -999, -901, -900, -899.9, -4, 0, 2, Number.NaN, Number.POSITIVE_INFINITY, '3', null]) {
    assert.equal(tagged(value), cleanPowerValue(value), `recordMinimumC and cleanPowerValue disagree on ${String(value)}`);
  }
});

test('recordMinimumC trusts only a reading tagged as NASA POWER', () => {
  // /api/location-data substitutes a generic figure during an outage and does not tag it.
  assert.equal(recordMinimumC({ minTemp: 5 }), null);
  assert.equal(recordMinimumC({ minTemp: 5, minTempSource: 'fallback' }), null);
  assert.equal(recordMinimumC({ minTemp: 5, minTempSource: 'NASA-POWER' }), null);
  assert.equal(recordMinimumC({ minTemp: 5, minTempSource: null }), null);
  assert.equal(recordMinimumC({ minTempSource: 'nasa-power' }), null);
  assert.equal(recordMinimumC(null), null);
  assert.equal(recordMinimumC(undefined), null);
  assert.equal(recordMinimumC('nasa-power'), null);
  assert.equal(recordMinimumC([{ minTemp: 5, minTempSource: 'nasa-power' }]), null);

  // The input is read, never changed.
  const climate = { minTemp: -999, minTempSource: 'nasa-power' };
  recordMinimumC(climate);
  assert.deepEqual(climate, { minTemp: -999, minTempSource: 'nasa-power' });
});

test('completeMonthlyRainfallMm needs twelve own, present, finite, non-negative months (CBR-04)', () => {
  const year = [128.7, 100.2, 84.6, 48.6, 18, 14.4, 15.5, 18.6, 38.7, 69.8, 111.9, 119];
  assert.equal(completeMonthlyRainfallMm(year), true);
  assert.equal(completeMonthlyRainfallMm(new Array(12).fill(0)), true, 'a rainless year is a reading');
  const hole = [...year]; delete hole[0];
  assert.equal(hole.length, 12);
  assert.equal(hole.every((v) => typeof v === 'number' && Number.isFinite(v)), true, 'fixture: the old check skipped the hole');
  assert.equal(completeMonthlyRainfallMm(hole), false);
  assert.equal(completeMonthlyRainfallMm(new Array(12)), false, 'twelve holes');
  for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -0.1, -999, '10', {}]) {
    const months: unknown[] = [...year]; months[4] = bad;
    assert.equal(completeMonthlyRainfallMm(months), false, String(bad));
  }
  assert.equal(completeMonthlyRainfallMm(year.slice(0, 11)), false);
  assert.equal(completeMonthlyRainfallMm([...year, 5]), false);
  assert.equal(completeMonthlyRainfallMm({ ...year, length: 12 }), false, 'array-like is not an array');
  // An inherited index does not stand in for a missing month.
  const inherited = [...year]; delete inherited[2];
  Object.defineProperty(Array.prototype, 2, { value: 84.6, configurable: true, writable: true });
  try { assert.equal(completeMonthlyRainfallMm(inherited), false); } finally { delete (Array.prototype as unknown as Record<number, unknown>)[2]; }
  assert.deepEqual(year, [128.7, 100.2, 84.6, 48.6, 18, 14.4, 15.5, 18.6, 38.7, 69.8, 111.9, 119], 'the input is not changed');
});


import { annualRainfallMm, sourcedMonthlyRainfall, reportClimateEvidence } from '../lib/climate-temperature.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
test('outage placeholders cannot become report evidence, while independent zero and partial observations survive', () => {
  const outage = { ...DEMO_LOCATION, rainfall: { ...DEMO_LOCATION.rainfall, annual: 600, monthly: Array(12).fill(50), rainfallSource: undefined }, climate: { ...DEMO_LOCATION.climate, windSpeed: 3, windSource: undefined, minTemp: 1, minTempSource: undefined, windFromSummer: 'NNE', windFromWinter: '—', windDirectionSource: undefined } };
  assert.equal(annualRainfallMm(outage.rainfall), null);
  assert.equal(sourcedMonthlyRainfall(outage.rainfall), null);
  const missing = reportClimateEvidence(outage);
  assert.match(missing, /Annual rainfall: not known/);
  assert.match(missing, /Wind speed estimate: not known/);
  assert.match(missing, /Lowest temperature on record: not known/);
  assert.doesNotMatch(missing, /600 mm|50, 50|3 m\/s|December–February NNE/);
  const partial = { ...outage, rainfall: { ...outage.rainfall, annual: 0, monthly: [], rainfallSource: 'nasa-power' }, climate: { ...outage.climate, windSpeed: 0, windSource: 'nasa-power' as const, windDirectionSource: 'nasa-power' as const } };
  assert.equal(annualRainfallMm(partial.rainfall), 0);
  assert.equal(sourcedMonthlyRainfall(partial.rainfall), null);
  assert.match(reportClimateEvidence(partial), /Annual rainfall: 0 mm/);
  assert.match(reportClimateEvidence(partial), /0 m\/s/);
  assert.match(reportClimateEvidence(partial), /December–February NNE; June–August not known/);
  const directionOnly = { ...partial, climate: { ...partial.climate, windSource: undefined } };
  assert.match(reportClimateEvidence(directionOnly), /Wind speed estimate: not known/);
  assert.match(reportClimateEvidence(directionOnly), /December–February NNE/);
  assert.equal(annualRainfallMm({ annual: 1, rainfallSource: { toString: 'nasa-power' } }), null);
  for (const bad of [-1, NaN, Infinity, '0', null]) assert.equal(annualRainfallMm({ annual: bad, rainfallSource: 'nasa-power' }), null);
  assert.equal(sourcedMonthlyRainfall({ monthly: new Array(12), rainfallSource: 'nasa-power' }), null);
});
