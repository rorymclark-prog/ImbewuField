import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nurseryDimensionToCanonical, canonicalToNurseryDimension, formatNurseryDimension,
  createNurseryDimensionDraft, editNurseryDimensionDraft, readNurseryDimensionDraft, switchNurseryDimensionDraftUnit,
  type NurseryDimensionDraft, type NurseryDimensionUnit,
} from '../lib/length-units.ts';
import { sanitiseNurserySettings, type NurserySettings } from '../lib/nursery-settings.ts';
import { nurserySettingsFingerprint } from '../lib/international/grower-nursery.ts';
import { decimalQuantityProduct } from '../lib/farm-records.ts';
import { buildNurseryForecast } from '../lib/crop-export-schedule.ts';
import type { Planting, PlanBed } from '../lib/crop-plan.ts';

// Equipment and awkward floating-point fixtures, not tray/crop recommendations.
const key = 'synthetic-actor/site/equipment-source';
const settings: NurserySettings = { version: 1,
  containers: [{ id: 'tray', siteId: 'fixture', name: 'Recorded tray', cells: 100, widthCm: 50.00000000000001, lengthCm: 40.12345678901234, owned: 0 }],
  spaces: [{ id: 'bench', siteId: 'fixture', name: 'Recorded surface', usableM2: 1.2345678901234567 }],
  profiles: [{ id: 'recipe', siteId: 'fixture', cropKey: 'cabbage', model: 'seed-cell', containerId: 'tray', spaceId: 'bench',
    germinationPercent: 100, nurserySurvivalPercent: 100, nurseryWeeks: 4 }],
};
const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 6 }];
const rows: Planting[] = [{ id: 'row', bedId: 'bed', cropKey: 'cabbage', sowMonth: 1 }];
const forecast = (s: NurserySettings) => buildNurseryForecast(rows, beds, 'fixture', s, { year: 2026, month: 1 });
function read<K extends string>(draft: NurseryDimensionDraft<K>) {
  const result = readNurseryDimensionDraft(draft, key); assert.equal(result.status, 'ready'); return result.values;
}
function toggle<K extends string>(draft: NurseryDimensionDraft<K>, unit: NurseryDimensionUnit) {
  const result = switchNurseryDimensionDraftUnit(draft, unit, key); assert.equal(result.status, 'ready'); return result.draft;
}
const tray = (unit: NurseryDimensionUnit = 'cm') => createNurseryDimensionDraft({ sourceKey: key, unit,
  values: { widthCm: settings.containers[0].widthCm, lengthCm: settings.containers[0].lengthCm }, optionalFields: ['widthCm', 'lengthCm'] });
const area = (value: number | undefined = settings.spaces[0].usableM2) => createNurseryDimensionDraft({ sourceKey: key, unit: 'm2', values: { usableM2: value } });

test('unit toggles and JSON reopen preserve actual footprint, settings identity and nursery demand without display drift', () => {
  let dimensions = tray('in'), surface = toggle(area(), 'ft2');
  assert.notEqual(Number(dimensions.fields.widthCm.text) * 2.54, settings.containers[0].widthCm, 'rounded display is deliberately not canonical');
  for (let i = 0; i < 200; i++) {
    dimensions = toggle(dimensions, i % 2 ? 'in' : 'cm'); surface = toggle(surface, i % 2 ? 'ft2' : 'm2');
  }
  const changed = structuredClone(settings); Object.assign(changed.containers[0], read(dimensions)); Object.assign(changed.spaces[0], read(surface));
  const reopened = sanitiseNurserySettings(JSON.parse(JSON.stringify(changed)));
  assert.deepEqual(reopened, settings);
  assert.equal(nurserySettingsFingerprint(reopened), nurserySettingsFingerprint(settings));
  assert.equal(decimalQuantityProduct([reopened.containers[0].widthCm!, reopened.containers[0].lengthCm!, 0.0001]),
    decimalQuantityProduct([settings.containers[0].widthCm!, settings.containers[0].lengthCm!, 0.0001]));
  assert.deepEqual(forecast(reopened), forecast(settings)); assert.ok(forecast(reopened).cohorts.length > 0);
  const second = createNurseryDimensionDraft({ sourceKey: key, unit: 'in', values: read(dimensions), optionalFields: ['widthCm', 'lengthCm'] });
  assert.deepEqual(read(second), read(dimensions));
});

