import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, events, account, samples } from './international-grower-operations-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { nurseryDimensionToCanonical } from '../lib/length-units.ts';
import type { GrowerNurseryReviewPanelProps } from '../components/crops/GrowerNurseryReviewPanel.tsx';

const deliveries: { blob: Blob; filename: string }[] = [];
Object.assign(globalThis, { __growerNurseryReviewUnitsDelivery: deliveries, IS_REACT_ACT_ENVIRONMENT: true });
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((context.parentURL?.endsWith('/lib/length-unit-preference.ts') || context.parentURL?.endsWith('/lib/nursery-save-receipt.ts')) && specifier === 'firebase/auth') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent('export function onAuthStateChanged(_auth,next){const auth=globalThis.__growerOperationsFixture.auth;auth.add(next);return()=>auth.delete(next);}'),
      };
    }
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === '@/lib/file-delivery') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent('export function downloadFile(blob, filename) {globalThis.__growerNurseryReviewUnitsDelivery.push({blob,filename});return "downloaded";}'),
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  captureNurseryUnitPreferenceContext,
  writeNurseryUnitPreference,
  subscribeNurseryUnitPreferenceValue,
  revokeNurseryUnitPreferenceContext,
} = await import('../lib/length-unit-preference.ts');
const { default: GrowerNurseryReviewPanel } = await import('../components/crops/GrowerNurseryReviewPanel.tsx');

after(() => {
  hooks.deregister();
  cleanup();
  Reflect.deleteProperty(globalThis, '__growerNurseryReviewUnitsDelivery');
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

beforeEach(async () => {
  await reset();
});

const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({
  state: 'provided',
  value,
  unit,
  provenance: { kind: 'grower-estimate', recordedAt: stamp },
});

async function fixture() {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = 'site:0.00000,0.00000';
  canvas.frame.centerLat = 0;
  canvas.frame.centerLng = 0;
  canvas.items = [{ ...canvas.items.find(row => row.defId === 'veg_bed')!, id: 'private-bed-id', wM: 3, hM: 4 }];
  canvas.lines = [];
  canvas.zones = [];
  const source = await fingerprintGrowerWorkflowSource(
    inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId, raw: canvas, sourceRevision: 'synthetic-source-revision' })
  );
  assert.equal(source.status, 'ready');

  const crop = CROPS.find(row => !row.transplant)!;
  const profile: GrowerPlanningProfile = {
    version: 1,
    profileId: 'private-estimate-id',
    cropKey: crop.key,
    scope: source.scope,
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
  };

  const request: GrowerAutoPlanRequest = {
    requestedAt: stamp,
    scope: source.scope,
    geometryFingerprint: source.geometryFingerprint,
    profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'),
    planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({
      bedId: bed.id,
      scope: source.scope,
      window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    })),
    reserved: [],
    demands: [
      {
        demandId: 'private-demand-id',
        profileId: profile.profileId,
        scope: source.scope,
        totalKg: own(1, 'kg-total'),
        harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window'),
      },
    ],
    maxAssessments: 1000,
  };

  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready');

  const review: Extract<GrowerWorkflowReview, { status: 'review' }> = {
    status: 'review',
    recordedAt: stamp,
    request,
    proposal,
    issues: [],
    blockedBeds: [],
    targetMetadata: [],
    existingOwnCycles: [],
  };

  const settings: NurserySettings = {
    version: 1,
    spaces: [{ id: 'private-bench-id', siteId: source.resourceSiteId, name: 'Fixture bench', usableM2: 2 }],
    containers: [{ id: 'private-tray-id', siteId: source.resourceSiteId, name: 'Fixture trays', cells: 40, widthCm: 50, lengthCm: 40, owned: 5 }],
    profiles: [
      {
        id: 'private-recipe-id',
        siteId: source.resourceSiteId,
        cropKey: crop.key,
        model: 'seed-cell',
        containerId: 'private-tray-id',
        spaceId: 'private-bench-id',
        fieldSurvivalPercent: 80,
        germinationPercent: 50,
        nurserySurvivalPercent: 75,
      },
    ],
  };

  return { source, review, settings };
}

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}

