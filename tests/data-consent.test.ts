import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Phase 3 of the NGO/funder dashboard build (see PROGRESS.md, plan doc). Phase 1 shipped
// `Profile.dataConsent` and the rules that gate staff reads on it; this phase is the farmer-facing
// toggle that actually writes the field. Two things are tested here:
//   1. `nextDataConsent()` — the pure history-keeping function — with genuine unit tests.
//   2. `components/ProfileSheet.tsx`'s wiring — source-pattern-matching, same style as
//      tests/write-timeout.test.ts, since there's no DOM-rendering harness in this repo.

import { nextDataConsent } from '../lib/data-consent.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ── nextDataConsent: history-keeping ────────────────────────────────────── */

test('granting for the first time (no prior record) stamps grantedAt and leaves revokedAt null', () => {
  const result = nextDataConsent(undefined, true, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(result, {
    granted: true,
    grantedAt: '2026-08-24T10:00:00.000Z',
    revokedAt: null,
  });
});

test('revoking for the first time (no prior record) stamps revokedAt and leaves grantedAt null', () => {
  const result = nextDataConsent(undefined, false, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(result, {
    granted: false,
    grantedAt: null,
    revokedAt: '2026-08-24T10:00:00.000Z',
  });
});

test('re-granting after a revoke preserves the previous revokedAt and stamps a fresh grantedAt', () => {
  const current = { granted: false, grantedAt: '2026-01-01T00:00:00.000Z', revokedAt: '2026-02-01T00:00:00.000Z' };
  const result = nextDataConsent(current, true, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(result, {
    granted: true,
    grantedAt: '2026-08-24T10:00:00.000Z',
    revokedAt: '2026-02-01T00:00:00.000Z',
  });
});

test('re-revoking after a grant preserves the previous grantedAt and stamps a fresh revokedAt', () => {
  const current = { granted: true, grantedAt: '2026-02-01T00:00:00.000Z', revokedAt: '2026-01-01T00:00:00.000Z' };
  const result = nextDataConsent(current, false, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(result, {
    granted: false,
    grantedAt: '2026-02-01T00:00:00.000Z',
    revokedAt: '2026-08-24T10:00:00.000Z',
  });
});

test('granting again while already granted just refreshes grantedAt (idempotent shape)', () => {
  const current = { granted: true, grantedAt: '2026-01-01T00:00:00.000Z', revokedAt: null };
  const result = nextDataConsent(current, true, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(result, {
    granted: true,
    grantedAt: '2026-08-24T10:00:00.000Z',
    revokedAt: null,
  });
});

/* ── ProfileSheet.tsx wiring ──────────────────────────────────────────────── */

const profileSheetSrc = read('../components/ProfileSheet.tsx');

test('ProfileSheet imports the consent helper and the org lookup', () => {
  assert.match(profileSheetSrc, /import \{ nextDataConsent \} from '@\/lib\/data-consent'/);
  assert.match(profileSheetSrc, /getOrganization/);
});

test('the data-sharing toggle only renders when the farmer belongs to an org', () => {
  assert.match(profileSheetSrc, /\{profile\?\.org_id && \(/);
  assert.match(profileSheetSrc, /Share my data with/);
});

test('saving only stamps a new dataConsent record when the toggle actually moved', () => {
  assert.match(profileSheetSrc, /if \(dataConsentGranted !== initialConsentGranted\)/);
  assert.match(
    profileSheetSrc,
    /patch\.dataConsent = nextDataConsent\(profile\.dataConsent, dataConsentGranted, new Date\(\)\.toISOString\(\)\)/,
  );
});

test('the consent toggle is off by default when the profile has no dataConsent record', () => {
  assert.match(profileSheetSrc, /const initialConsentGranted = profile\?\.dataConsent\?\.granted \?\? false;/);
});
