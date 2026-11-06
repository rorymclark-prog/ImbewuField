import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readMassQuantityEntry, type MassQuantityEntry } from '../lib/mass-units.ts';
import { crop, ownRow, studio, reset, cleanup, stamp } from './international-grower-operations-fixture.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, projectGrowerNurseryPreparation } from '../lib/international/grower-nursery.ts';
import { buildGrowerNurseryCsv, buildGrowerNurseryPreparationCsv, buildGrowerNurseryBatchLabelsPdf, buildGrowerNurseryPreparationPdf } from '../lib/nursery-export.ts';
import { buildGrowerBoardTasks, buildTaskIcs, resolveGrowerTaskIdentities } from '../lib/task-board.ts';
import { captureReportCropPlan, normaliseReportCropSnapshot, reportCropRows } from '../lib/report-crop-plan.ts';
import { drawReportCropSummary } from '../lib/report-crop-pdf.ts';
import type { FactCropPlan } from '../lib/report-site-facts.ts';
import { readGrowerCycleIntent, readGrowerCycleIntentField, growerCycleIntentColumns } from '../lib/international/grower-cycle-intent.ts';
import { growerCycleOriginView, normaliseGrowerCycleAttachment, resolvePlantingBasis, type GrowerCycleOriginView } from '../lib/international/grower-cycle.ts';

beforeEach(async () => {
  await reset();
  // jsPDF detects the fixture's browser-shaped window; expose Node's standard
  // base64 primitives there too, without replacing the actual PDF library.
  Object.assign(window, { atob: globalThis.atob, btoa: globalThis.btoa });
}); after(cleanup);
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> =>
  ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });
const now = new Date('2028-12-01T12:00:00.000Z');
// Engineering quantities/dates reuse the established measured-source fixture;
// these are synthetic requests, not crop guidance or a farmer's private book.
async function fixture(includeLegacy = false, quantityEntry?: MassQuantityEntry, shortReferences = false) {
  const raw = studio();
  raw.items.push({ ...raw.items[0], id: 'private-second-bed', x: 0.8 });
  if (includeLegacy) raw.items.push({ ...raw.items[0], id: 'private-third-bed', x: 0.6 });
  const original = await ownRow(raw);
  const { source } = original;
  const saved = original.row.growerCycle.assessmentSnapshot.profile;
  const profile: GrowerPlanningProfile = { ...saved, inputs: { ...saved.inputs,
    establishment: own('transplant', 'method'), nurseryDays: own(2, 'days') } };
  const book: CropPlanState = { version: 1, updatedAt: 1, plantings: [], harvestTargets: [], growerPlanningProfiles: [profile] };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000', targetProfiles: [],
    demands: (includeLegacy ? ['household', 'trial', 'legacy'] as const : ['household', 'trial'] as const).map(purpose => ({ kind: 'grower-entered' as const, entryId: `private-${purpose}-entry`,
      purpose: purpose === 'legacy' ? 'household' : purpose, profileId: profile.profileId, cropKey: profile.cropKey, ...(quantityEntry ? { quantityEntry } : { grossKg: '1.234567' }), harvestStart: '2028-12-10', harvestEndExclusive: '2028-12-14' })),
    available: source.beds.map(bed => ({ bedId: bed.id, start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true })), assumptionsConfirmed: true };
  const review = assembleGrowerWorkflowReview({ scope: source.scope, source, book, draft, recordedAt: stamp });
  assert.equal(review.status, 'review'); if (review.status !== 'review') throw Error('Synthetic review held');
  assert.equal(review.proposal.status, 'ready');
  const accepted = prepareGrowerWorkflowAcceptance({ scope: source.scope, source, book, review,
    binding: { source, draft, recordedAt: stamp }, acceptedAt: stamp,
    plantingIds: review.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `private-intent-planting-${index}` })) });
  assert.equal(accepted.status, 'prepared'); if (accepted.status !== 'prepared') throw Error('Synthetic acceptance held');
  // Simulate a supported historical own cycle whose origin was never recorded.
  // The assessment, bed, dates and identity remain the genuinely accepted fixture.
  const bookToSave = includeLegacy ? { ...accepted.book, plantings: accepted.book.plantings.map((row, index) => index !== 2 ? row : ({
    ...row, growerCycle: Object.fromEntries(Object.entries(row.growerCycle as object).filter(([key]) => key !== 'origin')),
  })) } : accepted.book;
  const preparedBook = !shortReferences ? bookToSave : { ...bookToSave, plantings: bookToSave.plantings.map((row, index) => {
    const attachment = normaliseGrowerCycleAttachment(row.growerCycle); assert.ok(attachment);
    return { ...row, variety: `Engineering ${index + 1}`, nurseryBatchReference: { kind: 'planned-nursery-reference', version: 1,
      plantingId: row.id, scope: source.scope, assessmentFingerprint: attachment.assessmentFingerprint,
      seedLotReference: `Lot ${index + 1}`, raisingBatchReference: `Raise ${index + 1}` } };
  }) };
  assert.equal(crop.saveCropPlanWithReceipt(preparedBook).saved, true);
  const rows = crop.loadCropPlan().plantings;
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const settings = { version: 1 as const, containers: [], spaces: [], profiles: [] };
  const nursery = (plantings: unknown = rows) => buildGrowerNurseryForecast({ source: { kind: 'saved-cycles', rows: plantings, cycleContext: context },
    resourceContext: source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window'),
    availability: own([], 'nursery-resource-windows'), otherReservations: own([], 'nursery-resource-reservations') });
  const result = nursery();
  assert.equal(result.batches.length, includeLegacy ? 3 : 2);
  return { raw, source, rows, context, result, nursery };
}
function artifact(name: string, value: string | Uint8Array) {
  const folder = process.env.INTENT_REVIEW_OUTPUT;
  if (folder) { mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, name), value); }
}
function pdfText(bytes: Uint8Array): string {
  const matches = [...Buffer.from(bytes).toString('latin1').matchAll(/\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g)];
  return matches.map(match => match[1].replace(/\\([()\\])/g, '$1').replace(/\\[nrt]/g, ' ')).join(' ').replace(/\s+/g, ' ');
}