function mount(props: GrowerNurseryReviewPanelProps) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(GrowerNurseryReviewPanel, props));
  });
  const button = (name: string) => {
    const found = renderer.root.findAllByType('button').find(node => text(node) === name);
    assert.ok(found, `Missing button ${name}`);
    return found;
  };
  const select = (label: string) => {
    const found = renderer.root.findAllByType('select').find(node => node.props['aria-label'] === label);
    assert.ok(found, `Missing select ${label}`);
    return found;
  };
  const fieldByLabel = (labelPrefix: string) => {
    const label = renderer.root.findAllByType('label').find(node => {
      const first = node.children[0];
      return typeof first === 'string' && first.startsWith(labelPrefix);
    });
    assert.ok(label, `Missing label starting with ${labelPrefix}`);
    const input = label.findAll(node => node.type === 'input' || node.type === 'select')[0];
    assert.ok(input, `Missing input in label ${labelPrefix}`);
    return input;
  };
  return {
    renderer,
    text: () => text(renderer.root),
    button,
    select,
    fieldByLabel,
    click(name: string) {
      act(() => {
        button(name).props.onClick();
      });
    },
    async press(name: string) {
      await act(async () => { await button(name).props.onClick(); });
    },
    resource(index: number, values: { resource: string; quantity: string; start: string; endExclusive: string }) {
      for (const [prefix, value] of [['Resource', values.resource], ['Quantity', values.quantity], ['From (UTC)', values.start], ['Until (exclusive, UTC)', values.endExclusive]]) {
        const fieldset = renderer.root.findAllByType('fieldset').find(node => node.children.some(child => typeof child !== 'string' && child.type === 'legend' && text(child) === `Available resource ${index + 1}`));
        assert.ok(fieldset);
        const label = fieldset.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix));
        assert.ok(label);
        const input = label.findAll(node => node.type === 'input' || node.type === 'select')[0];
        act(() => input.props.onChange({ target: { value } }));
      }
    },
    changeUnit(unit: 'metric' | 'imperial') {
      act(() => {
        select('Nursery units').props.onChange({ target: { value: unit } });
      });
    },
    check(labelSub: string, checked = true) {
      const labels = renderer.root.findAllByType('label').filter(l => text(l).includes(labelSub));
      assert.ok(labels.length > 0, `Missing checkbox for ${labelSub}`);
      const input = labels[0].findByType('input');
      act(() => {
        input.props.onChange({ target: { checked } });
      });
    },
    dispose() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

test('GrowerNurseryReviewPanel displays imperial area when selected, preserving container counts', async () => {
  const { source, review, settings } = await fixture();
  const screen = mount({
    source,
    review,
    settings,
    contextRevision: 1,
    onCheckCurrent: async () => true,
  });

  try {
    // Default metric shows m²
    assert.match(screen.text(), /Fixture bench: 2 m² allocated to this plan/);
    assert.match(screen.text(), /Fixture trays: 5 containers allocated to this plan/);

    // Switch to imperial
    screen.changeUnit('imperial');

    // 2 m² -> ~21.527821 ft²
    assert.match(screen.text(), /Fixture bench: 21\.527821 ft² allocated to this plan/);
    // Container count remains invariant
    assert.match(screen.text(), /Fixture trays: 5 containers allocated to this plan/);
    assert.doesNotMatch(screen.text(), /5 ft²/);
  } finally {
    screen.dispose();
  }
});

