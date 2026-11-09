import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { GrowerSeedSourcingGroupReview, GrowerSeedSourcingReview } from '../lib/international/grower-seed-sourcing';

// Presentation fixtures only: no actual nursery source, seed stock, purchase,
// source authentication or live actor/save/export authority is supplied here.
const file = '/components/crops/GrowerSeedSourcingSummary.tsx';
const previous = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0, dependency: 0 };
const storage = () => { effects.storage++; throw Error('A seed planning summary must not read or write storage'); };
const network = () => { effects.network++; throw Error('A seed planning summary must not fetch or submit an order'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: network }, window: { value: browser },
  localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith(file) && !['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(specifier)) {
      effects.dependency++; throw Error('The summary may import the model type only, without a runtime calculation, source or backend dependency');
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(file)) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Summary } = await import('../components/crops/GrowerSeedSourcingSummary.tsx');
const importEffects = { ...effects };
function group(values: Partial<GrowerSeedSourcingGroupReview> = {}): GrowerSeedSourcingGroupReview {
  return { index: 73, id: 'private-supply-group', batchIds: ['private-raising-a', 'private-raising-b'], status: 'complete',
    knownRequiredSeedsSubtotal: 17, requiredSeeds: 17,
    identification: { enteredLabel: null, labelStatus: 'not-recorded', cropNames: [], cropIdentityCount: null,
      cropStatus: 'unavailable', description: 'Planning identification is not recorded; varieties and seed lots are not verified.' },
    counts: { status: 'complete', neededSeeds: 12, packsNeeded: 3, plannedPackSeeds: 15 }, issues: [], ...values };
}
function review(values: Partial<GrowerSeedSourcingReview> = {}): GrowerSeedSourcingReview {
  return { status: 'available', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified', nurseryReviewStatus: 'ready',
    coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed',
    horizon: { start: '2028-12-01', endExclusive: '2029-01-01' }, representedBatchCount: 2, assignedBatchCount: 2,
    unassignedBatchIds: [], sourceIssues: ['private-source-issue'], groups: [group()], issues: [],
    guidance: 'Synthetic planning guidance is shown exactly as text.', ...values };
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
function mount(input: GrowerSeedSourcingReview | null) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Summary, { review: input })); }); mounted.add(renderer);
  return { renderer, text: () => text(renderer.root),
    update(next: GrowerSeedSourcingReview | null) { act(() => renderer.update(React.createElement(Summary, { review: next }))); },
  };
}
function headings(renderer: ReactTestRenderer) {
  return renderer.root.findAll(node => typeof node.type === 'string' && /^h[1-6]$/.test(node.type) && /^Supply group \d+$/.test(text(node)));
}
function card(renderer: ReactTestRenderer, position: number) {
  const heading = headings(renderer).find(node => text(node) === `Supply group ${position}`); assert.ok(heading);
  let owner = heading.parent;
  while (owner && owner.findAllByType('dt').length < 5) owner = owner.parent;
  assert.ok(owner, 'Each supply group must expose its five distinct named counts'); return owner;
}
function metric(owner: ReactTestInstance, name: string): string {
  const term = owner.findAllByType('dt').find(node => text(node) === name); assert.ok(term, name);
  const siblings = term.parent?.children ?? [], index = siblings.indexOf(term);
  for (const next of siblings.slice(index + 1)) {
    if (typeof next === 'string') continue;
    if (next.type === 'dt') break;
    if (next.type === 'dd') return text(next);
  }
  assert.fail(`A value must be associated with ${name}`);
}
const metrics = ['Known seed subtotal', 'Required seeds', 'Additional seeds needed', 'Planned packs', 'Seeds in planned packs'];
function noActions(renderer: ReactTestRenderer) {
  for (const tag of ['button', 'form', 'input', 'select', 'a'] as const) assert.equal(renderer.root.findAllByType(tag).length, 0, tag);
  assert.equal(renderer.root.findAll(node => typeof node.type === 'string'
    && Object.keys(node.props).some(key => /^on[A-Z]/.test(key))).length, 0, 'a display section must not hide an action on another element');
  assert.equal(renderer.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML')).length, 0);
}
function noPrivate(renderer: ReactTestRenderer) {
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /private-|fingerprint|batchIds|unassignedBatchIds|allocatedToPlanSeeds/);
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.dependency = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0, dependency: 0 });
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('the actual summary renders five supplied counts without recalculation, private handles or purchasing actions', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0, dependency: 0 });
  const value = review(), before = structuredClone(value), ui = mount(value), first = card(ui.renderer, 1);
  assert.match(ui.text(), /Seed sourcing planning review/); assert.match(text(first), /Planning counts complete/);
  assert.match(ui.text(), /\brepresented[^0-9]*2/i); assert.match(ui.text(), /\bassigned[^0-9]*2/i); assert.match(ui.text(), /\bunassigned[^0-9]*0/i);
  assert.deepEqual(headings(ui.renderer).map(text), ['Supply group 1'], 'Display order must not expose internal group index 73');
  assert.deepEqual(metrics.map(name => metric(first, name)), ['17', '17', '12', '3', '15']);
  assert.ok(ui.text().includes(value.guidance)); noActions(ui.renderer); noPrivate(ui.renderer);
  assert.deepEqual(value, before); assert.equal(Object.isFrozen(value), false); assert.equal(Object.isFrozen(value.groups[0]), false);
});

