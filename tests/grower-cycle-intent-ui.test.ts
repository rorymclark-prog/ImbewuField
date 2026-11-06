import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GrowerCycleOriginView } from '../lib/international/grower-cycle.ts';
import Intent from '../components/crops/GrowerCycleIntent.ts';
const stamp = '2026-11-06T00:00:00.000Z';
// Rendering fixtures only. Canonical acceptance/round-trip proof belongs to the
// traceability tests; this suite checks what the actual shared component says.
function entered(purpose: 'household' | 'trial', weight = 12): GrowerCycleOriginView {
  return { status: 'recorded', origin: { kind: 'grower-entered', purpose, entryId: 'private-entry',
    demandSnapshot: { demandId: 'grower-entered:private-entry', profileId: 'private-profile',
      scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
      totalKg: { state: 'provided', value: weight, unit: 'kg-total', provenance: { kind: 'grower-estimate', recordedAt: stamp } },
      harvestWindow: { state: 'provided', value: { start: '2028-12-01', endExclusive: '2029-01-01' },
        unit: 'utc-date-window', provenance: { kind: 'grower-estimate', recordedAt: stamp } } } } };
}
const render = (view: GrowerCycleOriginView | undefined) => renderToStaticMarkup(React.createElement(Intent, { view }));

test('saved household and trial cards read back the original whole-demand request without exposing private identities', () => {
  for (const purpose of ['household', 'trial'] as const) {
    const view = entered(purpose), before = JSON.stringify(view), html = render(view);
    assert.match(html, purpose === 'household' ? /Planning purpose: household food/ : /Planning purpose: trial growing/);
    assert.match(html, /Original request for all cycles in this demand: 12 kg gross/);
    assert.match(html, /2028-12-01 to before 2029-01-01 \(UTC\)/);
    assert.match(html, /not this batch/); assert.match(html, /or an observed harvest/);
    assert.doesNotMatch(html, /private-entry|private-profile|site:0\.00000|2026-11-06/);
    assert.equal(JSON.stringify(view), before);
  }
});

test('older purpose-only records do not borrow a request quantity or window from their cycle', () => {
  const html = render({ status: 'recorded', origin: { kind: 'grower-entered', purpose: 'trial', entryId: 'private-entry' } });
  assert.match(html, /Planning purpose: trial growing/);
  assert.match(html, /Original requested weight and harvest window are not recorded/);
  assert.match(html, /not been inferred/);
  assert.doesNotMatch(html, /0 kg|gross across/);
});

test('an unrecorded purpose remains unknown and an explicit buyer retains its own meaning', () => {
  for (const view of [undefined, { status: 'not-recorded' } as const]) {
    const html = render(view); assert.match(html, /Planning purpose not recorded/);
    assert.doesNotMatch(html, /household food|trial growing|buyer target|0 kg/);
  }
  const buyer = render({ status: 'recorded', origin: { kind: 'buyer-target', harvestTargetId: 'private-buyer' } });
  assert.match(buyer, /Planning purpose: buyer target/);
  assert.doesNotMatch(buyer, /private-buyer|kg|household food/);
});

test('original entered requests retain exact numeric readback instead of replacing it with a rounded estimate', () => {
  const tiny = entered('household', 0.0000001), before = JSON.stringify(tiny);
  assert.match(render(tiny), /1e-7 kg/); assert.doesNotMatch(render(tiny), /: 0 kg/);
  // The original request is retained data, not calculated output: show every supplied digit.
  assert.match(render(entered('household', 12.34567)), /12\.34567 kg/);
  assert.doesNotMatch(render(entered('household', 12.34567)), /≈|12\.346 kg/);
  assert.equal(JSON.stringify(tiny), before);
});