// jsPDF embeds entered references as CID text. Decode its real ToUnicode map
// per actual page; a Latin1-only assertion would miss reference attribution.
function pdfPages(bytes: Uint8Array, normaliseWhitespace = true): string[] {
  const raw = Buffer.from(bytes).toString('latin1'), objects = new Map<string, string>();
  for (const match of raw.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)) objects.set(match[1], match[2]);
  const fonts = new Map<string, Map<number, string>>();
  for (const resource of raw.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const unicode = objects.get(resource[2])?.match(/\/ToUnicode (\d+) 0 R/); if (!unicode) continue;
    const map = new Map<number, string>();
    for (const block of (objects.get(unicode[1]) ?? '').matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const pair of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(pair[1], 16), String.fromCharCode(parseInt(pair[2], 16)));
    fonts.set(resource[1], map);
  }
  return [...objects.values()].filter(object => /\/Type \/Page\b/.test(object)).map(page => {
    const contents = page.match(/\/Contents (\d+) 0 R/); assert.ok(contents);
    const stream = objects.get(contents[1]) ?? '', lines: string[] = [];
    for (const block of stream.matchAll(/BT\b([\s\S]*?)ET\b/g)) {
      const font = block[1].match(/\/(F\d+) [\d.]+ Tf/)?.[1];
      for (const value of block[1].matchAll(/<([0-9a-f]+)>\s*Tj/gi)) {
        const map = font ? fonts.get(font) : undefined; assert.ok(map);
        lines.push((value[1].match(/.{4}/g) ?? []).map(code => { const text = map.get(parseInt(code, 16)); assert.notEqual(text, undefined); return text; }).join(''));
      }
      // Unlike pdfText's ordinary-copy projection, preserve literal spaces in
      // actual PDF text operators. The exact assertion must detect trimming.
      for (const value of block[1].matchAll(/\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g))
        lines.push(value[1].replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t'));
    }
    return normaliseWhitespace ? lines.join(' ').replace(/\s+/g, ' ') : lines.join('\n');
  });
}

