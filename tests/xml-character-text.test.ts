import test from 'node:test';
import assert from 'node:assert/strict';
import { isXml10CharacterText } from '../lib/xml-character-text.ts';
import { buildFieldLayoutKml } from '../lib/field-layout-export.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

test('character validation rejects nonstrings without coercing caller-owned objects or reading getters', () => {
  let calls = 0;
  const hostile = Object.defineProperties({}, {
    length: { get() { calls++; throw Error('length getter must not run'); } },
    toString: { get() { calls++; throw Error('toString getter must not run'); } },
    valueOf: { get() { calls++; throw Error('valueOf getter must not run'); } },
    [Symbol.toPrimitive]: { get() { calls++; throw Error('coercion getter must not run'); } },
  });
  const boxed = new String('Ordinary text');
  Object.defineProperty(boxed, Symbol.toPrimitive, {
    get() { calls++; throw Error('boxed string coercion must not run'); },
  });
  const values: unknown[] = [undefined, null, false, true, 0, 1, NaN, Infinity, BigInt(1),
    Symbol('text'), [], {}, hostile, boxed, () => 'text'];
  for (const value of values) assert.equal(isXml10CharacterText(value), false);
  assert.equal(calls, 0);
});

test('empty text and XML-permitted whitespace remain valid rather than becoming a required-label policy', () => {
  for (const value of ['', '\t', '\n', '\r', ' \t\n\r ', 'line one\nline two\r\nlast\tcell']) {
    assert.equal(isXml10CharacterText(value), true, JSON.stringify(value));
  }
});

test('every forbidden C0 control is rejected even when embedded in otherwise ordinary text', () => {
  for (let code = 0; code < 32; code++) {
    if (code === 9 || code === 10 || code === 13) continue;
    const character = String.fromCharCode(code);
    assert.equal(isXml10CharacterText(character), false, `control ${code}`);
    assert.equal(isXml10CharacterText(`before${character}after`), false, `embedded control ${code}`);
  }
});

test('unpaired UTF-16 surrogates and forbidden BMP noncharacters cannot enter XML labels', () => {
  for (const invalid of ['\ud800', '\udbff', '\udc00', '\udfff', '\udc00\ud800',
    '\ud800x\udc00', '\ud800\ud800', '\udfff\udfff', '\ufffe', '\uffff']) {
    assert.equal(isXml10CharacterText(invalid), false, JSON.stringify(invalid));
    assert.equal(isXml10CharacterText(`before${invalid}after`), false, JSON.stringify(invalid));
  }
});

test('real surrogate pairs, accents and XML-permitted Unicode survive the character-only gate', () => {
  const values = ['café', '🌱', '𐍈', '\ud800\udc00', '\udbff\udfff',
    'café 🌱 𐍈', '\u007f\u0085\u009f', '\ud7ff\ue000\ufffd'];
  for (const value of values) assert.equal(isXml10CharacterText(value), true, JSON.stringify(value));
});

test('the shared character predicate does not inherit an exporter-specific 2000-character label budget', () => {
  for (const value of ['a'.repeat(2000), 'a'.repeat(2001), '🌱 café\t'.repeat(1000)]) {
    assert.equal(isXml10CharacterText(value), true);
  }
});

test('character-valid markup and DTD text are not confused with XML parsing or document security validation', () => {
  // Acceptance here says nothing about well-formedness, entity expansion,
  // resource loading, parser configuration or whether a document is safe to use.
  for (const value of ['<unclosed', '<a></b>', 'bare & text', '<?xml version="1.0"?>',
    '<!DOCTYPE root [<!ENTITY local "text">]><root>&local;</root>']) {
    assert.equal(isXml10CharacterText(value), true, value);
  }
});

function openField(name: string): DesignCanvasState {
  // Synthetic engineering geometry, not a real site or a farming recommendation.
  return { siteId: 'synthetic-character-test-site',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 200, imgH: 100, mPerPx: 0.5 },
    items: [], lines: [],
    zones: [{ id: 'synthetic-character-test-field', zone: 2, feature: 'staple_garden', name,
      points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
    step: 'planting', updatedAt: '2026-11-04T00:00:00.000Z', rev: 1 };
}

test('extracting the shared predicate does not let oversized saved field labels bypass exporter source admission', () => {
  for (const includeLabels of [false, true]) {
    const valid = openField('a'.repeat(2000));
    const accepted = buildFieldLayoutKml({ rawState: valid, effectiveFrame: { ...valid.frame },
      selection: { kind: 'all' }, sample: false, includeLabels });
    assert.equal(accepted.status, 'ready', JSON.stringify(accepted));

    const oversized = openField('a'.repeat(2001)), before = JSON.stringify(oversized);
    assert.equal(isXml10CharacterText(oversized.zones[0].name), true);
    const held = buildFieldLayoutKml({ rawState: oversized, effectiveFrame: { ...oversized.frame },
      selection: { kind: 'all' }, sample: false, includeLabels });
    assert.equal(held.status, 'held');
    if (held.status !== 'held') throw Error('Oversized saved label became an export');
    assert.ok(held.reasons.includes('unsafe-source'));
    assert.equal(JSON.stringify(oversized), before);
  }
});

test('valid Unicode field labels still use the existing exporter escaping without changing saved text', () => {
  const label = `café 🌱 𐍈 <A> & "B" 'C'`, raw = openField(label), before = JSON.stringify(raw);
  const result = buildFieldLayoutKml({ rawState: raw, effectiveFrame: { ...raw.frame },
    selection: { kind: 'all' }, sample: false, includeLabels: true });
  assert.equal(result.status, 'ready', JSON.stringify(result));
  if (result.status !== 'ready') throw Error('Valid Unicode label was held');
  assert.ok(result.kml.includes('<name>café 🌱 𐍈 &lt;A&gt; &amp; &quot;B&quot; &apos;C&apos;</name>'));
  assert.equal(result.kml.includes(label), false);
  assert.deepEqual(result.counts, { fields: 1, beds: 0, paths: 0 });
  assert.equal(JSON.stringify(raw), before);
});
