import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import {
  buildGrowerNurseryForecast,
  nurserySettingsFingerprint,
  projectGrowerNurseryPreparation,
  type GrowerNurseryRequest,
  type GrowerNurseryResult,
} from '../lib/international/grower-nursery.ts';
import { buildGrowerNurseryBatchLabelsPdf } from '../lib/nursery-export.ts';

const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided',
  value,
  unit,
  provenance: { kind: 'grower-estimate', recordedAt: stamp },
});

const crop = CROPS.find(row => !row.transplant)!;

async function fixture(overrides: {
  demandsCount?: number;
  omitSpaces?: boolean;
  fieldSurvivalPercent?: number;
  multipleCrops?: boolean;
} = {}) {
  const cropsToUse = overrides.multipleCrops
    ? CROPS.filter(row => !row.transplant).slice(0, 8)
    : [crop];
  const siteId = 'site:0.00000,0.00000';
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId;
  canvas.frame.centerLat = 0;
  canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = Array.from({ length: cropsToUse.length * 2 }, (_, index) => ({
    ...template,
    id: `private-preparation-bed-${index}`,
    x: 0.03 + index * 0.05,
    y: 0.5,
    wM: 3,
    hM: 4,
  }));
  canvas.zones = [];
  canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(
    inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw: canvas, sourceRevision: 'private-prep-source' })
  );
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const scope = source.scope;

  const profiles: GrowerPlanningProfile[] = cropsToUse.map((c, i) => ({
    version: 1,
    profileId: `private-prep-profile-${i}`,
    cropKey: c.key,
    scope,
    inputs: {
      plantsPerM2: own(4, 'plants/m2'),
      yieldKgPerM2: own(1, 'kg/m2/cycle'),
      establishment: own('transplant', 'method'),
      nurseryDays: own(10, 'days'),
      fieldEntryToFirstHarvestDays: own(1, 'days'),
      pickingDays: own(2, 'days'),
      fieldOccupancyDays: own(3, 'days'),
      turnaroundDays: own(1, 'days'),
      allowedEntryMonths: own([2], 'utc-months'),
    },
  }));

  const demandsCount = overrides.demandsCount ?? cropsToUse.length;
  const demands = profiles.slice(0, demandsCount).map((p, i) => ({
    demandId: `private-prep-demand-${i}`,
    profileId: p.profileId,
    scope,
    totalKg: own(13, 'kg-total'),
    harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window'),
  }));

  const request: GrowerAutoPlanRequest = {
    requestedAt: stamp,
    scope,
    geometryFingerprint: source.geometryFingerprint,
    profiles,
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'),
    planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({
      bedId: bed.id,
      scope,
      window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    })),
    reserved: [],
    demands,
    maxAssessments: 1000,
  };

  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready');

  const settings: NurserySettings = {
    version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Fixture container', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: overrides.omitSpaces
      ? []
      : [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Fixture surface', usableM2: 10 }],
    profiles: profiles.map((p, i) => ({
      id: `private-recipe-${i}`,
      siteId: source.resourceSiteId,
      cropKey: p.cropKey,
      model: 'seed-cell',
      containerId: 'private-tray',
      spaceId: 'private-bench',
      fieldSurvivalPercent: overrides.fieldSurvivalPercent ?? 80,
      germinationPercent: 50,
      nurserySurvivalPercent: 75,
    })),
  };

  const review: GrowerNurseryRequest = {
    source: { kind: 'proposal', proposal, currentRequest: request, competingDemand: 'assessed-none' },
    resourceContext: source,
    settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    // A ready resource review needs dated allocations matching saved container/space IDs;
    // saved equipment alone never establishes that its containers and bench are available.
    availability: own([
      { resourceKind: 'container' as const, resourceId: 'private-tray', scope,
        quantity: 20, window: { start: '2028-02-01', endExclusive: '2028-03-15' } },
      ...(!overrides.omitSpaces ? [{ resourceKind: 'space' as const, resourceId: 'private-bench', scope,
        quantity: 10, window: { start: '2028-02-01', endExclusive: '2028-03-15' } }] : []),
    ], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations'),
  };

  const result = buildGrowerNurseryForecast(review);
  return { source, review, result };
}

function extractPdfStreamText(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const matches: string[] = [];
  const regex = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const unescaped = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
    matches.push(unescaped);
  }
  return matches.join(' ');
}