test('null and unavailable reviews withdraw earlier group quantities instead of showing stale arithmetic', () => {
  const value = review({ groups: [group({ knownRequiredSeedsSubtotal: 731, requiredSeeds: 731,
    counts: { status: 'complete', neededSeeds: 629, packsNeeded: 37, plannedPackSeeds: 629 } })] });
  const ui = mount(value); assert.match(ui.text(), /731/);
  ui.update(null);
  assert.match(ui.text(), /no current saved|current saved.*unavailable|check.*saved.*review/i);
  assert.equal(headings(ui.renderer).length, 0); assert.doesNotMatch(ui.text(), /731|629/);
  // A stale supplied payload cannot override its unavailable status.
  ui.update({ ...value, status: 'unavailable', issues: ['private-unavailable-code'] });
  assert.equal(headings(ui.renderer).length, 0); assert.doesNotMatch(ui.text(), /731|629|private-unavailable-code/);
  noActions(ui.renderer); noPrivate(ui.renderer);
});

test('explicit zero remains zero in all five fields while missing counts stay Unknown', () => {
  const zero = group({ knownRequiredSeedsSubtotal: 0, requiredSeeds: 0,
    counts: { status: 'complete', neededSeeds: 0, packsNeeded: 0, plannedPackSeeds: 0 } });
  const ui = mount(review({ groups: [zero] }));
  assert.deepEqual(metrics.map(name => metric(card(ui.renderer, 1), name)), ['0', '0', '0', '0', '0']);
  ui.update(review({ status: 'partial', groups: [group({ status: 'held', knownRequiredSeedsSubtotal: null, requiredSeeds: null, counts: null })] }));
  assert.deepEqual(metrics.map(name => metric(card(ui.renderer, 1), name)), ['Unknown', 'Unknown', 'Unknown', 'Unknown', 'Unknown']);
  assert.match(ui.text(), /Review needed/);
  ui.update(review({ status: 'partial', groups: [group({ status: 'unknown', knownRequiredSeedsSubtotal: 0, requiredSeeds: 0,
    counts: { status: 'unknown', neededSeeds: 0, packsNeeded: null, plannedPackSeeds: null } })] }));
  assert.deepEqual(metrics.map(name => metric(card(ui.renderer, 1), name)), ['0', '0', '0', 'Unknown', 'Unknown']);
  assert.match(ui.text(), /Some counts unknown/);
});

test('partial coverage keeps a known subtotal distinct from the unknown complete requirement and from physical stock', () => {
  const value = review({ status: 'partial', nurseryReviewStatus: 'partial', representedBatchCount: 5, assignedBatchCount: 3,
    unassignedBatchIds: ['private-unassigned-one', 'private-unassigned-two'],
    groups: [group({ status: 'unknown', knownRequiredSeedsSubtotal: 11, requiredSeeds: null,
      counts: { status: 'unknown', neededSeeds: null, packsNeeded: null, plannedPackSeeds: null }, issues: ['seed-requirement-unknown'] })] });
  const ui = mount(value), first = card(ui.renderer, 1);
  assert.match(ui.text(), /partial/i); assert.equal(metric(first, 'Known seed subtotal'), '11'); assert.equal(metric(first, 'Required seeds'), 'Unknown');
  assert.match(ui.text(), /represented/i); assert.match(ui.text(), /assigned/i); assert.match(ui.text(), /unassigned/i);
  assert.match(ui.text(), /\brepresented[^0-9]*5/i); assert.match(ui.text(), /\bassigned[^0-9]*3/i); assert.match(ui.text(), /\bunassigned[^0-9]*2/i);
  assert.match(ui.text(), /direct sowings/i); assert.match(ui.text(), /omitted/i); assert.match(ui.text(), /whole.?farm/i);
  assert.match(ui.text(), /not included|not assessed/i);
  assert.match(ui.text(), /allocations?.*planning|planning.*allocations?/i);
  assert.match(ui.text(), /not observed (?:stock|inventory)/i); assert.match(ui.text(), /purchase orders/i);
  assert.doesNotMatch(ui.text(), /source verified|stock confirmed|ready to order|order placed/i);
  noPrivate(ui.renderer); noActions(ui.renderer);
});