test('explicit inch and square-foot edits convert once and retain full canonical precision through later toggles and forecast reload', () => {
  const width = '19.1234567890123', squareFeet = '13.1234567890123';
  let dimensions = editNurseryDimensionDraft(tray('in'), 'widthCm', width);
  let surface = editNurseryDimensionDraft(toggle(area(), 'ft2'), 'usableM2', squareFeet);
  const expectedWidth = Number(width) * 2.54, expectedArea = Number(squareFeet) * 0.09290304;
  for (let i = 0; i < 100; i++) { dimensions = toggle(dimensions, i % 2 ? 'in' : 'cm'); surface = toggle(surface, i % 2 ? 'ft2' : 'm2'); }
  assert.equal(read(dimensions).widthCm, expectedWidth); assert.equal(read(surface).usableM2, expectedArea);
  assert.equal(read(dimensions).lengthCm, settings.containers[0].lengthCm);
  const expected = structuredClone(settings); expected.containers[0].widthCm = expectedWidth; expected.spaces[0].usableM2 = expectedArea;
  const actual = structuredClone(settings); Object.assign(actual.containers[0], read(dimensions)); Object.assign(actual.spaces[0], read(surface));
  const reopened = sanitiseNurserySettings(JSON.parse(JSON.stringify(actual)));
  assert.equal(nurserySettingsFingerprint(reopened), nurserySettingsFingerprint(expected)); assert.deepEqual(forecast(reopened), forecast(expected));
  assert.equal(reopened.containers[0].owned, 0); assert.equal(reopened.containers[0].cells, 100); assert.equal(reopened.profiles[0].germinationPercent, 100);
});

test('blank optional tray measurements stay unknown while explicit zero surface remains a known zero', () => {
  let dimensions = createNurseryDimensionDraft({ sourceKey: key, unit: 'in', values: { widthCm: undefined, lengthCm: 40 }, optionalFields: ['widthCm', 'lengthCm'] });
  assert.equal(dimensions.fields.widthCm.text, ''); assert.equal(read(dimensions).widthCm, undefined);
  dimensions = editNurseryDimensionDraft(dimensions, 'lengthCm', ' '); assert.equal(read(dimensions).lengthCm, undefined);
  dimensions = toggle(dimensions, 'cm'); assert.deepEqual(read(dimensions), { widthCm: undefined, lengthCm: undefined });
  const zero = toggle(area(0), 'ft2'); assert.equal(zero.fields.usableM2.text, '0'); assert.equal(read(zero).usableM2, 0);
  const unknown = structuredClone(settings); Object.assign(unknown.containers[0], read(dimensions)); unknown.spaces[0].usableM2 = read(zero).usableM2!;
  const reopened = sanitiseNurserySettings(JSON.parse(JSON.stringify(unknown)));
  assert.equal(reopened.containers[0].widthCm, undefined); assert.equal(reopened.spaces[0].usableM2, 0);
  assert.notEqual(nurserySettingsFingerprint(reopened), nurserySettingsFingerprint(settings));
});

test('required surface blanks and negative entries hold their original text and unit instead of becoming absent or zero', () => {
  for (const text of ['', ' ', '-', '.', ',', '-.1', '-1']) {
    const draft = editNurseryDimensionDraft(toggle(area(), 'ft2'), 'usableM2', text);
    assert.equal(readNurseryDimensionDraft(draft, key).status, 'held');
    const result = switchNurseryDimensionDraftUnit(draft, 'm2', key);
    assert.equal(result.status, 'held'); assert.equal(result.draft, draft); assert.equal(result.draft.unit, 'ft2'); assert.equal(result.draft.fields.usableM2.text, text);
  }
  assert.equal(readNurseryDimensionDraft(createNurseryDimensionDraft({ sourceKey: key, unit: 'm2', values: { usableM2: undefined } }), key).status, 'held');
});

