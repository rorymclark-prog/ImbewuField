import test from 'node:test';
import assert from 'node:assert/strict';

import { backfillThumbnails } from '../lib/gallery-thumbnails.ts';

/** A `make` that records how many calls are in flight at once. */
function tracking(delayResolvers: Array<() => void> = []) {
  let inFlight = 0;
  let peak = 0;
  const calls: string[] = [];
  const make = (row: { id: string }) => {
    calls.push(row.id);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    return new Promise<string | undefined>((resolve) => {
      const finish = () => { inFlight -= 1; resolve(`thumb-${row.id}`); };
      // Resolve on a later turn so a concurrent implementation would genuinely overlap.
      delayResolvers.push(finish);
      setTimeout(finish, 0);
    });
  };
  return { make, peak: () => peak, calls };
}

test('thumbnails are generated ONE AT A TIME, whatever the gallery size', async () => {
  // THE WHOLE POINT. The previous implementation produced identical thumbnails and identical
  // saved records — it differed only in schedule, starting every decode at once. With 30 legacy
  // sheets that is 30 concurrent full-resolution PNG decodes on mount.
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: `sheet-${i}` }));
  const t = tracking();
  const seen: string[] = [];
  await backfillThumbnails(rows, { make: t.make, onThumb: (r) => seen.push(r.id) });
  assert.equal(t.peak(), 1, `peak concurrent decodes was ${t.peak()}, must be 1`);
  assert.equal(seen.length, 30);
});

test('rows that already have a thumbnail are never re-decoded', async () => {
  const rows = [{ id: 'a', thumb: 'x' }, { id: 'b' }, { id: 'c', thumb: 'y' }];
  const t = tracking();
  await backfillThumbnails(rows, { make: t.make, onThumb: () => {} });
  assert.deepEqual(t.calls, ['b']);
});

test('one unreadable sheet does not stop the walk', async () => {
  const rows = [{ id: 'a' }, { id: 'bad' }, { id: 'c' }];
  const done: string[] = [];
  await backfillThumbnails(rows, {
    make: async (r) => {
      if (r.id === 'bad') throw new Error('decode failed');
      return `thumb-${r.id}`;
    },
    onThumb: (r) => done.push(r.id),
  });
  assert.deepEqual(done, ['a', 'c']);
});

test('a make that resolves undefined is skipped, not reported as a thumbnail', async () => {
  const done: string[] = [];
  await backfillThumbnails([{ id: 'a' }, { id: 'b' }], {
    make: async (r) => (r.id === 'a' ? undefined : 'thumb-b'),
    onThumb: (r) => done.push(r.id),
  });
  assert.deepEqual(done, ['b']);
});

test('cancellation stops the walk promptly, before the next decode starts', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));
  let cancelled = false;
  const t = tracking();
  const done: string[] = [];
  await backfillThumbnails(rows, {
    make: t.make,
    onThumb: (r) => { done.push(r.id); if (done.length === 3) cancelled = true; },
    isCancelled: () => cancelled,
  });
  // The row in progress when cancel flips is allowed to finish; nothing after it may start.
  assert.equal(done.length, 3);
  assert.equal(t.calls.length, 3, `started ${t.calls.length} decodes after cancelling at 3`);
});