function csvRows(csv: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  const [head, ...body] = rows;
  return body.map(values => Object.fromEntries(head.map((key, index) => [key, values[index] ?? ''])));
}
function publicRequest(text: string, purpose: 'household' | 'trial') {
  assert.match(text, purpose === 'household' ? /Planning purpose: household food/ : /Planning purpose: trial growing/);
  assert.match(text, /1\.234567 kg gross across 2028-12-10 to before 2028-12-14/);
  assert.match(text, /not this batch.?s output or an observed harvest/i);
  assert.match(text, /Repeated whole-demand request weights must not be added together/);
  assert.doesNotMatch(text, /private-|own-estimate|site:0\.00000|geometryFingerprint|demandId|2\.469134 kg/);
}

test('actual task and ICS readback retain accepted purpose/request while task/completion identities and boundary qualifiers stay unchanged', async () => {
  const f = await fixture();
  const first = buildGrowerBoardTasks(f.rows, [f.context], now, new Set());
  assert.ok(first.tasks.length);
  const expected = resolveGrowerTaskIdentities(first.tasks.map(task => ({ rowIndex: 0, plantingId: task.growerJournalLink!.plantingId, kind: task.growerEventKind! }))).ids;
  assert.deepEqual(first.tasks.map(task => task.id), expected);
  const withoutOrigins = f.rows.map(row => ({ ...row, growerCycle: Object.fromEntries(Object.entries(row.growerCycle as object).filter(([key]) => key !== 'origin')) }));
  assert.deepEqual(first.tasks.map(task => task.id), buildGrowerBoardTasks(withoutOrigins, [f.context], now, new Set()).tasks.map(task => task.id), 'Intent readback never changes an existing task/completion identity');
  const complete = new Set([first.tasks[0].id]);
  const second = buildGrowerBoardTasks(f.rows, [f.context], now, complete);
  assert.deepEqual(second.tasks.map(task => task.id), first.tasks.map(task => task.id));
  assert.equal(second.tasks[0].completed, true);
  for (const purpose of ['household', 'trial'] as const) {
    const task = first.tasks.find(task => task.growerIntent?.purpose === purpose);
    assert.ok(task, `Task readback lost ${purpose}`);
    publicRequest(task.subtitle, purpose); assert.doesNotMatch(JSON.stringify(task.growerIntent), /private-|own-estimate|site:/);
    const ics = buildTaskIcs(task, now); publicRequest(ics.replace(/\r\n /g, ''), purpose);
    assert.match(ics.replace(/\r\n /g, ''), /not recorded work/); assert.match(ics, /DTSTART;VALUE=DATE:/);
    artifact(`${purpose}-intent-task.ics`, ics);
  }
  assert.match(first.tasks.find(task => task.growerEventKind === 'picking-end')!.subtitle, /Exclusive end boundary/);
  assert.match(first.tasks.find(task => task.growerEventKind === 'next-entry')!.subtitle, /not a new planting or confirmation that the bed is free/);
});

test('actual nursery CSV outputs retain each mixed-purpose member and original window without creating whole-demand totals', async () => {
  const f = await fixture(), before = JSON.stringify(f.result);
  const preparation = projectGrowerNurseryPreparation(f.result);
  assert.equal(preparation.groups.length, 1, 'Same crop/profile/start stays one preparation group');
  assert.deepEqual(preparation.groups[0].members.map(member => member.intent?.purpose).sort(), ['household', 'trial']);
  const exports = [buildGrowerNurseryCsv(f.result, f.source.beds), buildGrowerNurseryPreparationCsv(f.result)];
  for (const [index, csv] of exports.entries()) {
    const rows = csvRows(csv), members = rows.filter(row => ['dated_raising_batch', 'planned_batch_reference'].includes(row.record_type));
    assert.equal(members.length, 2);
    assert.deepEqual(members.map(row => row.planning_purpose).sort(), ['household', 'trial']);
    for (const member of members) {
      assert.equal(member.original_requested_gross_kg, '1.234567'); assert.equal(member.original_request_weight_unit, 'kg');
      assert.equal(member.original_request_harvest_start_utc, '2028-12-10'); assert.equal(member.original_request_harvest_end_exclusive_utc, '2028-12-14');
      assert.match(member.original_request_note, /must not be added together/);
    }
    assert.ok(rows.filter(row => !members.includes(row)).every(row => !row.original_requested_gross_kg), 'No demand sum or request amount on aggregate/resource rows');
    assert.doesNotMatch(csv, /private-|own-estimate|site:0\.00000|2\.469134/);
    artifact(index ? 'intent-preparation.csv' : 'intent-nursery.csv', csv);
  }
  assert.equal(JSON.stringify(f.result), before);
});

