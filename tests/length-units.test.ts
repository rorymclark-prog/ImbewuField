import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lengthToMetres, metresToLength, parseLengthDecimal, formatLengthMetres,
  createLengthDraft, editLengthDraft, readLengthDraft, switchLengthDraftUnit,
  type LengthDraft, type LengthUnit,
} from '../lib/length-units.ts';
import { bedsInsideField, type FieldBlockConfig } from '../lib/bed-block.ts';

// Existing panel defaults and deliberately awkward engineering values are
// conversion fixtures, not crop spacings or recommended field dimensions.
const sourceKey = 'synthetic-site/field-a/source-revision';
const original = { bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5 };
type Key = keyof typeof original;
function initial(unit: LengthUnit = 'm', metres = original) { return createLengthDraft({ sourceKey, unit, metres }); }
function metres(draft: LengthDraft<Key>) {
  const result = readLengthDraft(draft, sourceKey); assert.equal(result.status, 'ready');
  return result.metres;
}
function toggle(draft: LengthDraft<Key>, unit: LengthUnit) {
  const result = switchLengthDraftUnit(draft, unit, sourceKey); assert.equal(result.status, 'ready');
  return result.draft;
}

test('international feet use the source-verified direction while canonical metres remain an identity operation', () => {
  // NIST SP811 B.8: international foot -> metre, exact 3.048 E-01.
  assert.equal(lengthToMetres(1, 'ft'), 0.3048);
  assert.equal(metresToLength(0.3048, 'ft'), 1);
  assert.equal(lengthToMetres(0.5, 'ft'), 0.1524);
  assert.equal(lengthToMetres(3.0000000000000004, 'm'), 3.0000000000000004);
  assert.equal(metresToLength(3.0000000000000004, 'm'), 3.0000000000000004);
  assert.equal(Object.is(lengthToMetres(-0, 'm'), -0), true);
  assert.equal(Object.is(lengthToMetres(-0, 'ft'), -0), true);
});

test('survey feet, inches and other unsupported units cannot quietly become international feet or metres', () => {
  for (const unsupported of ['survey-ft', 'US-ft', 'in', 'cm', 'm2', '', 'FT']) {
    assert.equal(lengthToMetres(1, unsupported as LengthUnit), null);
    assert.equal(metresToLength(1, unsupported as LengthUnit), null);
    const draft = initial(); const result = switchLengthDraftUnit(draft, unsupported as LengthUnit, sourceKey);
    assert.equal(result.status, 'held'); assert.equal(result.draft, draft);
  }
});

test('conversion rejects overflow and nonzero underflow instead of storing Infinity or zero', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(lengthToMetres(invalid, 'm'), null); assert.equal(metresToLength(invalid, 'ft'), null);
  }
  assert.equal(metresToLength(Number.MAX_VALUE, 'ft'), null);
  assert.equal(lengthToMetres(Number.MIN_VALUE, 'ft'), null);
  assert.equal(lengthToMetres(Number.MIN_VALUE, 'm'), Number.MIN_VALUE);
  assert.equal(lengthToMetres(0, 'ft'), 0);
  assert.equal(lengthToMetres(-1, 'ft'), -0.3048); // Existing geometry, not this parser, rejects negative lengths.
});

test('explicit decimal convention retains leading decimals, comma decimals and ordinary signs', () => {
  for (const [text, value] of [['.5', 0.5], [',5', 0.5], ['+.5', 0.5], ['+1,25', 1.25], ['-0,5', -0.5], ['  1.2  ', 1.2], ['1.', 1], ['1,', 1], ['1,000', 1]] as const) {
    assert.deepEqual(parseLengthDecimal(text), { status: 'ready', value });
  }
  assert.equal(parseLengthDecimal('-0').status, 'ready');
  const parsed = parseLengthDecimal('-0'); assert.equal(parsed.status === 'ready' && Object.is(parsed.value, -0), true);
});

test('incomplete entries and mixed separators stay distinguishable from valid zero', () => {
  for (const text of ['', ' ', '+', '-', '.', ',', '+.', '-,']) assert.equal(parseLengthDecimal(text).status, 'incomplete', text);
  for (const text of ['1,234.5', '1.234,5', '1,2,3', '1 000', '1\u00a0000', '1_000', '0x10', '1e3', '1/2', '1 ft', '1m', 'Infinity', 'NaN']) {
    assert.equal(parseLengthDecimal(text).status, 'invalid', text);
  }
  assert.deepEqual(parseLengthDecimal('0,00'), { status: 'ready', value: 0 });
});

