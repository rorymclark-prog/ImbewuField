import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  contentCountOf,
  preserveCanvasNavigation,
  revOf,
  type DesignCanvasState,
} from '../lib/design-canvas.ts';
import {
  mergeDesignCanvasStore,
  parseDesignCanvasStore,
  pickWinner,
  stringifyDesignCanvasStore,
} from '../lib/design-canvas-sync.ts';

function state(
  siteId: string,
  {
    rev = 0,
    updatedAt = '2026-01-01T00:00:00.000Z',
    items = 0,
    zones = 0,
    lines = 0,
    step = 'base',
  }: {
    rev?: number;
    updatedAt?: string;
    items?: number;
    zones?: number;
    lines?: number;
    step?: DesignCanvasState['step'];
  } = {},
): DesignCanvasState {
  return {
    siteId,
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: Array.from({ length: items }, (_, index) => ({
      id: `item-${index}`,
      defId: 'tank_2500',
      x: 0.2 + index * 0.01,
      y: 0.3,
    })),
    zones: Array.from({ length: zones }, (_, index) => ({
      id: `zone-${index}`,
      zone: 1 as const,
      points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4]] as Array<[number, number]>,
    })),
    lines: Array.from({ length: lines }, (_, index) => ({
      id: `line-${index}`,
      kind: 'path' as const,
      points: [[0.1, 0.1], [0.8, 0.8]] as Array<[number, number]>,
    })),
    step,
    updatedAt,
    rev,
  };
}

test('a higher edit revision beats a fresher wall clock from a stale device', () => {
  const staleRestamped = state('farm', {
    rev: 3,
    updatedAt: '2030-01-01T00:00:00.000Z',
    items: 1,
  });
  const cloud = state('farm', {
    rev: 4,
    updatedAt: '2025-01-01T00:00:00.000Z',
    items: 1,
    zones: 2,
  });

  assert.equal(pickWinner(staleRestamped, cloud), cloud);
  assert.equal(pickWinner(cloud, staleRestamped), cloud);
});

test('equal revisions use timestamp last-write-wins and an exact tie stays local', () => {
  const older = state('farm', { rev: 8, updatedAt: '2026-01-01T00:00:00.000Z', items: 1 });
  const newer = state('farm', { rev: 8, updatedAt: '2026-01-02T00:00:00.000Z', zones: 1 });
  const sameTime = state('farm', { rev: 8, updatedAt: older.updatedAt, lines: 1 });

  assert.equal(pickWinner(older, newer), newer);
  assert.equal(pickWinner(newer, older), newer);
  assert.equal(pickWinner(older, sameTime), older);
});

test('an empty copy can never erase a populated design in either direction', () => {
  const populated = state('farm', { rev: 2, items: 1, zones: 1, lines: 1 });
  const emptyButAhead = state('farm', {
    rev: 99,
    updatedAt: '2035-01-01T00:00:00.000Z',
  });

  assert.equal(pickWinner(emptyButAhead, populated), populated);
  assert.equal(pickWinner(populated, emptyButAhead), populated);
});

test('invalid revisions do not poison ordering or gain authority', () => {
  const ordinary = state('farm', { rev: 1, items: 1 });
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const corrupt = state('farm', { rev: invalid, updatedAt: '2030-01-01T00:00:00.000Z', zones: 1 });
    assert.equal(revOf(corrupt), 0);
    assert.equal(pickWinner(corrupt, ordinary), ordinary);
  }
});

test('the Firestore payload remains one JSON string and nested coordinate arrays round-trip', () => {
  const canvas = state('farm', { rev: 3, zones: 1, lines: 1 });
  const merged = mergeDesignCanvasStore('{}', 'farm', canvas);

  assert.equal(typeof merged.designCanvasJson, 'string');
  const decoded = JSON.parse(merged.designCanvasJson);
  assert.deepEqual(decoded.farm.zones[0].points, canvas.zones[0].points);
  assert.deepEqual(decoded.farm.lines[0].points, canvas.lines[0].points);
  assert.deepEqual(parseDesignCanvasStore(merged.designCanvasJson), decoded);
  assert.equal(stringifyDesignCanvasStore(decoded), merged.designCanvasJson);
});