test('actual nursery worksheet and batch-label PDF bytes print both purposes and requested input, not private identities or a duplicated total', async () => {
  const f = await fixture();
  for (const [name, build] of [['intent-preparation.pdf', buildGrowerNurseryPreparationPdf], ['intent-batch-labels.pdf', buildGrowerNurseryBatchLabelsPdf]] as const) {
    const bytes = new Uint8Array(await (await build(f.result)).arrayBuffer());
    const text = pdfText(bytes); assert.ok(Buffer.from(bytes).subarray(0, 5).equals(Buffer.from('%PDF-')));
    publicRequest(text, 'household'); publicRequest(text, 'trial');
    assert.match(text, /Source not verified|source not verified/); assert.match(text, /exclusive UTC/);
    artifact(name, bytes); artifact(name + '.txt', text);
  }
});

test('actual report rows and PDF read back archived intent under either catalogue-guidance setting', async () => {
  const f = await fixture();
  const snapshot = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1, beds: f.source.beds, plantings: f.rows, outlines: [] });
  assert.ok(snapshot);
  const fact = { snapshot, crops: [] } as unknown as FactCropPlan;
  const rows = reportCropRows(fact); assert.equal(rows.length, 2);
  for (const purpose of ['household', 'trial'] as const) { const row = rows.find(row => row.intent?.purpose === purpose); assert.ok(row); publicRequest(row.intent!.lines.join(' '), purpose); }
  const { jsPDF } = await import('jspdf');
  for (const allow of [false, true]) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' }); await drawReportCropSummary(doc, fact, 0, 'en', allow);
    const bytes = new Uint8Array(doc.output('arraybuffer')), text = pdfText(bytes);
    publicRequest(text, 'household'); publicRequest(text, 'trial');
    assert.match(text, /archived inputs|Archived grower estimates/);
    artifact(`intent-report-${allow ? 'with-calendar' : 'records'}.pdf`, bytes);
  }
});

test('unknown legacy, purpose-only historical and explicit buyer intents never acquire an invented request', async () => {
  const f = await fixture(), row = f.rows[0];
  const attachment = Object.fromEntries(Object.entries(row.growerCycle as object).filter(([key]) => key !== 'origin'));
  const unknown = { ...row, growerCycle: attachment };
  const old = { ...row, growerCycle: { ...attachment, origin: { kind: 'grower-entered', entryId: 'private-household-entry', purpose: 'household' } } } as Planting;
  for (const [candidate, expected] of [[unknown, 'not-recorded'], [old, 'household']] as const) {
    const tasks = buildGrowerBoardTasks([candidate], [f.context], now, new Set()).tasks; assert.ok(tasks.length);
    assert.equal(tasks[0].growerIntent?.purpose, expected); assert.match(tasks[0].subtitle, /Original requested weight and harvest window are not recorded/);
    assert.doesNotMatch(tasks[0].subtitle, /1\.234567|: 0 kg|buyer target/);
    const csv = buildGrowerNurseryCsv(f.nursery([candidate]), f.source.beds);
    const member = csvRows(csv).find(row => row.record_type === 'dated_raising_batch'); assert.ok(member);
    assert.equal(member.original_requested_gross_kg, 'not-recorded'); assert.equal(member.planning_purpose, expected);
  }
  const buyer = readGrowerCycleIntent({ status: 'recorded', origin: { kind: 'buyer-target', harvestTargetId: 'private-buyer' } });
  assert.equal(buyer.purpose, 'buyer-target'); assert.equal(buyer.requestedGrossKg, null);
  assert.equal(buyer.lines.join(' '), 'Planning purpose: buyer target.'); assert.doesNotMatch(JSON.stringify(buyer), /private-buyer/);
});