test('invalid area input blocks unit switch and retains original unit text with correction note', async () => {
  const { source, review, settings } = await fixture();
  const screen = mount({
    source,
    review,
    settings,
    contextRevision: 1,
    onCheckCurrent: async () => true,
  });

  try {
    // Add availability
    screen.click('Add resource availability');

    // Select the space resource
    const resourceSelect = screen.fieldByLabel('Resource');
    act(() => {
      resourceSelect.props.onChange({ target: { value: 'space:private-bench-id' } });
    });

    // Enter incomplete comma ',' or invalid '1,2,3' decimal text.
    // parseLengthDecimal considers standalone ',' incomplete ('incomplete-number'),
    // and '1,2,3' invalid ('plain-decimal-required').
    const qtyInput = screen.fieldByLabel('Quantity (m²)');
    act(() => {
      qtyInput.props.onChange({ target: { value: ',' } });
    });

    // Attempt unit switch to imperial
    screen.changeUnit('imperial');

    // Unit switch is blocked, retaining warning note and metric label
    assert.match(screen.text(), /Complete or correct entered area numbers before changing units/);
    assert.equal(screen.select('Nursery units').props.value, 'metric');
    assert.equal(screen.fieldByLabel('Quantity (m²)').props.value, ',');

    // Positive test: enter valid '12,' which parseLengthDecimal parses as ready 12
    act(() => {
      screen.fieldByLabel('Quantity (m²)').props.onChange({ target: { value: '12,' } });
    });
    screen.changeUnit('imperial');
    // Valid 12 m² switches to ft² (~129.166927) and clears note
    assert.equal(screen.select('Nursery units').props.value, 'imperial');
    assert.match(screen.fieldByLabel('Quantity (ft²)').props.value, /^129\.166/);
    assert.doesNotMatch(screen.text(), /Complete or correct entered area numbers/);
  } finally {
    screen.dispose();
  }
});

test('external preference write updates GrowerNurseryReviewPanel unit via subscription', async () => {
  const { source, review, settings } = await fixture();
  const screen = mount({
    source,
    review,
    settings,
    contextRevision: 1,
    onCheckCurrent: async () => true,
  });

  const pref = captureNurseryUnitPreferenceContext();
  try {
    assert.equal(screen.select('Nursery units').props.value, 'metric');

    // Write imperial externally
    act(() => {
      writeNurseryUnitPreference(pref, 'imperial');
    });

    // Subscribed component switches to imperial
    assert.equal(screen.select('Nursery units').props.value, 'imperial');
    assert.match(screen.text(), /Fixture bench: 21\.527821 ft² allocated to this plan/);
  } finally {
    screen.dispose();
    revokeNurseryUnitPreferenceContext(pref);
  }
});

test('per-callback proofIsCurrent isolation: if first listener mutates owner, stale listener gets zero notifications', async () => {
  // Capture two proofs under active account 'owner-a'
  account.bindMountedAccountLocalStorageUid('owner-a');
  probe.actor = 'owner-a';
  const prefA = captureNurseryUnitPreferenceContext();
  const prefB = captureNurseryUnitPreferenceContext();
  assert.ok(prefA && prefB);

  const callsA: string[] = [];
  const callsB: string[] = [];

  // Listener A switches active owner
  const stopA = subscribeNurseryUnitPreferenceValue(prefA, (val) => {
    callsA.push(val);
    // Simulate actor change mid-dispatch before listener B is invoked
    account.bindMountedAccountLocalStorageUid('owner-b');
    probe.actor = 'owner-b';
  });

  const stopB = subscribeNurseryUnitPreferenceValue(prefB, (val) => {
    callsB.push(val);
  });

  try {
    writeNurseryUnitPreference(prefA, 'imperial');
    assert.equal(callsA.length, 1);
    // Listener B was for original owner-a; since listener A switched to owner-b, listener B's proofIsCurrent fails
    assert.equal(callsB.length, 0);
  } finally {
    stopA();
    stopB();
    revokeNurseryUnitPreferenceContext(prefA);
    revokeNurseryUnitPreferenceContext(prefB);
  }
});