test('a blank base syncs its inherited scale instead of reverting on another device', () => {
  const blank = {
    ...state('farm', { rev: 3, zones: 1 }),
    baseMode: 'blank' as const,
    blankMPerPx: 0.137,
    useCustomBase: false,
    customBase: { url: 'https://example/drone.jpg', mPerPx: 0.137, uploadedAt: '2026-08-06T00:00:00.000Z' },
  };
  const merged = mergeDesignCanvasStore('{}', 'farm', blank);
  const fromAnotherDevice = JSON.parse(merged.designCanvasJson).farm;

  assert.equal(merged.winner?.baseMode, 'blank');
  assert.equal(fromAnotherDevice.blankMPerPx, 0.137);
  assert.equal(fromAnotherDevice.useCustomBase, false);
});

test('merging one site preserves every other site slot byte-for-byte in value', () => {
  const other = state('other', { rev: 7, items: 2 });
  const malformedButUnrelated = { futureSchema: [['keep', 'me']] };
  const remote = JSON.stringify({
    other,
    future: malformedButUnrelated,
    farm: state('farm', { rev: 1, items: 1 }),
  });
  const local = state('farm', { rev: 2, zones: 1 });

  const merged = JSON.parse(mergeDesignCanvasStore(remote, 'farm', local).designCanvasJson);

  assert.deepEqual(merged.other, other);
  assert.deepEqual(merged.future, malformedButUnrelated);
  assert.deepEqual(merged.farm, local);
});

test('malformed JSON and a mismatched site slot never enter the open canvas', () => {
  assert.deepEqual(parseDesignCanvasStore(null), {});
  assert.deepEqual(parseDesignCanvasStore('{broken'), {});
  assert.deepEqual(parseDesignCanvasStore('[]'), {});

  const wrongSite = state('other-site', { rev: 50, items: 1 });
  assert.equal(
    mergeDesignCanvasStore(JSON.stringify({ farm: wrongSite }), 'farm', null).winner,
    null,
  );

  const local = state('farm', { rev: 1, lines: 1 });
  assert.equal(
    mergeDesignCanvasStore(JSON.stringify({
      farm: { ...wrongSite, siteId: 'farm', zones: null },
    }), 'farm', local).winner,
    local,
  );

  const invalidGeometry = {
    ...state('farm', { rev: 99, zones: 1 }),
    zones: [{ id: 'broken', zone: 1, points: [[0, Number.NaN]] }],
  };
  assert.equal(
    mergeDesignCanvasStore(JSON.stringify({ farm: invalidGeometry }), 'farm', local).winner,
    local,
  );
  assert.equal(
    mergeDesignCanvasStore('{}', 'farm', {
      ...local,
      dailyWaterUseL: Number.POSITIVE_INFINITY,
    }).winner,
    null,
  );
  assert.equal(
    mergeDesignCanvasStore('{}', 'farm', {
      ...local,
      items: [{ ...local.items[0], id: 'bad-size', defId: 'bed', x: 0.2, y: 0.2, wM: -1 }],
    }).winner,
    null,
  );
});

test('content counting is defensive at the untrusted boundary', () => {
  assert.equal(contentCountOf(null), 0);
  assert.equal(contentCountOf(state('farm', { items: 2, zones: 3, lines: 4 })), 9);
  assert.equal(contentCountOf({
    items: null,
    zones: [{ id: 'one' }],
    lines: undefined,
  } as never), 1);
});

test('a remote content winner retains the open tab navigation without mutating either copy', () => {
  const local = state('farm', { rev: 2, items: 1, step: 'planting' });
  const remote = state('farm', { rev: 3, zones: 1, step: 'water' });
  const localBefore = structuredClone(local);
  const remoteBefore = structuredClone(remote);

  const displayed = preserveCanvasNavigation(pickWinner(local, remote), local);

  assert.equal(displayed.step, 'planting');
  assert.deepEqual(displayed.zones, remote.zones);
  assert.deepEqual(local, localBefore);
  assert.deepEqual(remote, remoteBefore);
});

test('reconcile, push and live subscription all share the same winner and string codec', () => {
  const source = readFileSync(new URL('../lib/design-canvas-sync.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/mergeDesignCanvasStore\(/g) ?? []).length >= 3, true);
  assert.match(source, /stateAt\(parseDesignCanvasStore\(snap\.data\(\)\.designCanvasJson\), siteId\)/);
  assert.doesNotMatch(source, /designCanvas:\s*mergedStore/);
});