test('malformed present origin remains held; accessors and non-enumerable input do not execute or disappear into unknown', async () => {
  const f = await fixture(), view = growerCycleOriginView(f.rows[0].growerCycle!);
  assert.equal(readGrowerCycleIntent(view).status, 'recorded'); let reads = 0;
  for (const origin of [null, undefined, { kind: 'grower-entered', entryId: 'private-household-entry', purpose: 'invalid' }]) {
    const owner = { origin }; const parsed = readGrowerCycleIntentField(owner); assert.equal(parsed.status, 'held'); assert.equal(growerCycleIntentColumns(parsed).original_requested_gross_kg, 'needs-review');
  }
  const owner = Object.defineProperty({}, 'origin', { enumerable: true, get() { reads++; return view; } });
  assert.equal(readGrowerCycleIntentField(owner).status, 'held'); assert.equal(reads, 0);
  assert.equal(readGrowerCycleIntentField(Object.defineProperty({}, 'origin', { value: view })).status, 'held');
  assert.equal(readGrowerCycleIntentField({}).status, 'not-recorded');
  const malformed = { ...f.rows[0], growerCycle: { ...f.rows[0].growerCycle!, origin: null } } as unknown as Planting;
  assert.equal(buildGrowerBoardTasks([malformed], [f.context], now, new Set()).tasks.length, 0);
});


test('representative mixed household, trial and historical-unknown PDFs retain every member without inventing missing requests', async () => {
  const f = await fixture(true);
  const preparation = projectGrowerNurseryPreparation(f.result);
  assert.deepEqual(preparation.groups.flatMap(group => group.members.map(member => member.intent?.purpose)).sort(), ['household', 'not-recorded', 'trial']);
  const snapshot = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1, beds: f.source.beds, plantings: f.rows, outlines: [] });
  assert.ok(snapshot);
  const fact = { snapshot, crops: [] } as unknown as FactCropPlan;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }); await drawReportCropSummary(doc, fact, 0, 'en', false);
  const pdfs = [
    ['mixed-household-trial-legacy-preparation.pdf', new Uint8Array(await (await buildGrowerNurseryPreparationPdf(f.result)).arrayBuffer())],
    ['mixed-household-trial-legacy-labels.pdf', new Uint8Array(await (await buildGrowerNurseryBatchLabelsPdf(f.result)).arrayBuffer())],
    ['mixed-household-trial-legacy-report.pdf', new Uint8Array(doc.output('arraybuffer'))],
  ] as const;
  for (const [name, bytes] of pdfs) {
    const text = pdfText(bytes); publicRequest(text, 'household'); publicRequest(text, 'trial');
    assert.match(text, /Planning purpose not recorded\. Original requested weight and harvest window are not recorded/);
    assert.doesNotMatch(text, /3\.703701 kg|private-|buyer target/);
    if (!name.endsWith('report.pdf')) {
      const streams = [...Buffer.from(bytes).toString('latin1').matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
        .map(match => pdfText(Buffer.from(match[1], 'latin1')));
      const unknownPage = streams.find(page => page.includes('Planning purpose not recorded.'));
      assert.ok(unknownPage); assert.match(unknownPage, /Member 3:/, 'A continued intent must retain its actual member heading on that page');
    }
    artifact(name, bytes); artifact(name + '.txt', text);
  }
});