test('plain decimal bounds refuse a nonzero number rounded away by the JavaScript numeric range', () => {
  assert.equal(parseLengthDecimal('9'.repeat(309)).status, 'invalid');
  assert.equal(parseLengthDecimal(`0.${'0'.repeat(400)}1`).status, 'invalid');
  assert.deepEqual(parseLengthDecimal(`0.${'0'.repeat(400)}`), { status: 'ready', value: 0 });
});

test('formatted text is presentation only and does not overwrite the original canonical precision', () => {
  const draft = initial('ft');
  assert.equal(draft.fields.bedLengthM.text, '9.84252');
  assert.notEqual(Number(draft.fields.bedLengthM.text) * 0.3048, original.bedLengthM); // This control would expose parsing the display.
  assert.deepEqual(metres(draft), original);
  assert.equal(editLengthDraft(draft, 'bedLengthM', draft.fields.bedLengthM.text), draft);
  assert.deepEqual(metres(draft), original);
});

test('repeated unit switches and reopening never drift untouched measurements, including negative zero', () => {
  const fixture = { bedLengthM: 3.0000000000000004, bedWidthM: 1.2345678901234567, pathWidthM: -0 };
  let draft = initial('m', fixture);
  for (let i = 0; i < 200; i++) draft = toggle(draft, i % 2 ? 'm' : 'ft');
  for (const key of Object.keys(fixture) as Key[]) assert.equal(Object.is(metres(draft)[key], fixture[key]), true, key);
  const reopened = initial('ft', { ...metres(draft) });
  for (const key of Object.keys(fixture) as Key[]) assert.equal(Object.is(metres(reopened)[key], fixture[key]), true, key);
  assert.deepEqual(fixture, { bedLengthM: 3.0000000000000004, bedWidthM: 1.2345678901234567, pathWidthM: -0 });
});

test('an explicit feet edit converts once at full precision and further toggles never reconvert its rounded display', () => {
  const text = '10.1234567890123', expected = Number(text) * 0.3048;
  let draft = editLengthDraft(initial('ft'), 'bedLengthM', text);
  assert.equal(metres(draft).bedLengthM, expected);
  assert.equal(metres(draft).bedWidthM, original.bedWidthM); assert.equal(metres(draft).pathWidthM, original.pathWidthM);
  for (let i = 0; i < 100; i++) draft = toggle(draft, i % 2 ? 'ft' : 'm');
  assert.equal(metres(draft).bedLengthM, expected);
  assert.equal(metres(initial('m', { ...metres(draft) })).bedLengthM, expected);
  assert.equal(draft.fields.bedLengthM.edited, true); assert.equal(draft.fields.bedWidthM.edited, false);
});

test('a partial or invalid edited value survives a refused unit switch in its original explicit unit', () => {
  for (const text of ['', '-', '.','1 ft', '1.2,3', '9'.repeat(309)]) {
    const draft = editLengthDraft(initial('ft'), 'pathWidthM', text);
    const result = switchLengthDraftUnit(draft, 'm', sourceKey);
    assert.equal(result.status, 'held'); assert.equal(result.draft, draft);
    assert.equal(result.draft.unit, 'ft'); assert.equal(result.draft.fields.pathWidthM.text, text);
    assert.equal(readLengthDraft(draft, sourceKey).status, 'held');
  }
});

test('a mixed-unit field cannot be silently interpreted as the surrounding form unit', () => {
  const draft = initial('m');
  const mixed: LengthDraft<Key> = { ...draft, fields: { ...draft.fields, bedWidthM: { ...draft.fields.bedWidthM, inputUnit: 'ft' } } };
  const read = readLengthDraft(mixed, sourceKey); assert.equal(read.status, 'held');
  if (read.status === 'held') assert.equal(read.reason, 'mixed-units');
  const result = switchLengthDraftUnit(mixed, 'ft', sourceKey); assert.equal(result.status, 'held'); assert.equal(result.draft, mixed);
});