test('tray positivity and paired footprint remain the existing nursery-settings rule rather than a fabricated minimum', () => {
  for (const text of ['0', '-1']) {
    const dimensions = editNurseryDimensionDraft(tray(), 'widthCm', text), changed = structuredClone(settings);
    Object.assign(changed.containers[0], read(dimensions));
    assert.equal(sanitiseNurserySettings(changed).containers.length, 0);
    assert.equal(nurserySettingsFingerprint(changed), null);
  }
  const changed = structuredClone(settings); changed.containers[0].widthCm = Number.MIN_VALUE; changed.containers[0].lengthCm = Number.MIN_VALUE;
  assert.equal(sanitiseNurserySettings(changed).containers.length, 0, 'positive sides do not prove a representable positive footprint');
});

test('decimal entry shares dot/comma leading decimal and sign grammar while suffixes/grouping never acquire another meaning', () => {
  for (const [text, expected] of [['.5', 1.27], [',5', 1.27], ['+.5', 1.27], ['+1,25', 3.175]] as const) {
    assert.equal(read(editNurseryDimensionDraft(tray('in'), 'widthCm', text)).widthCm, expected);
  }
  for (const text of ['1in', '1 in', '1/2', '1,000.5', '1.000,5', '1 000', '1e3', 'Infinity', 'NaN', '+', ',', '0x10']) {
    const draft = editNurseryDimensionDraft(tray('in'), 'widthCm', text), result = switchNurseryDimensionDraftUnit(draft, 'cm', key);
    assert.equal(result.status, 'held', text); assert.equal(result.draft, draft); assert.equal(draft.fields.widthCm.text, text);
  }
});

test('nonzero underflow and finite overflow cannot produce a fabricated zero or Infinity measurement', () => {
  assert.equal(nurseryDimensionToCanonical(Number.MIN_VALUE, 'ft2'), null);
  assert.equal(canonicalToNurseryDimension(Number.MIN_VALUE, 'in'), null);
  assert.equal(nurseryDimensionToCanonical(Number.MAX_VALUE, 'in'), null);
  assert.equal(canonicalToNurseryDimension(Number.MAX_VALUE, 'ft2'), null);
  for (const unit of ['cm', 'in', 'm2', 'ft2'] as const) for (const value of [NaN, Infinity, -Infinity]) assert.equal(nurseryDimensionToCanonical(value, unit), null);
  const tiny = `0.${'0'.repeat(400)}1`;
  assert.equal(readNurseryDimensionDraft(editNurseryDimensionDraft(tray(), 'widthCm', tiny), key).status, 'held');
  const smallest = formatNurseryDimension(Number.MIN_VALUE, 'cm'); assert.ok(smallest); assert.notEqual(Number(smallest), 0);
  const huge = tray('cm'), replaced = createNurseryDimensionDraft({ sourceKey: key, unit: 'm2', values: { usableM2: Number.MAX_VALUE } });
  assert.equal(switchNurseryDimensionDraftUnit(replaced, 'ft2', key).draft, replaced); assert.equal(read(huge).widthCm, settings.containers[0].widthCm);
});