test('external preference switch with entered rows and actor reset resets transient state', async () => {
  account.bindMountedAccountLocalStorageUid('owner-a');
  probe.actor = 'owner-a';
  const { source, review, settings } = await fixture();
  const screen = mount({
    source,
    review,
    settings,
    contextRevision: 1,
    onCheckCurrent: async () => true,
  });

  const pref = captureNurseryUnitPreferenceContext();
  try {
    // Add availability row and enter quantity
    screen.click('Add resource availability');
    const resourceSelect = screen.fieldByLabel('Resource');
    act(() => {
      resourceSelect.props.onChange({ target: { value: 'space:private-bench-id' } });
    });
    const qtyInput = screen.fieldByLabel('Quantity (m²)');
    act(() => {
      qtyInput.props.onChange({ target: { value: '1.5' } });
    });

    // Check confirmed
    screen.check('I confirm these dated resource allocations.');

    // External preference switch to imperial
    act(() => {
      writeNurseryUnitPreference(pref, 'imperial');
    });

    // 1.5 m² switched to ft² (~16.145866)
    assert.equal(screen.select('Nursery units').props.value, 'imperial');
    const updatedQtyInput = screen.fieldByLabel('Quantity (ft²)');
    assert.match(updatedQtyInput.props.value, /^16\.145/);

    // Now simulate actor transition via real sample mode authority
    act(() => {
      samples.enterSampleMode();
    });

    // Actor transition resets entered rows and confirmations
    assert.doesNotMatch(screen.text(), /16\.145/);
    const checkboxes = screen.renderer.root.findAllByType('input').filter(i => i.props.type === 'checkbox');
    for (const cb of checkboxes) {
      assert.equal(cb.props.checked, false);
    }
  } finally {
    screen.dispose();
    revokeNurseryUnitPreferenceContext(pref);
  }
});

test('actor transition A -> B -> A and sample mode transitions recreate fresh subscriptions with clean reset', async () => {
  account.bindMountedAccountLocalStorageUid('owner-a');
  probe.actor = 'owner-a';
  const { source, review, settings } = await fixture();
  const screen = mount({
    source,
    review,
    settings,
    contextRevision: 1,
    onCheckCurrent: async () => true,
  });

  try {
    // Starts metric under owner-a
    assert.equal(screen.select('Nursery units').props.value, 'metric');

    // Switch owner-a preference to imperial
    screen.changeUnit('imperial');
    assert.equal(screen.select('Nursery units').props.value, 'imperial');

    // Switch actor to owner-b (A -> B)
    assert.ok(probe.auth.size > 0, 'auth listener must be active on preference scope before actor switch');
    act(() => {
      account.bindMountedAccountLocalStorageUid('owner-b');
      probe.actor = 'owner-b';
      for (const listener of probe.auth) listener({ uid: 'owner-b' });
    });

    // Fresh subscription under owner-b starts with default metric
    assert.equal(screen.select('Nursery units').props.value, 'metric');

    // Enter sample mode under owner-b
    act(() => {
      samples.enterSampleMode();
    });
    // Fresh subscription in sample mode; switches cleanly and respects sample changes
    assert.equal(screen.select('Nursery units').props.value, 'metric');
    screen.changeUnit('imperial');
    assert.equal(screen.select('Nursery units').props.value, 'imperial');

    // Exit sample mode back to owner-b
    act(() => {
      samples.exitSampleMode();
    });
    assert.equal(screen.select('Nursery units').props.value, 'metric');

    // Switch back from owner-b to owner-a (B -> A)
    act(() => {
      account.bindMountedAccountLocalStorageUid('owner-a');
      probe.actor = 'owner-a';
      for (const listener of probe.auth) listener({ uid: 'owner-a' });
    });
    // Fresh subscription re-reads owner-a's saved imperial preference
    assert.equal(screen.select('Nursery units').props.value, 'imperial');
  } finally {
    screen.dispose();
  }
});

