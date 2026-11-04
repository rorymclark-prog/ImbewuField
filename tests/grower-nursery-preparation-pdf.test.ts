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
import { buildGrowerNurseryPreparationPdf } from '../lib/nursery-export.ts';

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
  // Enough independent measured beds for each synthetic demand. The former
  // five-bed fixture could not fit eight two-bed targets and was not "ready".
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
    maxAssessments: 10000,
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
    // A ready resource review needs dated allocations; saved equipment alone
    // never establishes that its containers and bench are available.
    availability: own([
      { resourceKind: 'container' as const, resourceId: 'private-tray', scope,
        quantity: 20, window: { start: '2028-02-01', endExclusive: '2028-03-15' } },
      ...(!overrides.omitSpaces ? [{ resourceKind: 'space' as const, resourceId: 'private-bench', scope,
        quantity: 10, window: { start: '2028-02-01', endExclusive: '2028-03-15' } }] : []),
    ], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations'),
  };

  const result = buildGrowerNurseryForecast(review);
  return { source, review, result, settings };
}

// Bounded PDF stream text extractor that handles jsPDF string escaping (e.g. \( and \))
function extractPdfStreamText(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  // Match text in ( ... ) blocks preceding Tj, ' or " operators
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

test('buildGrowerNurseryPreparationPdf generates valid PDF with distinct metrics and expected notices', async () => {
  const { result } = await fixture();
  assert.equal(result.status, 'ready');
  assert.ok(result.batches.length > 0);

  const blob = await buildGrowerNurseryPreparationPdf(result);
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');

  const buffer = Buffer.from(await blob.arrayBuffer());
  const extracted = extractPdfStreamText(buffer);

  // Check titles and scope notices
  assert.match(extracted, /Planned transplant preparation/);
  assert.match(extracted, /Overall review status: Reviewed inputs complete/);
  assert.match(extracted, /source not verified/i);
  assert.match(extracted, /Coverage: Represented transplant raising batches only/);
  assert.match(extracted, /Loss estimates: Calculated counts already include/);
  assert.match(extracted, /Status: Included counts complete/);
  assert.match(extracted, /Raising ends before field entry/);

  // These two real forecast batches have already included the supplied losses.
  // A loose /48/ also matched dates and would miss omission or a second loss factor.
  assert.deepEqual(result.batches.map(batch => [batch.targetPositions, batch.starts, batch.seeds]), [[48, 60, 160], [48, 60, 160]]);
  assert.match(extracted, /Final field positions 96 Starts to raise 120 Seeds to sow 320/);
  assert.match(extracted, /does not establish resource availability/);

  // Crop name with possible parentheses
  const sanitizedCropName = crop.name.replace(/[‐-―]/g, '-');
  assert.match(extracted, new RegExp(sanitizedCropName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // Privacy: no raw private IDs or receipts
  assert.doesNotMatch(extracted, /private-prep-profile/);
  assert.doesNotMatch(extracted, /private-prep-source/);
  assert.doesNotMatch(extracted, /private-tray/);
  assert.doesNotMatch(extracted, /private-bench/);
});

test('buildGrowerNurseryPreparationPdf stamps DEMO header when sample=true and omits when sample=false', async () => {
  const { result } = await fixture();

  const demoBlob = await buildGrowerNurseryPreparationPdf(result, { sample: true });
  const demoText = extractPdfStreamText(Buffer.from(await demoBlob.arrayBuffer()));
  assert.match(demoText, /DEMO - EXAMPLE PLANNING DATA/);

  const prodBlob = await buildGrowerNurseryPreparationPdf(result, { sample: false });
  const prodText = extractPdfStreamText(Buffer.from(await prodBlob.arrayBuffer()));
  assert.doesNotMatch(prodText, /DEMO - EXAMPLE PLANNING DATA/);
});

test('buildGrowerNurseryPreparationPdf refuses when projection status is unavailable', async () => {
  const malformed = {
    basis: 'grower-nursery-estimates',
    status: 'invalid-inputs',
    issues: ['preparation-review-unavailable'],
  } as unknown as GrowerNurseryResult;

  await assert.rejects(
    async () => {
      await buildGrowerNurseryPreparationPdf(malformed);
    },
    { message: /The preparation worksheet is unavailable/ }
  );
});

test('buildGrowerNurseryPreparationPdf handles partial review with complete included groups and overall incomplete notice', async () => {
  const { review } = await fixture();
  assert.equal(review.source.kind, 'proposal');
  if (review.source.kind !== 'proposal') throw Error('Fixture source');
  const result = buildGrowerNurseryForecast({ ...review, source: { ...review.source, competingDemand: 'unresolved' } });
  assert.equal(result.status, 'partial');
  const projection = projectGrowerNurseryPreparation(result);
  assert.ok(projection.groups.every(group => [group.fieldPositions, group.startsToRaise, group.seedsToSow].every(metric => metric.status === 'complete')));

  const blob = await buildGrowerNurseryPreparationPdf(result);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  // Even if individual crop counts are calculated, overall review must be flagged Incomplete
  assert.match(text, /Overall review status: Incomplete review/);
});

test('buildGrowerNurseryPreparationPdf formats unknown totals and known subtotals distinctly', async () => {
  const { result } = await fixture();
  // Construct a synthetic group with unknown total and known subtotal
  const syntheticResult: GrowerNurseryResult = {
    ...result,
    batches: [
      result.batches[0],
      { ...result.batches[0], id: 'synthetic-batch-unknown-seeds', seeds: null, incomplete: true },
    ],
  };

  const blob = await buildGrowerNurseryPreparationPdf(syntheticResult);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  assert.match(text, /Final field positions 96 Starts to raise 120 Seeds to sow Unknown total; known subtotal 160/);
});

test('buildGrowerNurseryPreparationPdf retains explicit zero without converting to unknown', async () => {
  const { review, settings: originalSettings } = await fixture();
  const settings = structuredClone(originalSettings);
  settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 20, seedsPerTray: 0 };
  const result = buildGrowerNurseryForecast({ ...review, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.batches.map(batch => batch.seeds), [0, 0]);
  const blob = await buildGrowerNurseryPreparationPdf(result);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  assert.match(text, /Final field positions 96 Starts to raise 120 Seeds to sow 0/);
});

test('buildGrowerNurseryPreparationPdf handles multiple groups with pagination, continuation headers and no lost groups', async () => {
  const { result } = await fixture({ multipleCrops: true });
  assert.ok(result.batches.length >= 6);

  const blob = await buildGrowerNurseryPreparationPdf(result, { sample: true });
  const buffer = Buffer.from(await blob.arrayBuffer());
  const text = buffer.toString('latin1');
  const extracted = extractPdfStreamText(buffer);
  const projection = projectGrowerNurseryPreparation(result);

  // Must span multiple pages
  assert.match(text, /Page \d+ of [2-9]/);
  const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pageCount > 1);
  assert.equal((extracted.match(/DEMO - EXAMPLE PLANNING DATA/g) ?? []).length, pageCount);
  assert.equal((extracted.match(/Source not verified; not observed sowing or nursery stock/g) ?? []).length, pageCount);
  assert.equal((extracted.match(/Final field positions/g) ?? []).length, projection.groups.length);
  assert.equal((extracted.match(/Starts to raise/g) ?? []).length, projection.groups.length);
  assert.equal((extracted.match(/Seeds to sow/g) ?? []).length, projection.groups.length);
  for (const [index, group] of projection.groups.entries()) assert.ok(extracted.includes(`${group.cropName} - preparation group ${index + 1}`));
  // Notes area appears
  assert.match(extracted, /Notes \(written on sheet - not saved by app\)/);
});

test('a long raising-date list and every group survive page breaks without private membership or raw issue leakage', async () => {
  const { result } = await fixture();
  // Deliberate renderer stress data, not an authenticated forecast or crop instruction.
  // Force a paragraph longer than a page; 180 short dates can legitimately fit.
  const dates = Array.from({ length: 360 }, (_, index) => new Date(Date.UTC(2028, 1, 19 + index)).toISOString().slice(0, 10));
  const long: GrowerNurseryResult = { ...result, status: 'partial', issues: ['private-raw-overall-issue'],
    batches: dates.map((date, index) => ({ ...result.batches[0], id: `private-long-batch-${index}`, endDateExclusive: date,
      incomplete: true, issues: ['private-raw-batch-issue'] })) };
  const blob = await buildGrowerNurseryPreparationPdf(long, { sample: true });
  const raw = Buffer.from(await blob.arrayBuffer()), text = extractPdfStreamText(raw);
  assert.ok((raw.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length > 1);
  for (const date of dates) assert.ok(text.includes(date), `Missing exact exclusive date ${date}`);
  assert.match(text, /Final field positions 17280 Starts to raise 21600 Seeds to sow 57600/);
  assert.doesNotMatch(text, /private-|sourceKey|geometryFingerprint/);
});

test('overflow and wholly unknown seed counts retain their distinct holds in the actual PDF', async () => {
  const { result } = await fixture();
  const overflow: GrowerNurseryResult = { ...result, batches: [
    { ...result.batches[0], targetPositions: Number.MAX_SAFE_INTEGER },
    { ...result.batches[1], targetPositions: 1 },
  ] };
  const overflowText = extractPdfStreamText(Buffer.from(await (await buildGrowerNurseryPreparationPdf(overflow)).arrayBuffer()));
  assert.match(overflowText, /Final field positions Total unavailable; review input counts Starts to raise 120 Seeds to sow 320/);
  const unknown: GrowerNurseryResult = { ...result, batches: result.batches.map(batch => ({ ...batch, seeds: null, incomplete: true })) };
  const unknownText = extractPdfStreamText(Buffer.from(await (await buildGrowerNurseryPreparationPdf(unknown)).arrayBuffer()));
  assert.match(unknownText, /Seeds to sow Unknown total; known subtotal Unknown/);
  assert.doesNotMatch(unknownText, /Seeds to sow 0/);
});

test('buildGrowerNurseryPreparationPdf handles empty groups with garden scope disclaimer', async () => {
  const { result } = await fixture();
  const emptyBatchesResult: GrowerNurseryResult = {
    ...result,
    batches: [],
  };

  const blob = await buildGrowerNurseryPreparationPdf(emptyBatchesResult);
  const text = extractPdfStreamText(Buffer.from(await blob.arrayBuffer()));

  assert.match(text, /No transplant batches are represented in this review/);
  assert.match(text, /This does not establish a zero requirement for the whole garden/);
});
