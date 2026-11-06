import assert from 'node:assert/strict';
import test from 'node:test';
import {
  previewRecordedHarvest,
  productionProjectEvidence,
  existingProjectReference,
  type PreviewRecordedHarvestRequest,
} from '@/lib/international/projects/sources';

test('positive control: sums 0.1 + 0.2 kg exactly without decimal noise', () => {
  const request: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      {
        id: 'rec-1',
        siteId: 'site-alpha',
        sourceIconKey: 'crop:cabbage',
        label: 'Recorded fixture',
        date: { year: 2026, month: 1 },
        quantity: 0.1,
        unit: 'kg',
        status: 'actual',
        provenance: 'farm-record',
      },
      {
        id: 'rec-2',
        siteId: 'site-alpha',
        sourceIconKey: 'crop:cabbage',
        label: 'Recorded fixture',
        date: { year: 2026, month: 2 },
        quantity: 0.2,
        unit: 'kg',
        status: 'actual',
        provenance: 'farm-record',
      },
    ],
  };

  const result = previewRecordedHarvest(request);
  assert.equal(result.status, 'ready');
  assert.equal(result.knownSubtotalKg, 0.3);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].label, 'Recorded fixture');
  assert.equal(result.rows[1].label, 'Recorded fixture');
  assert.equal(result.excluded.length, 0);
  assert.equal(result.projectReportAvailable, false);
});

test('explicit zero yields 0 knownSubtotalKg, whereas empty source yields null', () => {
  const zeroRequest: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: [
      {
        id: 'rec-zero',
        siteId: 'site-alpha',
        sourceIconKey: 'crop:cabbage',
        label: 'Recorded zero',
        date: { year: 2026, month: 1 },
        quantity: 0,
        unit: 'kg',
        status: 'actual',
        provenance: 'farm-record',
      },
    ],
  };
  const zeroResult = previewRecordedHarvest(zeroRequest);
  assert.equal(zeroResult.status, 'ready');
  assert.equal(zeroResult.knownSubtotalKg, 0);
  assert.equal(zeroResult.rows.length, 1);
  assert.equal(zeroResult.rows[0].label, 'Recorded zero');

  const emptyRequest: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: [],
  };
  const emptyResult = previewRecordedHarvest(emptyRequest);
  assert.equal(emptyResult.status, 'ready');
  assert.equal(emptyResult.knownSubtotalKg, null);
  assert.equal(emptyResult.rows.length, 0);
});

test('missing, corrupt or unsafe source is held, never empty or zero', () => {
  const nonArray = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: { id: 'single-object-not-array' },
  });
  assert.equal(nonArray.status, 'held');
  assert.ok(nonArray.reasons.includes('non-array-records'));

  const reversed = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '2026-05-01',
    periodEnd: '2026-01-31',
    records: [],
  });
  assert.equal(reversed.status, 'held');
  assert.ok(reversed.reasons.includes('reversed-period'));
});

test('excludes expected, fictional-example, missing provenance, different site, non-kg, and outside month using distinct identity records', () => {
  // Each row has distinct month/key/site identity to prevent false duplicate-identity collisions
  const request: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-08-31',
    records: [
      // 0: status expected
      { id: 'r0', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 5, unit: 'kg', status: 'expected', provenance: 'farm-record' },
      // 1: fictional-example
      { id: 'r1', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 2 }, quantity: 5, unit: 'kg', status: 'actual', provenance: 'fictional-example' },
      // 2: missing provenance (undefined)
      { id: 'r2', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 3 }, quantity: 5, unit: 'kg', status: 'actual' },
      // 3: different site
      { id: 'r3', siteId: 'site-beta', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 4 }, quantity: 5, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      // 4: unit not kg
      { id: 'r4', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 5 }, quantity: 5, unit: 'litres', status: 'actual', provenance: 'farm-record' },
      // 5: month outside period
      { id: 'r5', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 9 }, quantity: 5, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      // 6: malformed row
      null,
    ],
  };

  const result = previewRecordedHarvest(request);
  assert.equal(result.status, 'ready');
  assert.equal(result.rows.length, 0);
  assert.equal(result.excluded.length, 7);
  assert.ok(result.excluded[0].reasons.includes('not-actual-harvest'));
  assert.ok(result.excluded[1].reasons.includes('fictional-example'));
  assert.ok(result.excluded[2].reasons.includes('missing-provenance'));
  assert.ok(result.excluded[3].reasons.includes('different-site'));
  assert.ok(result.excluded[4].reasons.includes('unit-not-kg'));
  assert.ok(result.excluded[5].reasons.includes('month-outside-period'));
  assert.ok(result.excluded[6].reasons.includes('malformed-row'));
});

