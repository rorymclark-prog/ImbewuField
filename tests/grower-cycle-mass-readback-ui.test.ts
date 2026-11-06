import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Intent from '../components/crops/GrowerCycleIntent.ts';
import { readMassQuantityEntry, type MassQuantityEntry } from '../lib/mass-units.ts';
import { normaliseGrowerCycleOrigin, type GrowerCycleOriginView } from '../lib/international/grower-cycle.ts';

// Rendering/serialization fixtures only, not a saved farm or storage receipt.
const stamp = '2026-11-06T00:00:00.000Z';
function view(entry: MassQuantityEntry): Extract<GrowerCycleOriginView, { status: 'recorded' }> {
  const read = readMassQuantityEntry(entry); assert.equal(read.status, 'provided');
  if (read.status !== 'provided') throw Error('Engineering mass held');
  const raw = { kind: 'grower-entered', purpose: 'household', entryId: 'private-entry', quantityEntry: entry,
    demandSnapshot: { demandId: 'grower-entered:private-entry', profileId: 'private-profile',
      scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
      totalKg: { state: 'provided', value: read.kilograms, unit: 'kg-total', provenance: { kind: 'grower-estimate', recordedAt: stamp } },
      harvestWindow: { state: 'provided', value: { start: '2028-12-01', endExclusive: '2029-01-01' },
        unit: 'utc-date-window', provenance: { kind: 'grower-estimate', recordedAt: stamp } } } };
  const origin = normaliseGrowerCycleOrigin(JSON.parse(JSON.stringify(raw)), raw.demandSnapshot.demandId); assert.ok(origin);
  return { status: 'recorded', origin };
}
const render = (value: GrowerCycleOriginView) => renderToStaticMarkup(React.createElement(Intent, { view: value }));

test('serialized recorded pounds retain exact original text separately from canonical kg for the whole demand', () => {
  const value = view({ unit: 'lb', text: ' 0010.00 ' }), before = JSON.stringify(value), html = render(value);
  assert.match(html, /Original entered weight for this whole demand:/);
  assert.match(html, / 0010\.00  lb/); assert.match(html, /whitespace-pre-wrap/);
  assert.match(html, /4\.5359237 kg gross across 2028-12-01 to before 2029-01-01/);
  // Authored text stays separate; the shared delivery view prints the complete
  // validated canonical numeric equivalent rather than a rounded substitute.
  assert.doesNotMatch(html, /≈4\.536 kg/);
  assert.match(html, /Kilograms are the canonical planning equivalent for this whole request/);
  assert.match(html, /not this batch’s output or an observed harvest/);
  assert.doesNotMatch(html, /private-entry|private-profile|site:0\.00000|2026-11-06/);
  assert.equal(JSON.stringify(value), before);
});

test('older records with known canonical kg do not invent an original unit or spelling', () => {
  const latest = view({ unit: 'kg', text: '12.000' }); assert.equal(latest.origin.kind, 'grower-entered');
  if (latest.origin.kind !== 'grower-entered') return;
  const { quantityEntry: _entry, ...older } = latest.origin;
  const html = render({ status: 'recorded', origin: older });
  assert.match(html, /Original entered unit and text are not recorded/);
  assert.match(html, /not been reconstructed from kilograms or cycle capacity/);
  assert.match(html, /12 kg gross/); assert.doesNotMatch(html, /12\.000|Original entered weight for this whole demand:/);
});

test('small recorded values keep the original decimal and never display a fabricated zero', () => {
  const html = render(view({ unit: 'kg', text: '0.0000001' }));
  assert.match(html, /0\.0000001 kg/); assert.match(html, /1e-7 kg gross/);
  assert.doesNotMatch(html, /: 0 kg/);
});
