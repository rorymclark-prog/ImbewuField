import assert from 'node:assert/strict';
import test from 'node:test';

import { localTodayISODate } from '../lib/field-teams';

// bug-11: 'today' used to be computed with `new Date().toISOString().slice(0, 10)`, which is
// always the UTC calendar date. Between 00:00 and 02:00 SAST (UTC+2) that is still yesterday, so
// a form defaulting to it, or a date picker's `max` bounded by it, named yesterday and refused
// today until well into the morning. These tests fix TZ to a real South African zone (rather than
// whatever the CI host happens to run in) so the local/UTC gap is actually exercised — in UTC
// itself the two would always agree and the bug would never show up.
test('localTodayISODate reads the device-local calendar date, not the UTC one', () => {
  const originalTz = process.env.TZ;
  process.env.TZ = 'Africa/Johannesburg'; // UTC+2, no DST — matches the audit's SAST example
  try {
    // 01:00 local on 2 January is still 23:00 UTC on 1 January.
    const justAfterLocalMidnight = new Date(2026, 0, 2, 1, 0, 0);
    assert.equal(localTodayISODate(justAfterLocalMidnight), '2026-01-02',
      'the local calendar date must be returned, not shifted back a day');
    assert.equal(justAfterLocalMidnight.toISOString().slice(0, 10), '2026-01-01',
      'sanity check: toISOString() really is a day behind at this instant, proving the gap this fix closes');

    // A time safely inside the local day must agree with both readings — this is not a
    // timezone-independent change, only the midnight-to-2am gap closes.
    const midAfternoon = new Date(2026, 5, 15, 14, 30, 0);
    assert.equal(localTodayISODate(midAfternoon), '2026-06-15');
  } finally {
    if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
  }
});

test('localTodayISODate defaults to the current instant when called with no argument', () => {
  const before = new Date();
  const result = localTodayISODate();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result, localTodayISODate(before));
});