test('buildGrowerNurseryBatchLabelsPdf creates batch card with required titles, counts, cut guide and privacy', async () => {
  const { result } = await fixture();
  assert.equal(result.status, 'ready');
  assert.ok(result.batches.length > 0);

  const projection = projectGrowerNurseryPreparation(result);
  assert.equal(projection.status, 'available');
  assert.equal(projection.groups.length, 1);
  // Both batches belong to 1 single preparation group (same crop, profile, start date)
  assert.equal(result.batches.length, 2);

  const blob = await buildGrowerNurseryBatchLabelsPdf(result);
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');

  const buffer = Buffer.from(await blob.arrayBuffer());
  const extracted = extractPdfStreamText(buffer);

  // Cards per group, not per tray or batch count: exactly 1 card page produced
  const pageMatch = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  assert.equal(pageMatch?.length, 1);

  // Card titles and headings
  assert.match(extracted, /PLANNED NURSERY BATCH/);
  assert.match(extracted, /CUT \/ FOLD GUIDE - ATTACH OR KEEP WITH BATCH/);
  // Overall review and included group completeness answer different questions.
  assert.match(extracted, /Overall review status: Reviewed inputs complete/);
  assert.match(extracted, /Batch group status: Included counts complete/);
  assert.match(extracted, /Raising starts/);
  assert.match(extracted, /Raising ends before field entry/);

  // Assert exact counts from real forecast
  assert.match(extracted, /Final field positions 96/);
  assert.match(extracted, /Starts to raise 120/);
  assert.match(extracted, /Seeds to sow 320/);

  // Loss and scope caveats
  assert.match(extracted, /Loss estimates: Calculated counts already include/);
  assert.match(extracted, /Planning card only: Not verified tray labels/);
  assert.match(extracted, /Handwritten nursery notes/);
  assert.match(extracted, /Actual sowing date:/);
  assert.match(extracted, /Seed lot \/ cultivar name:/);

  // Canonical crop name preserved
  const sanitizedCropName = crop.name.replace(/[‐-―]/g, '-');
  assert.match(extracted, new RegExp(sanitizedCropName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // Privacy: No private IDs, fingerprints, receipts
  assert.doesNotMatch(extracted, /private-prep-profile/);
  assert.doesNotMatch(extracted, /private-prep-source/);
  assert.doesNotMatch(extracted, /private-tray/);
  assert.doesNotMatch(extracted, /private-bench/);
});

test('buildGrowerNurseryBatchLabelsPdf creates one card per group for multiple preparation groups', async () => {
  const { result } = await fixture({ multipleCrops: true });
  assert.equal(result.status, 'ready');
  const projection = projectGrowerNurseryPreparation(result);
  assert.ok(projection.groups.length >= 6);

  const blob = await buildGrowerNurseryBatchLabelsPdf(result);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const extracted = extractPdfStreamText(buffer);

  const pageMatches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  // Each preparation group gets its own card on separate pages
  assert.equal(pageMatches?.length, projection.groups.length);

  for (const group of projection.groups) {
    const safeName = group.cropName.replace(/[‐-―]/g, '-');
    assert.match(extracted, new RegExp(safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('buildGrowerNurseryBatchLabelsPdf stamps DEMO notice on every page when sample option is set', async () => {
  const { result } = await fixture({ multipleCrops: true });
  const blob = await buildGrowerNurseryBatchLabelsPdf(result, { sample: true });
  const buffer = Buffer.from(await blob.arrayBuffer());
  const extracted = extractPdfStreamText(buffer);

  assert.match(extracted, /DEMO - EXAMPLE PLANNING DATA/);

  const prodBlob = await buildGrowerNurseryBatchLabelsPdf(result, { sample: false });
  const prodExtracted = extractPdfStreamText(Buffer.from(await prodBlob.arrayBuffer()));
  assert.doesNotMatch(prodExtracted, /DEMO - EXAMPLE PLANNING DATA/);
});

test('buildGrowerNurseryBatchLabelsPdf formats unknown subtotal, wholly unknown, zero and overflow correctly', async () => {
  const { result } = await fixture();

  // Test explicit zero
  const zeroResult: GrowerNurseryResult = {
    ...result,
    batches: [{ ...result.batches[0], targetPositions: 0, starts: 0, seeds: 0 }],
  };
  const zeroBlob = await buildGrowerNurseryBatchLabelsPdf(zeroResult);
  const zeroText = extractPdfStreamText(Buffer.from(await zeroBlob.arrayBuffer()));
  assert.match(zeroText, /Final field positions 0/);
  assert.match(zeroText, /Starts to raise 0/);
  assert.match(zeroText, /Seeds to sow 0/);

  // Test unknown subtotal: Retain actual two original members and make exactly one seeds: null
  // Each member originally has 160 seeds (total 320 across the 2 batches).
  // With one member's seeds unknown, known subtotal is 160 and total is unknown.
  assert.equal(result.batches.length, 2);
  assert.equal(result.batches[0].seeds, 160);
  assert.equal(result.batches[1].seeds, 160);
  const unknownSubtotalResult: GrowerNurseryResult = {
    ...result,
    batches: [
      result.batches[0],
      { ...result.batches[1], seeds: null, incomplete: true },
    ],
  };
  const unknownBlob = await buildGrowerNurseryBatchLabelsPdf(unknownSubtotalResult);
  const unknownText = extractPdfStreamText(Buffer.from(await unknownBlob.arrayBuffer()));
  assert.match(unknownText, /Unknown total; known subtotal 160/);

  // Test wholly unknown subtotal: When all batch counts in a metric are null, known subtotal is null and total is unknown
  const whollyUnknownResult: GrowerNurseryResult = {
    ...result,
    batches: result.batches.map(b => ({ ...b, seeds: null, incomplete: true })),
  };
  const whollyUnknownBlob = await buildGrowerNurseryBatchLabelsPdf(whollyUnknownResult);
  const whollyUnknownText = extractPdfStreamText(Buffer.from(await whollyUnknownBlob.arrayBuffer()));
  // The shared formatter retains the subtotal label, with an unknown value;
  // absence of a numeric subtotal is the rule, not absence of that label.
  const whollyUnknownProjection = projectGrowerNurseryPreparation(whollyUnknownResult);
  assert.equal(whollyUnknownProjection.groups[0].seedsToSow.knownSubtotal, null);
  assert.equal(whollyUnknownProjection.groups[0].seedsToSow.total, null);
  assert.match(whollyUnknownText, /Seeds to sow Unknown total; known subtotal Unknown/);
  assert.doesNotMatch(whollyUnknownText, /Seeds to sow Unknown total; known subtotal [0-9]/);

  // Test overflow status formatting
  const overflowGroupResult: GrowerNurseryResult = {
    ...result,
    batches: [
      { ...result.batches[0], targetPositions: Number.MAX_SAFE_INTEGER, starts: Number.MAX_SAFE_INTEGER, seeds: Number.MAX_SAFE_INTEGER },
      { ...result.batches[1], targetPositions: Number.MAX_SAFE_INTEGER, starts: Number.MAX_SAFE_INTEGER, seeds: Number.MAX_SAFE_INTEGER },
    ],
  };
  const overflowBlob = await buildGrowerNurseryBatchLabelsPdf(overflowGroupResult);
  const overflowText = extractPdfStreamText(Buffer.from(await overflowBlob.arrayBuffer()));
  assert.match(overflowText, /Total unavailable; review input counts/);
});

test('buildGrowerNurseryBatchLabelsPdf displays overall incomplete notice even when individual group counts are complete', async () => {
  const { review } = await fixture();
  assert.equal(review.source.kind, 'proposal');
  if (review.source.kind !== 'proposal') throw Error('Fixture source');

  // Competing demand unresolved marks overall review status partial
  const partialResult = buildGrowerNurseryForecast({
    ...review,
    source: { ...review.source, competingDemand: 'unresolved' },
  });
  assert.equal(partialResult.status, 'partial');

  const projection = projectGrowerNurseryPreparation(partialResult);
  // Verify that all group metrics are complete despite overall review being incomplete
  assert.ok(projection.groups.every(group => [group.fieldPositions, group.startsToRaise, group.seedsToSow].every(metric => metric.status === 'complete')));

  const blob = await buildGrowerNurseryBatchLabelsPdf(partialResult);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  // Card must display overall incomplete review status and not claim ready
  assert.match(text, /Overall review status: Incomplete review/);
  assert.match(text, /Batch group status: Included counts complete/);
});

test('buildGrowerNurseryBatchLabelsPdf retains all distinct exclusive field entry dates across pagination', async () => {
  const { result } = await fixture();
  // Synthetic long list of 360 distinct daily field entry dates to genuinely exercise card pagination (>1 page)
  // Each batch has a distinct valid ID, isGrowerUtcDate format, and consistent group membership.
  const baseStart = new Date('2028-02-20T00:00:00.000Z');
  const dates = Array.from({ length: 360 }, (_, i) => {
    const d = new Date(baseStart.getTime() + i * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const longListResult: GrowerNurseryResult = {
    ...result,
    batches: dates.map((d, i) => ({
      ...result.batches[0],
      id: `batch-long-date-${i}`,
      plantingIds: [`planting-long-${i}`],
      bedIds: [`bed-long-${i}`],
      endDateExclusive: d,
    })),
  };

  const projection = projectGrowerNurseryPreparation(longListResult);
  assert.equal(projection.status, 'available');
  assert.equal(projection.groups.length, 1);
  assert.equal(projection.groups[0].members.length, 360);

  const blob = await buildGrowerNurseryBatchLabelsPdf(longListResult);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const extracted = extractPdfStreamText(buffer);

  // Assert >1 page is produced for this single group due to text wrapping & overflow
  const pageMatches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  assert.ok((pageMatches?.length ?? 0) > 1, `Expected >1 page for 360 dates, got ${pageMatches?.length}`);

  // Assert continuation group header context is rendered on continuation pages
  assert.match(extracted, /PLANNED NURSERY BATCH \(continued\)/);

  // Assert every single date is retained and printed in the output stream
  for (const d of dates) {
    assert.match(extracted, new RegExp(d));
  }
});

test('buildGrowerNurseryBatchLabelsPdf refuses when projection status is unavailable', async () => {
  const malformed = {
    basis: 'grower-nursery-estimates',
    status: 'invalid-inputs',
    issues: ['preparation-review-unavailable'],
  } as unknown as GrowerNurseryResult;

  await assert.rejects(
    async () => {
      await buildGrowerNurseryBatchLabelsPdf(malformed);
    },
    { message: /The preparation worksheet is unavailable/ }
  );
});

test('buildGrowerNurseryBatchLabelsPdf preserves canonical crop name and ignores untrusted batch display markers', async () => {
  const { result } = await fixture();
  // Tampered batch display names cannot override canonical crop identity from cropKey
  const untrustedMarker = 'UNTRUSTED_TAMPERED_DISPLAY_NAME';
  const tamperedResult: GrowerNurseryResult = {
    ...result,
    batches: result.batches.map(b => ({ ...b, cropName: untrustedMarker })),
  };
  const blob = await buildGrowerNurseryBatchLabelsPdf(tamperedResult);
  const extracted = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  // Canonical crop name is preserved from crop identity, not untrusted batch display marker
  const sanitizedCropName = crop.name.replace(/[‐-―]/g, '-');
  assert.match(extracted, new RegExp(sanitizedCropName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(extracted, new RegExp(untrustedMarker));
});

test('buildGrowerNurseryBatchLabelsPdf renders overall status, source, horizon and issues on empty partial results', async () => {
  const { review } = await fixture();
  assert.equal(review.source.kind, 'proposal');
  if (review.source.kind !== 'proposal') throw Error('Fixture source');

  // Exercise the pure empty projection using a partial forecast; this is a synthetic projection fixture, not a claimed new automatic-plan result.
  const emptyPartialResult: GrowerNurseryResult = {
    ...buildGrowerNurseryForecast({
      ...review,
      source: { ...review.source, competingDemand: 'unresolved' },
    }),
    batches: [],
  };

  const projection = projectGrowerNurseryPreparation(emptyPartialResult);
  assert.equal(projection.status, 'available');
  assert.equal(projection.groups.length, 0);
  assert.equal(projection.reviewStatus, 'partial');
  assert.equal(projection.projectionIncomplete, true);
  assert.ok(projection.issues.includes('competing-nursery-demand-unresolved'));

  const blob = await buildGrowerNurseryBatchLabelsPdf(emptyPartialResult);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  // Overall status, source and horizon must be printed even when zero groups are represented
  assert.match(text, /Overall review status: Incomplete review/);
  assert.match(text, /Source: Proposed crop cycles\. Grower estimates; source not verified\./);
  assert.match(text, /Review horizon: 2028-02-01 to before 2028-03-15 \(UTC\)/);
  assert.match(text, /No transplant batches are represented in this review\. This does not establish a zero requirement for the whole garden\./);
  // Empty output must retain the actual hold as well as its incomplete heading.
  assert.match(text, /Review note: Some required nursery inputs or source checks remain unresolved\./);
  assert.match(text, /Planning card only: Not verified tray labels, observed sowing, nursery stock or seedling readiness\./);
});