test('source, dimension and per-field unit damage all revoke apply without reinterpreting draft text', () => {
  const draft = tray('in');
  assert.equal(readNurseryDimensionDraft(draft, 'another-actor/site/source').status, 'held');
  assert.equal(switchNurseryDimensionDraftUnit(draft, 'cm', 'another-source').draft, draft);
  for (const unit of ['m2', 'ft2', 'm', 'ft', 'survey-in', ''] as NurseryDimensionUnit[]) assert.equal(switchNurseryDimensionDraftUnit(draft, unit, key).draft, draft);
  const mixed = { ...draft, fields: { ...draft.fields, widthCm: { ...draft.fields.widthCm, inputUnit: 'cm' as const } } };
  assert.equal(readNurseryDimensionDraft(mixed, key).status, 'held');
  const missing = { ...draft, fields: { widthCm: draft.fields.widthCm } } as NurseryDimensionDraft<'widthCm' | 'lengthCm'>;
  assert.equal(readNurseryDimensionDraft(missing, key).status, 'held');
  const nonfinite = { ...draft, fields: { ...draft.fields, widthCm: { ...draft.fields.widthCm, status: 'ready' as const, canonicalValue: Infinity } } };
  assert.equal(readNurseryDimensionDraft(nonfinite, key).status, 'held');
  const damagedKind = { ...draft, kind: 'surface-area' as const }; assert.equal(readNurseryDimensionDraft(damagedKind, key).status, 'held');
  const fakeOptionalArea = createNurseryDimensionDraft({ sourceKey: key, unit: 'm2', values: { usableM2: 0 }, optionalFields: ['usableM2'] });
  assert.equal(readNurseryDimensionDraft(fakeOptionalArea, key).status, 'held');
});

test('snapshots are detached and immutable; unchanged displayed text is not a fresh conversion instruction', () => {
  const values = { widthCm: 50.00000000000001 }, optionalFields = ['widthCm'] as const;
  const draft = createNurseryDimensionDraft({ sourceKey: key, unit: 'in', values, optionalFields }); values.widthCm = 1;
  assert.equal(read(draft).widthCm, 50.00000000000001);
  assert.equal(editNurseryDimensionDraft(draft, 'widthCm', draft.fields.widthCm.text), draft);
  assert.ok(Object.isFrozen(draft)); assert.ok(Object.isFrozen(draft.originalCanonical)); assert.ok(Object.isFrozen(draft.optionalFields)); assert.ok(Object.isFrozen(draft.fields.widthCm));
  assert.throws(() => { (draft.fields.widthCm as { text: string }).text = '1'; }, TypeError);
});

test('source verified directions remain distinct dimensions and never broaden field-length supported units', () => {
  assert.equal(nurseryDimensionToCanonical(1, 'in'), 2.54); assert.equal(canonicalToNurseryDimension(2.54, 'in'), 1);
  assert.equal(nurseryDimensionToCanonical(1, 'ft2'), 0.09290304); assert.equal(canonicalToNurseryDimension(0.09290304, 'ft2'), 1);
  assert.equal(nurseryDimensionToCanonical(0, 'ft2'), 0); assert.equal(nurseryDimensionToCanonical(3.0000000000000004, 'cm'), 3.0000000000000004);
  assert.equal(nurseryDimensionToCanonical(1, 'ft' as NurseryDimensionUnit), null);
});


test('a new blank required surface permits unit choice before typing without inventing a saved area', () => {
  const initial = createNurseryDimensionDraft({ sourceKey: key, unit: 'm2', values: { usableM2: undefined } });
  assert.equal(readNurseryDimensionDraft(initial, key).status, 'held');
  const switched = switchNurseryDimensionDraftUnit(initial, 'ft2', key); assert.equal(switched.status, 'ready');
  assert.equal(switched.draft.unit, 'ft2'); assert.equal(switched.draft.fields.usableM2.text, '');
  assert.equal(readNurseryDimensionDraft(switched.draft, key).status, 'held');
  const entered = editNurseryDimensionDraft(switched.draft, 'usableM2', '10');
  assert.equal(read(entered).usableM2, 10 * 0.09290304);
  const cleared = editNurseryDimensionDraft(entered, 'usableM2', '');
  assert.equal(switchNurseryDimensionDraftUnit(cleared, 'm2', key).status, 'held');
  assert.equal(cleared.fields.usableM2.edited, true);
});