const explanations: readonly [string, string][] = [
  ['interchangeability-not-confirmed', 'Confirm these batches can use the same seed supply'],
  ['batch-membership-overlap', 'A batch is selected in more than one supply group'],
  ['group-id-duplicate', 'Review duplicate supply groups'],
  ['batch-membership-duplicate', 'A batch is repeated within this group'],
  ['batch-not-in-current-review', 'A selected batch is unavailable in this nursery review'],
  ['batch-reference-held', 'A selected batch reference needs review'],
  ['group-input-invalid', "Review this supply group's entries"],
  ['allocation-or-pack-count-invalid', 'Review the entered allocation or pack count'],
  ['seed-requirement-overflow', 'The seed requirement cannot be safely totalled'],
  ['seed-requirement-unknown', 'Some selected batch seed requirements are unknown'],
  ['allocation-or-pack-count-unknown', 'The allocation or pack count is not recorded'],
  ['pack-count-product-overflow', 'The planned pack total cannot be safely displayed'],
];
test('held and overflowing groups explain supplied problems in plain language without exposing codes or unsafe totals', () => {
  const issues = explanations.map(([code]) => code);
  const value = review({ status: 'partial', groups: [group({ status: 'held', index: 99, requiredSeeds: null,
    knownRequiredSeedsSubtotal: null, counts: null, issues }), group({ index: 0, id: 'private-overflow-group',
    status: 'overflow', requiredSeeds: Number.MAX_SAFE_INTEGER, knownRequiredSeedsSubtotal: Number.MAX_SAFE_INTEGER,
    counts: { status: 'overflow', neededSeeds: Number.MAX_SAFE_INTEGER, packsNeeded: 2, plannedPackSeeds: null },
    issues: ['pack-count-product-overflow'] })] });
  const before = structuredClone(value), ui = mount(value), first = card(ui.renderer, 1), second = card(ui.renderer, 2);
  assert.deepEqual(headings(ui.renderer).map(text), ['Supply group 1', 'Supply group 2']);
  assert.match(text(first), /Review needed/); assert.match(text(second), /Count exceeds safe display/);
  for (const [code, explanation] of explanations) { assert.ok(text(first).includes(explanation)); assert.equal(ui.text().includes(code), false, code); }
  assert.equal(metric(second, 'Seeds in planned packs'), 'Unknown'); assert.equal(metric(second, 'Planned packs'), '2');
  assert.doesNotMatch(ui.text(), /NaN|Infinity|9007199254740992/); noPrivate(ui.renderer); noActions(ui.renderer);
  assert.deepEqual(value, before);
});

test('repeated and unknown issue tokens produce deduplicated friendly explanations rather than raw diagnostics', () => {
  const value = review({ status: 'partial', groups: [group({ status: 'held', counts: null,
    issues: ['batch-reference-held', 'batch-reference-held', 'private-raw-issue-one', 'private-raw-issue-two', 'constructor', 'toString', '__proto__'] })] });
  const ui = mount(value), messages = card(ui.renderer, 1).findAllByType('li').map(text);
  assert.equal(messages.filter(message => message === 'A selected batch reference needs review').length, 1);
  assert.equal(messages.filter(message => message === 'This group needs further review').length, 1);
  assert.equal(messages.length, 2, 'all unsupported tokens share one plain fallback, including inherited object-key spellings');
  assert.doesNotMatch(ui.text(), /batch-reference-held|private-raw-issue/); noPrivate(ui.renderer);
});

test('supplied guidance remains escaped text and frozen input stays unchanged without any action or dependency', () => {
  const value = review({ guidance: '<img src=x onerror="fetch(1)"><script>stockApproved=true</script>' });
  const freeze = (input: unknown) => {
    if (input && typeof input === 'object') { for (const child of Object.values(input)) freeze(child); Object.freeze(input); }
  };
  const before = structuredClone(value); freeze(value);
  const ui = mount(value); assert.ok(ui.text().includes(value.guidance));
  for (const tag of ['script', 'img', 'iframe'] as const) assert.equal(ui.renderer.root.findAllByType(tag).length, 0);
  noActions(ui.renderer); assert.deepEqual(value, before);
});