test('same-source parent clones preserve unfinished input while a changed source key revokes apply and switching', () => {
  const draft = editLengthDraft(initial(), 'bedWidthM', '+');
  const currentCloneKey = ['synthetic-site', 'field-a', 'source-revision'].join('/');
  assert.equal(currentCloneKey, sourceKey); assert.equal(draft.fields.bedWidthM.text, '+');
  assert.equal(switchLengthDraftUnit(draft, 'ft', currentCloneKey).draft, draft);
  const changed = readLengthDraft(draft, 'synthetic-site/field-a/new-config'); assert.equal(changed.status, 'held');
  if (changed.status === 'held') assert.equal(changed.reason, 'source-changed');
  assert.equal(switchLengthDraftUnit(draft, 'ft', 'another-site/field-a/source-revision').draft, draft);
  assert.equal(draft.fields.bedWidthM.text, '+');
});

test('draft snapshots do not mutate or retain a mutable source dimensions object', () => {
  const input = { ...original }, draft = initial('m', input);
  input.bedLengthM = 4;
  assert.equal(metres(draft).bedLengthM, original.bedLengthM);
  assert.equal(Object.isFrozen(draft), true); assert.equal(Object.isFrozen(draft.originalMetres), true);
  assert.equal(Object.isFrozen(draft.fields.bedLengthM), true);
  assert.throws(() => { (draft.fields.bedLengthM as { text: string }).text = '9'; }, TypeError);
});

test('an unrepresentable display conversion holds the original draft instead of losing finite canonical metres', () => {
  const draft = initial('m', { ...original, bedLengthM: Number.MAX_VALUE });
  const result = switchLengthDraftUnit(draft, 'ft', sourceKey);
  assert.equal(result.status, 'held'); assert.equal(result.draft, draft); assert.equal(metres(draft).bedLengthM, Number.MAX_VALUE);
  const tiny = formatLengthMetres(Number.MIN_VALUE, 'm'); assert.ok(tiny); assert.notEqual(Number(tiny), 0);
  assert.equal(/[eE]/.test(tiny), false); assert.equal(parseLengthDecimal(tiny).status, 'ready');
});

test('real tight-boundary layout counts and positions stay identical across display toggles; signed angle remains untouched', () => {
  // Engineering boundary control: one existing-default-size bed exactly fills
  // this rectangle. Re-parsing six-decimal feet makes it slightly too long.
  const points: [number, number][] = [[0, 0], [0.3, 0], [0.3, 0.12], [0, 0.12]];
  const frame = { imgW: 10, imgH: 10, mPerPx: 1 };
  const config: FieldBlockConfig = { ...original, mode: 'beds', pathWidthM: 0, angleDeg: 0 };
  const before = bedsInsideField(points, config, frame); assert.equal(before.beds.length, 1);
  let draft = initial('m', { bedLengthM: config.bedLengthM, bedWidthM: config.bedWidthM, pathWidthM: config.pathWidthM });
  for (let i = 0; i < 20; i++) draft = toggle(draft, i % 2 ? 'm' : 'ft');
  assert.deepEqual(bedsInsideField(points, { ...config, ...metres(draft) }, frame), before);
  const shown = initial('ft', { bedLengthM: config.bedLengthM, bedWidthM: config.bedWidthM, pathWidthM: config.pathWidthM });
  const badRounded = { ...config, bedLengthM: Number(shown.fields.bedLengthM.text) * 0.3048 };
  assert.equal(bedsInsideField(points, badRounded, frame).beds.length, 0); // The check can fail on the exact user-facing count defect.
  const angleConfig = { ...config, angleDeg: -30 };
  assert.equal(({ ...angleConfig, ...metres(draft) }).angleDeg, -30);
  assert.equal(Object.hasOwn(metres(draft), 'angleDeg'), false);
  const negativePath = metres(editLengthDraft(draft, 'pathWidthM', '-.5'));
  assert.equal(negativePath.pathWidthM, -0.5);
  assert.throws(() => bedsInsideField(points, { ...config, ...negativePath }, frame), /Enter valid bed dimensions/);
  assert.deepEqual(points, [[0, 0], [0.3, 0], [0.3, 0.12], [0, 0.12]]);
});
