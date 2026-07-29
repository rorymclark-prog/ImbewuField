import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveElevationData, fetchElevation } from '../lib/elevation.ts';
import { deriveSectorModel } from '../lib/sector.ts';

function apiResponse(elevations: unknown[]): Response {
  return new Response(JSON.stringify({
    results: elevations.map((elevation) => ({ elevation })),
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function withMockFetch(
  mock: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('derives site-local downhill direction from a five-point central difference', () => {
  const elevation = deriveElevationData({
    center: 328,
    north: 333,
    south: 321,
    east: 328,
    west: 325,
  });

  assert.equal(elevation.elevation, 328);
  assert.ok(elevation.aspectDeg >= 180 && elevation.aspectDeg <= 210);
  assert.ok(elevation.slopePct >= 9 && elevation.slopePct <= 11);
  assert.equal(elevation.sampleBaselineM, 120);
  assert.equal(elevation.directionConfidence, 'site-local-indicative');
});

test('does not turn DEM noise into a downhill arrow', () => {
  const elevation = deriveElevationData({
    center: 100,
    north: 100,
    south: 100,
    east: 100,
    west: 100,
  });

  assert.equal(elevation.directionConfidence, 'unconfirmed');
  assert.equal(elevation.aspectLabel, '—');
  const sector = deriveSectorModel({ elevation }, -27.7, 31.9);
  assert.equal(sector.water, null);
  assert.match(sector.dataNotes.join(' '), /too small to confirm a downhill direction/i);
});

test('rejects non-finite elevation samples instead of deriving invalid terrain', () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => deriveElevationData({
        center: 100,
        north: 101,
        south: 99,
        east: invalid,
        west: 100,
      }),
      /invalid elevation samples/i,
    );
  }
});

test('rejects invalid coordinates before requesting elevation data', async () => {
  let requests = 0;
  await withMockFetch(
    async () => {
      requests += 1;
      return apiResponse([1, 2, 3, 4, 5]);
    },
    async () => {
      const invalidCoordinates: Array<[number, number]> = [
        [Number.NaN, 20],
        [0, Number.POSITIVE_INFINITY],
        [90.1, 20],
        [-90.1, 20],
        [0, 180.1],
        [0, -180.1],
      ];
      for (const [lat, lon] of invalidCoordinates) {
        await assert.rejects(fetchElevation(lat, lon), /invalid elevation coordinates/i);
      }
    },
  );
  assert.equal(requests, 0);
});

test('requires one finite API elevation for every requested sample', async () => {
  const incompleteResponses: unknown[][] = [
    [100, 101, 99, 102],
    [100, 101, 99, 102, null],
    [100, 101, 99, 102, Number.NaN],
    [100, 101, 99, 102, Number.POSITIVE_INFINITY],
    [100, 101, 99, 102, 98, 97],
  ];

  for (const elevations of incompleteResponses) {
    await withMockFetch(
      async () => apiResponse(elevations),
      async () => {
        await assert.rejects(
          fetchElevation(-27.7, 31.9),
          /incomplete opentopodata elevation data/i,
        );
      },
    );
  }
});

test('keeps all requested sample coordinates within Earth coordinate bounds', async () => {
  for (const longitude of [-180, 180]) {
    await withMockFetch(
      async (input) => {
        const url = new URL(String(input));
        const locations = url.searchParams.get('locations')?.split('|') ?? [];
        assert.ok(locations.length > 0);
        for (const location of locations) {
          const [lat, lon] = location.split(',').map(Number);
          assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90);
          assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180);
        }
        return apiResponse([100, 101, 99, 102, 98]);
      },
      async () => {
        const elevation = await fetchElevation(0, longitude);
        assert.equal(elevation.directionConfidence, 'site-local-indicative');
      },
    );
  }
});

test('does not request a north or south sample beyond a pole', async () => {
  let requests = 0;
  await withMockFetch(
    async () => {
      requests += 1;
      return apiResponse([1, 2, 3, 4, 5]);
    },
    async () => {
      await assert.rejects(fetchElevation(90, 0), /sampling unavailable/i);
      await assert.rejects(fetchElevation(-90, 0), /sampling unavailable/i);
    },
  );
  assert.equal(requests, 0);
});