test('reentrant sample transition during user unit switch does not restore former actor rows', async () => {
  account.bindMountedAccountLocalStorageUid('owner-a');
  probe.actor = 'owner-a';
  const earlier = captureNurseryUnitPreferenceContext();
  assert.ok(earlier);
  let fired = 0;
  const stop = subscribeNurseryUnitPreferenceValue(earlier, () => {
    ++fired;
    samples.enterSampleMode();
  });
  const data = await fixture();
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    screen.click('Add resource availability');
    act(() => screen.fieldByLabel('Resource').props.onChange({ target: { value: 'space:private-bench-id' } }));
    act(() => screen.fieldByLabel('Quantity (m²)').props.onChange({ target: { value: '1.5' } }));
    screen.check('I confirm these dated resource allocations.');
    screen.changeUnit('imperial');
    const quantities = screen.renderer.root.findAllByType('input').filter(n => n.props.inputMode === 'decimal').map(n => n.props.value);
    assert.equal(fired, 1);
    assert.equal(samples.isSampleMode(), true);
    assert.deepEqual(quantities, [], 'actor/sample reset must not restore previous entered rows');
    for (const cb of screen.renderer.root.findAllByType('input').filter(n => n.props.type === 'checkbox')) assert.equal(cb.props.checked, false);
    assert.equal(screen.select('Nursery units').props.value, 'metric');
  } finally {
    screen.dispose();
    stop();
    revokeNurseryUnitPreferenceContext(earlier);
  }
});

test('imperial decimal entry survives repeated display switches and exports the unrounded canonical area with unchanged container counts', async () => {
  deliveries.length = 0;
  const data = await fixture(); let checks = 0;
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => { ++checks; return true; } });
  try {
    screen.changeUnit('imperial');
    screen.click('Add resource availability');
    screen.resource(0, { resource: 'space:private-bench-id', quantity: '10,5', start: '2028-02-01', endExclusive: '2028-03-15' });
    screen.click('Add resource availability');
    screen.resource(1, { resource: 'container:private-tray-id', quantity: '5', start: '2028-02-01', endExclusive: '2028-03-15' });
    for (let index = 0; index < 4; ++index) { screen.changeUnit('metric'); screen.changeUnit('imperial'); }
    assert.equal(screen.fieldByLabel('Quantity (ft²)').props.value, '10.5');
    assert.equal(screen.fieldByLabel('Quantity (containers)').props.value, '5');
    screen.check('I have reviewed the saved nursery');
    screen.check('I confirm these dated resource');
    screen.check('I have listed all other nursery uses');
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Dated nursery estimates/);
    assert.match(screen.text(), /Outer container footprint \(ft²\)8\.611128 ft²/);
    await screen.press('Download reviewed nursery CSV');
    assert.equal(checks, 2); assert.equal(deliveries.length, 1);
    const csv = await deliveries[0].blob.text();
    // All fixture values are single-line CSV cells; preserve quoted commas in prose.
    const table = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1].replace(/""/g, '"')));
    const columns = table.shift()!;
    const rows = table.map(row => { assert.equal(row.length, columns.length); return Object.fromEntries(columns.map((name, index) => [name, row[index]])); });
    const area = rows.find(row => row.record_type === 'grower_asserted_availability' && row.resource_type === 'space');
    const containers = rows.find(row => row.record_type === 'grower_asserted_availability' && row.resource_type === 'container');
    assert.ok(area); assert.ok(containers);
    // Preserve the original conversion's exact JS number, including its binary
    // representation; display precision must never become the saved authority.
    const originalCanonical = nurseryDimensionToCanonical(10.5, 'ft2')!;
    assert.equal(area.availability_quantity, String(originalCanonical));
    assert.ok(Math.abs(Number(area.availability_quantity) - 0.97548192) < 1e-14);
    assert.notEqual(area.availability_quantity, '0.975482');
    assert.equal(containers.availability_quantity, '5');
    assert.ok(rows.some(row => row.area_m2 === '0.8'));
    assert.match(screen.text(), /area values in canonical m²/);
    assert.doesNotMatch(csv, /private-|ft²/);
  } finally { screen.dispose(); }
});