test('normalization loss on ID and label is excluded with original raw index and no invented reference', () => {
  // Untruncated raw ID exceeds 200 chars: sanitizer truncates it, so normalization ID loss occurs and ref is null
  const longId = 'a'.repeat(205);
  // Label whitespace padding: sanitizer trims it, causing normalization label loss
  const paddedLabelRow = {
    id: 'valid-id-1',
    siteId: 'site-alpha',
    sourceIconKey: 'crop:cabbage',
    label: '  Padded Label  ',
    date: { year: 2026, month: 1 },
    quantity: 10,
    unit: 'kg',
    status: 'actual',
    provenance: 'farm-record',
  };
  const truncatedIdRow = {
    id: longId,
    siteId: 'site-alpha',
    sourceIconKey: 'crop:cabbage',
    label: 'Valid Label',
    date: { year: 2026, month: 2 },
    quantity: 10,
    unit: 'kg',
    status: 'actual',
    provenance: 'farm-record',
  };

  const request: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [paddedLabelRow, truncatedIdRow],
  };

  const result = previewRecordedHarvest(request);
  assert.equal(result.status, 'ready');
  assert.equal(result.rows.length, 0);
  assert.equal(result.excluded.length, 2);

  // Row 0 has valid ID, but label was trimmed by normalizer
  assert.equal(result.excluded[0].sourceRowIndex, 0);
  assert.ok(result.excluded[0].reasons.includes('normalization-label-loss'));
  assert.deepEqual(result.excluded[0].reference, { authority: 'production-records', id: 'valid-id-1' });

  // Row 1 has invalid untruncated ID (>200 chars), so reference is null
  assert.equal(result.excluded[1].sourceRowIndex, 1);
  assert.ok(result.excluded[1].reasons.includes('missing-or-invalid-id'));
  assert.ok(result.excluded[1].reasons.includes('normalization-id-loss'));
  assert.equal(result.excluded[1].reference, null);
});

test('exact accepted label survives projection and JSON round-trip unchanged while original records stay unmutated', () => {
  const originalRecord = {
    id: 'rec-preserved-label',
    siteId: 'site-alpha',
    sourceIconKey: 'crop:cabbage',
    label: 'Exact Saved Harvest Description',
    date: { year: 2026, month: 1 },
    quantity: 8.5,
    unit: 'kg' as const,
    status: 'actual' as const,
    provenance: 'farm-record' as const,
  };
  const recordCopy = { ...originalRecord };
  const originalSnapshot = JSON.stringify(recordCopy);

  const request: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: [recordCopy],
  };

  const result = previewRecordedHarvest(request);
  assert.equal(result.status, 'ready');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].label, 'Exact Saved Harvest Description');

  // JSON round-trip preserves label exactly
  const serialised = JSON.parse(JSON.stringify(result));
  assert.equal(serialised.rows[0].label, 'Exact Saved Harvest Description');

  // Input record was not mutated in place
  assert.equal(JSON.stringify(recordCopy), originalSnapshot);
});

test('handles leap year, year 0001, and year 0099 complete month boundaries', () => {
  // Leap year 2024-02: 29 days
  const leapRes = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '2024-02-01',
    periodEnd: '2024-02-29',
    records: [{ id: 'r-leap', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2024, month: 2 }, quantity: 1, unit: 'kg', status: 'actual', provenance: 'farm-record' }],
  });
  assert.equal(leapRes.status, 'ready');
  assert.equal(leapRes.rows.length, 1);
  assert.equal(leapRes.rows[0].periodEnd, '2024-02-29');

  // Year 0001-01: 31 days
  const y1Res = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '0001-01-01',
    periodEnd: '0001-01-31',
    records: [{ id: 'r-y1', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 1, month: 1 }, quantity: 2, unit: 'kg', status: 'actual', provenance: 'farm-record' }],
  });
  assert.equal(y1Res.status, 'ready');
  assert.equal(y1Res.rows.length, 1);
  assert.equal(y1Res.rows[0].periodStart, '0001-01-01');
  assert.equal(y1Res.rows[0].periodEnd, '0001-01-31');

  // Year 0099-02: 28 days (not leap)
  const y99Res = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '0099-02-01',
    periodEnd: '0099-02-28',
    records: [{ id: 'r-y99', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 99, month: 2 }, quantity: 3, unit: 'kg', status: 'actual', provenance: 'farm-record' }],
  });
  assert.equal(y99Res.status, 'ready');
  assert.equal(y99Res.rows.length, 1);
  assert.equal(y99Res.rows[0].periodStart, '0099-02-01');
  assert.equal(y99Res.rows[0].periodEnd, '0099-02-28');
});