test('authored pounds and kilogram trailing zeros survive real canonical roundtrip and every public delivery separately from canonical kg', async () => {
  for (const entry of [{ unit: 'lb', text: ' 0010.00 ' }, { unit: 'kg', text: '0001,2300' }] as const) {
    const parsed = readMassQuantityEntry(entry); assert.equal(parsed.status, 'provided');
    if (parsed.status !== 'provided') throw Error('Synthetic authored weight held');
    const f = await fixture(false, entry), before = JSON.stringify(f.rows);
    const tasks = buildGrowerBoardTasks(f.rows, [f.context], now, new Set()).tasks;
    const check = (text: string, exactText = text) => {
      assert.ok(exactText.includes(`${entry.text} ${entry.unit}`), 'Keep exact authored spelling, padding, separator, trailing zeros and original unit in real text/glyph operators; do not normalize this assertion');
      assert.ok(text.includes(`${parsed.kilograms} kg gross across 2028-12-10 to before 2028-12-14`));
      assert.match(text, /Kilograms are the canonical planning equivalent for this whole request/);
      assert.match(text, /Repeated whole-demand request weights must not be added together/);
      assert.doesNotMatch(text, /private-|own-estimate|site:0\.00000/);
    };
    assert.ok(tasks.length); check(tasks[0].subtitle);
    assert.deepEqual(tasks[0].growerIntent?.originalQuantityEntry, entry);
    const ics = buildTaskIcs(tasks[0], now).replace(/\r\n /g, '').replace(/\\,/g, ','); check(ics);
    for (const csv of [buildGrowerNurseryCsv(f.result, f.source.beds), buildGrowerNurseryPreparationCsv(f.result)]) {
      const rows = csvRows(csv), members = rows.filter(row => ['dated_raising_batch', 'planned_batch_reference'].includes(row.record_type));
      assert.equal(members.length, 2);
      for (const row of members) {
        assert.equal(row.original_entered_weight_text, entry.text); assert.equal(row.original_entered_weight_unit, entry.unit);
        assert.equal(row.original_requested_gross_kg, String(parsed.kilograms)); assert.equal(row.original_request_weight_unit, 'kg');
      }
      assert.ok(rows.filter(row => !members.includes(row)).every(row => !row.original_entered_weight_text && !row.original_requested_gross_kg));
    }
    for (const [name, build] of [['preparation', buildGrowerNurseryPreparationPdf], ['labels', buildGrowerNurseryBatchLabelsPdf]] as const) {
      const bytes = new Uint8Array(await (await build(f.result)).arrayBuffer()); check(pdfText(bytes), pdfPages(bytes, false).join('\n'));
      artifact(`authored-${entry.unit}-${name}.pdf`, bytes);
    }
    const snapshot = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1, beds: f.source.beds, plantings: f.rows, outlines: [] }); assert.ok(snapshot);
    const fact = { snapshot, crops: [] } as unknown as FactCropPlan;
    for (const row of reportCropRows(fact)) { assert.deepEqual(row.intent?.originalQuantityEntry, entry); check(row.intent!.lines.join(' ')); }
    const { jsPDF } = await import('jspdf'); const doc = new jsPDF({ unit: 'pt', format: 'a4' }); await drawReportCropSummary(doc, fact, 0, 'en', false);
    const bytes = new Uint8Array(doc.output('arraybuffer')); check(pdfText(bytes), pdfPages(bytes, false).join('\n')); artifact(`authored-${entry.unit}-report.pdf`, bytes);
    // New authored evidence cannot be mismatched or reconstructed on older rows.
    const row = f.rows[0], raw = row.growerCycle as { origin: Record<string, unknown> };
    const wrong = { ...raw.origin, quantityEntry: { unit: 'lb', text: '999.00' } };
    assert.equal(readGrowerCycleIntent({ status: 'recorded', origin: wrong } as unknown as GrowerCycleOriginView).status, 'held');
    const { quantityEntry: _entry, ...older } = raw.origin;
    const oldIntent = readGrowerCycleIntent({ status: 'recorded', origin: older } as unknown as GrowerCycleOriginView);
    assert.equal(oldIntent.originalQuantityEntry, null); assert.match(oldIntent.lines.join(' '), /Original entered unit and text are not recorded/);
    assert.equal(JSON.stringify(f.rows), before);
    await reset(); Object.assign(window, { atob: globalThis.atob, btoa: globalThis.btoa });
  }
});


test('short preparation references remain attributed to their actual member on the same printed page after kg/lb intent expands', async () => {
  for (const entry of [{ unit: 'lb', text: ' 0010.00 ' }, { unit: 'kg', text: '0001,2300' }] as const) {
    const f = await fixture(false, entry, true), before = JSON.stringify(f.result);
    const bytes = new Uint8Array(await (await buildGrowerNurseryPreparationPdf(f.result)).arrayBuffer());
    const pages = pdfPages(bytes); assert.equal(pages.length, 2);
    for (const member of [1, 2]) for (const reference of [`Variety: Engineering ${member}`, `Seed lot reference: Lot ${member}`, `Raising batch reference: Raise ${member}`]) {
      const containing = pages.filter(page => page.includes(reference)); assert.equal(containing.length, 1, `Print exactly one ${reference}`);
      const prefix = containing[0].slice(0, containing[0].indexOf(reference));
      const precedingMembers = [...prefix.matchAll(/Member (\d+):/g)];
      assert.equal(precedingMembers.at(-1)?.[1], String(member), `${reference} must follow its own Member heading on that actual page`);
      assert.match(prefix, member === 1 ? /Planning purpose: household food/ : /Planning purpose: trial growing/);
    }
    assert.equal(JSON.stringify(f.result), before); assert.doesNotMatch(pages.join(' '), /private-|own-estimate|site:0\.00000/);
    artifact(`attributed-${entry.unit}-preparation.pdf`, bytes); artifact(`attributed-${entry.unit}-pages.json`, JSON.stringify(pages, null, 2));
    await reset(); Object.assign(window, { atob: globalThis.atob, btoa: globalThis.btoa });
  }
});

