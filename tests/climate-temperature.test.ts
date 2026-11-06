import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanPowerValue,
  completeMonthlyTemperatures,
  monthlyTemperatureStatus,
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
