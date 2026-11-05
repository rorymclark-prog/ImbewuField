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
import { buildGrowerNurseryBatchLabelsPdf, buildGrowerNurseryPreparationPdf, buildGrowerNurseryCsv, buildGrowerNurseryPreparationCsv, NurseryReferenceExportError } from '../lib/nursery-export.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { Planting } from '../lib/crop-plan.ts';

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

interface ReferenceFields { variety: string | null; seedLotReference: string | null; raisingBatchReference: string | null }
async function savedFixture(fields: readonly ReferenceFields[] = [
  { variety: 'Engineering A', seedLotReference: 'Lot one', raisingBatchReference: 'Raise one' },
  { variety: 'Engineering B', seedLotReference: 'Lot two', raisingBatchReference: 'Raise two' },
]) {
  const f = await fixture();
  assert.equal(f.review.source.kind, 'proposal');
  if (f.review.source.kind !== 'proposal') throw Error('Real proposal missing');
  const rows: Planting[] = f.review.source.proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-accepted-member-${index}`,
      acceptedAt: stamp, geometryFingerprint: f.source.geometryFingerprint });
    assert.ok(row);
    const values = fields[index] ?? fields[0];
    return { ...row, ...(values.variety === null ? {} : { variety: values.variety }),
      nurseryBatchReference: { kind: 'planned-nursery-reference', version: 1, plantingId: row.id,
        scope: f.source.scope, assessmentFingerprint: row.growerCycle.assessmentFingerprint,
        ...(values.seedLotReference === null ? {} : { seedLotReference: values.seedLotReference }),
        ...(values.raisingBatchReference === null ? {} : { raisingBatchReference: values.raisingBatchReference }) } };
  });
  const request: GrowerNurseryRequest = { ...f.review, source: { kind: 'saved-cycles', rows,
    cycleContext: { scope: f.source.scope, beds: f.source.beds, geometryFingerprint: f.source.geometryFingerprint } } };
  const result = buildGrowerNurseryForecast(request);
  assert.equal(result.sourceStatus, 'saved-planned'); assert.equal(result.batches.length, 2);
  return { ...f, rows, request, result };
}

// Decode actual PDF content streams through the embedded ToUnicode maps. A
// Latin1-only regex cannot see entered text after the bundled TrueType encoder.
function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1'), objects = new Map<string, string>();
  for (const item of raw.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)) objects.set(item[1], item[2]);
  const fonts = new Map<string, Map<number, string>>();
  for (const resource of raw.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const font = objects.get(resource[2]), unicode = font?.match(/\/ToUnicode (\d+) 0 R/);
    if (!unicode) continue;
    const map = new Map<number, string>(), cmap = objects.get(unicode[1]) ?? '';
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const pair of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(pair[1], 16), String.fromCharCode(parseInt(pair[2], 16)));
    }
    fonts.set(resource[1], map);
  }
  const lines: string[] = [];
  for (const block of raw.matchAll(/BT\b([\s\S]*?)ET\b/g)) {
    const name = block[1].match(/\/(F\d+) [\d.]+ Tf/)?.[1];
    if (!name) continue;
    const value = block[1].match(/<([0-9a-f]+)>\s*Tj/gi);
    if (value) for (const encoded of value) {
      const hex = encoded.match(/<([0-9a-f]+)>/i)![1], map = fonts.get(name);
      assert.ok(map, 'an embedded text font must supply its actual Unicode map');
      lines.push((hex.match(/.{4}/g) ?? []).map(code => { const text = map.get(parseInt(code,16)); assert.notEqual(text, undefined); return text; }).join(''));
    }
    for (const plain of block[1].matchAll(/\(((?:\\[\s\S]|[^\\()])*)\)\s*Tj/g)) lines.push(plain[1].replace(/\\([()\\])/g, '$1'));
  }
  return lines.join('\n');
}
function csvRows(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') { if (quoted && source[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && ch === ',') { row.push(cell); cell = ''; }
    else if (!quoted && ch === '\r' && source[i+1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  const header = rows.shift()!;
  return rows.map(values => Object.fromEntries(header.map((key,index) => [key,values[index]])));
}
const pdfBuilders = [buildGrowerNurseryPreparationPdf, buildGrowerNurseryBatchLabelsPdf];
const privateText = /private-|assessmentFingerprint|geometryFingerprint|sourceKey|plantingId/;

test('two same-day accepted members keep distinct planned references beside their dates without changing grouped quantities', async () => {
  const f = await savedFixture(), before = JSON.stringify(f.result), projection = projectGrowerNurseryPreparation(f.result);
  assert.equal(projection.groups.length, 1);
  assert.deepEqual([projection.groups[0].fieldPositions.total, projection.groups[0].startsToRaise.total, projection.groups[0].seedsToSow.total], [96,120,320]);
  for (const build of pdfBuilders) {
    const text = pdfText(Buffer.from(await (await build(f.result)).arrayBuffer()));
    const first = text.indexOf('Member 1:'), second = text.indexOf('Member 2:');
    assert.ok(first >= 0 && second > first);
    assert.match(text.replace(/\s+/g,' '), /Final field positions 96 Starts to raise 120 Seeds to sow 320/);
    assert.match(text.slice(first,second), /Variety: Engineering A/);
    assert.match(text.slice(first,second), /Seed lot reference: Lot one/);
    assert.match(text.slice(second), /Raising batch reference: Raise two/);
    for (const member of projection.groups[0].members) assert.ok(text.includes(member.endDateExclusive));
    assert.doesNotMatch(text, privateText);
    assert.match(text, /not observed sowing|not verified seed identity/);
  }
  const ownRows = csvRows(buildGrowerNurseryCsv(f.result,f.source.beds)).filter(row => row.record_type === 'dated_raising_batch');
  const prepRows = csvRows(buildGrowerNurseryPreparationCsv(f.result));
  const refs = prepRows.filter(row => row.record_type === 'planned_batch_reference');
  assert.deepEqual(ownRows.map(row => [row.member_number,row.variety,row.seed_lot_reference]), [['1','Engineering A','Lot one'],['2','Engineering B','Lot two']]);
  assert.deepEqual(refs.map(row => [row.member_number,row.raising_batch_reference]), [['1','Raise one'],['2','Raise two']]);
  assert.deepEqual(prepRows.filter(row => row.record_type === 'preparation_group_metric').map(row => row.represented_batch_total), ['96','120','320']);
  assert.equal(JSON.stringify(f.result),before);
});

test('references missing from saved constructed DTOs and malformed saved markers stay held instead of looking unrecorded', async () => {
  const f = await savedFixture();
  const rows = f.rows.map((row,index) => index ? row : { ...row, nurseryBatchReference: null });
  assert.equal(f.request.source.kind, 'saved-cycles');
  if (f.request.source.kind !== 'saved-cycles') throw Error('Accepted source missing');
  const malformed = buildGrowerNurseryForecast({ ...f.request, source: { ...f.request.source, rows } });
  const missing: GrowerNurseryResult = { ...f.result, batches: f.result.batches.map(({ reference: _reference, ...batch }) => batch) };
  for (const result of [malformed, missing]) {
    const refs = csvRows(buildGrowerNurseryPreparationCsv(result)).filter(row => row.record_type === 'planned_batch_reference');
    assert.equal(refs[0].reference_status,'held'); assert.equal(refs[0].seed_lot_reference,'Needs review');
    for (const build of pdfBuilders) {
      const text = pdfText(Buffer.from(await (await build(result)).arrayBuffer()));
      assert.match(text,/Saved planned references need review/);
    }
  }
});

test('unrecorded accepted references and proposals retain different meanings in both CSV and PDFs', async () => {
  const f = await savedFixture([{ variety:null,seedLotReference:null,raisingBatchReference:null }]);
  // Absence is checked on the real accepted source row, not a guessed export label.
  const rows = f.rows.map(({ nurseryBatchReference: _reference, ...row }) => row);
  assert.equal(f.request.source.kind, 'saved-cycles');
  if (f.request.source.kind !== 'saved-cycles') throw Error('Accepted source missing');
  const absent = buildGrowerNurseryForecast({ ...f.request, source: { ...f.request.source, rows } });
  const proposed = (await fixture()).result;
  for (const [result, status, label] of [[absent,'ready','Not recorded'],[proposed,'proposed','No saved reference']] as const) {
    const refs = csvRows(buildGrowerNurseryPreparationCsv(result)).filter(row => row.record_type === 'planned_batch_reference');
    assert.equal(refs[0].reference_status,status); assert.equal(refs[0].variety,label);
    for (const build of pdfBuilders) assert.ok(pdfText(Buffer.from(await (await build(result)).arrayBuffer())).includes(label));
  }
});

test('entered Unicode, punctuation and combining forms retain their exact source text in both actual PDFs and CSVs', async () => {
  const variety = 'Ṱhilingo café e\u0301', seedLotReference = '=lot,"north"', raisingBatchReference = 'Batch  double  space — A';
  const f = await savedFixture([{ variety,seedLotReference,raisingBatchReference }]);
  for (const build of pdfBuilders) {
    const text = pdfText(Buffer.from(await (await build(f.result)).arrayBuffer()));
    assert.ok(text.includes(`Variety: ${variety}`), 'supported letters must not be stripped or NFC-normalized');
    assert.ok(text.includes(`Seed lot reference: ${seedLotReference}`));
    assert.ok(text.includes(`Raising batch reference: ${raisingBatchReference}`), 'spaces and punctuation are source data');
    assert.doesNotMatch(text, privateText);
  }
  for (const value of [buildGrowerNurseryCsv(f.result,f.source.beds),buildGrowerNurseryPreparationCsv(f.result)]) {
    const rows = csvRows(value).filter(row => row.reference_status === 'ready');
    assert.equal(rows[0].variety,variety); assert.equal(rows[0].seed_lot_reference,"'"+seedLotReference);
    assert.equal(rows[0].raising_batch_reference,raisingBatchReference); assert.doesNotMatch(value,privateText);
  }
});

test('unsupported glyphs hold the PDF with a useful exact CSV alternative, without transliteration', async () => {
  const reference = 'Batch 😀';
  const f = await savedFixture([{ variety:null,seedLotReference:reference,raisingBatchReference:null }]);
  for (const build of pdfBuilders) await assert.rejects(build(f.result), error => error instanceof NurseryReferenceExportError
    && error.reason === 'unsupported-reference-glyph' && /cannot be printed faithfully.*CSV/.test(error.message)
    && !error.message.includes(reference));
  assert.equal(csvRows(buildGrowerNurseryPreparationCsv(f.result)).find(row => row.reference_status === 'ready')!.seed_lot_reference,reference);
});