test('two legitimate sites sharing same row id in both orders retain chosen site', () => {
  const rowAlpha = { id: 'shared-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 10, unit: 'kg', status: 'actual', provenance: 'farm-record' };
  const rowBeta = { id: 'shared-id', siteId: 'site-beta', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 20, unit: 'kg', status: 'actual', provenance: 'farm-record' };

  // Order 1: alpha then beta
  const req1 = { siteId: 'site-alpha', periodStart: '2026-01-01', periodEnd: '2026-01-31', records: [rowAlpha, rowBeta] };
  const res1 = previewRecordedHarvest(req1);
  assert.equal(res1.status, 'ready');
  assert.equal(res1.rows.length, 1);
  assert.equal(res1.rows[0].quantityKg, 10);
  assert.equal(res1.excluded.length, 1);
  assert.ok(res1.excluded[0].reasons.includes('different-site'));

  // Order 2: beta then alpha
  const req2 = { siteId: 'site-alpha', periodStart: '2026-01-01', periodEnd: '2026-01-31', records: [rowBeta, rowAlpha] };
  const res2 = previewRecordedHarvest(req2);
  assert.equal(res2.status, 'ready');
  assert.equal(res2.rows.length, 1);
  assert.equal(res2.rows[0].quantityKg, 10);
  assert.equal(res2.excluded.length, 1);
  assert.ok(res2.excluded[0].reasons.includes('different-site'));
});

test('holds on duplicate scoped ID or duplicate normalization identity in either order', () => {
  // Scoped ID duplicate in both orders
  const scopedIdOrder1: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      { id: 'dup-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 1, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      { id: 'dup-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 2 }, quantity: 2, unit: 'kg', status: 'actual', provenance: 'farm-record' },
    ],
  };
  assert.equal(previewRecordedHarvest(scopedIdOrder1).status, 'held');

  const scopedIdOrder2: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      { id: 'dup-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 2 }, quantity: 2, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      { id: 'dup-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 1, unit: 'kg', status: 'actual', provenance: 'farm-record' },
    ],
  };
  assert.equal(previewRecordedHarvest(scopedIdOrder2).status, 'held');

  // Normalization identity duplicate in both orders
  const identityOrder1: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      { id: 'first-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 1, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      { id: 'second-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 2, unit: 'kg', status: 'actual', provenance: 'farm-record' },
    ],
  };
  assert.equal(previewRecordedHarvest(identityOrder1).status, 'held');

  const identityOrder2: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      { id: 'second-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 2, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      { id: 'first-id', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: 1, unit: 'kg', status: 'actual', provenance: 'farm-record' },
    ],
  };
  assert.equal(previewRecordedHarvest(identityOrder2).status, 'held');
});

test('subtotal overflow yields null with reason using finite synthetic quantities across distinct months', () => {
  const req: PreviewRecordedHarvestRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    records: [
      { id: 'r1', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 1 }, quantity: Number.MAX_VALUE, unit: 'kg', status: 'actual', provenance: 'farm-record' },
      { id: 'r2', siteId: 'site-alpha', sourceIconKey: 'crop:cabbage', label: 'L', date: { year: 2026, month: 2 }, quantity: Number.MAX_VALUE, unit: 'kg', status: 'actual', provenance: 'farm-record' },
    ],
  };
  const res = previewRecordedHarvest(req);
  assert.equal(res.status, 'ready');
  assert.equal(res.rows.length, 2);
  assert.equal(res.knownSubtotalKg, null);
  assert.ok(res.reasons.includes('decimal-sum-overflow'));
});

test('zero getter calls: accessors on request or records are never invoked before or during detachment', () => {
  let requestGetterCalls = 0;
  const badRequest = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    get records() {
      requestGetterCalls++;
      return [];
    },
  };
  const res1 = previewRecordedHarvest(badRequest);
  assert.equal(res1.status, 'held');
  assert.equal(requestGetterCalls, 0);

  let rowGetterCalls = 0;
  const badRow = {
    id: 'rec-1',
    siteId: 'site-alpha',
    get quantity() {
      rowGetterCalls++;
      return 10;
    },
  };
  const res2 = previewRecordedHarvest({
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: [badRow],
  });
  assert.equal(res2.status, 'held');
  assert.equal(rowGetterCalls, 0);
});

test('does not mutate input records or request', () => {
  const row = {
    id: 'rec-test',
    siteId: 'site-alpha',
    sourceIconKey: 'crop:cabbage',
    label: 'Recorded fixture',
    date: { year: 2026, month: 1 },
    quantity: 10,
    unit: 'kg' as const,
    status: 'actual' as const,
    provenance: 'farm-record' as const,
  };
  const originalSnapshot = JSON.stringify(row);
  const request = {
    siteId: 'site-alpha',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    records: [row],
  };
  previewRecordedHarvest(request);
  assert.equal(JSON.stringify(row), originalSnapshot);
});

test('preserves original productionProjectEvidence and existingProjectReference exports behavior', () => {
  const ref = existingProjectReference('production-records', { id: 'test-rec-1' });
  assert.equal(ref.authority, 'production-records');
  assert.equal(ref.id, 'test-rec-1');

  const evidence = productionProjectEvidence(
    [
      {
        id: 'test-rec-1',
        siteId: 'site-1',
        sourceIconKey: 'crop:cabbage',
        label: 'Recorded fixture',
        date: { year: 2026, month: 1 },
        quantity: 15,
        unit: 'kg',
        status: 'actual',
        provenance: 'farm-record',
      },
    ],
    {
      projectId: 'proj-1',
      recordedOn: '2026-02-01',
      consent: 'granted',
      published: true,
    },
  );
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].projectId, 'proj-1');
  assert.equal(evidence[0].quantity, 15);
  assert.equal(evidence[0].periodStart, '2026-01-01');
  assert.equal(evidence[0].periodEnd, '2026-01-31');
});