for (const mode of ['normalise', 'capture'] as const) test(`archived report intent holds a different site with coincident bed IDs (${mode})`, async () => {
  const entry = { unit: 'lb', text: ' 0010.00 ' } as const;
  const f = await fixture(false, entry), before = JSON.stringify(f.rows);
  const snapshotFor = (siteId: string) => {
    if (mode === 'normalise') return normaliseReportCropSnapshot({ siteId, capturedAt: stamp, planUpdatedAt: 1,
      beds: f.source.beds, plantings: f.rows, outlines: [] });
    const canvas = structuredClone(f.raw); canvas.siteId = siteId;
    if (siteId.startsWith('site:')) {
      const [lat, lng] = siteId.slice('site:'.length).split(',').map(Number);
      canvas.frame.centerLat = lat; canvas.frame.centerLng = lng;
    }
    const captured = captureReportCropPlan(canvas as unknown as DesignCanvasState,
      { version: 1, updatedAt: 1, plantings: f.rows }, siteId, new Date(stamp), { allowCataloguePlanning: false });
    return normaliseReportCropSnapshot(captured);
  };
  // Matching-site archived purpose remains readable, but this does not approve
  // geometry, task execution or a claim that the planting actually occurred.
  const current = snapshotFor(f.source.resourceSiteId); assert.ok(current);
  const own = reportCropRows({ snapshot: current, crops: [] } as unknown as FactCropPlan);
  assert.deepEqual(own.map(row => row.intent?.purpose).sort(), ['household', 'trial']);
  for (const row of own) { assert.deepEqual(row.intent?.originalQuantityEntry, entry); assert.match(row.status, /current geometry and source claims unverified/); }
  assert.deepEqual(resolvePlantingBasis(f.rows[0]), { kind: 'held', reasons: ['current-geometry-context-required'] });
  for (const siteId of ['site:1.00000,1.00000', 'unverified-report-site']) {
    const other = snapshotFor(siteId); assert.ok(other); assert.equal(other.plantings.length, f.rows.length);
    assert.deepEqual(other.plantings.map(row => row.bedId), f.rows.map(row => row.bedId));
    const fact = { snapshot: other, crops: [] } as unknown as FactCropPlan;
    const rows = reportCropRows(fact); assert.equal(rows.length, f.rows.length);
    for (const row of rows) {
      assert.equal(row.intent?.status, 'held'); assert.equal(row.intent?.purpose, 'held');
      assert.equal(row.intent.originalQuantityEntry, null); assert.equal(row.intent.requestedGrossKg, null);
      assert.equal(row.intent.harvestStart, null); assert.equal(row.intent.harvestEndExclusive, null);
      assert.match(row.status, /Grower cycle held/);
      assert.doesNotMatch(row.intent.lines.join(' '), /household food|trial growing|0010|2028-12-10|2028-12-14/);
    }
    const { jsPDF } = await import('jspdf'); const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    await drawReportCropSummary(doc, fact, 0, 'en', false);
    const bytes = new Uint8Array(doc.output('arraybuffer')), text = pdfPages(bytes, false).join('\n');
    assert.match(text, /Planning purpose and original request need review/);
    assert.doesNotMatch(text, /household food|trial growing|0010|2028-12-10|2028-12-14|Seasonal sowing calendar/);
    if (siteId === 'site:1.00000,1.00000') artifact(`foreign-site-${mode}-report.pdf`, bytes);
  }
  assert.equal(JSON.stringify(f.rows), before, 'Report readback does not rewrite the retained source evidence');
});
