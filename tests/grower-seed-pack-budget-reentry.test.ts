import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { GrowerSeedPackBudgetProps } from '../components/crops/GrowerSeedPackBudget.tsx';
import type { GrowerSeedSourcingReview } from '../lib/international/grower-seed-sourcing.ts';
import { formattingContext } from '../lib/international/locales/formatting.ts';

// Synthetic presentation DTOs and controlled predicates exercise callback
// retirement only. They grant no production saved-source or account admission.
const target = '/components/crops/GrowerSeedPackBudget.tsx';
const hooks = registerHooks({
  load(url, context, next) {
    if (url.endsWith(target)) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Budget } = await import('../components/crops/GrowerSeedPackBudget.tsx');
const review: GrowerSeedSourcingReview = {
  status: 'available', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified', nurseryReviewStatus: 'ready',
  coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed', horizon: null,
  representedBatchCount: 1, assignedBatchCount: 1, unassignedBatchIds: [], sourceIssues: [], issues: [],
  guidance: 'Synthetic engineering presentation only.',
  groups: [{ index: 0, id: 'private-reentry-group', batchIds: ['private-reentry-batch'], status: 'complete',
    knownRequiredSeedsSubtotal: 3, requiredSeeds: 3,
    counts: { status: 'complete', neededSeeds: 3, packsNeeded: 3, plannedPackSeeds: 3 }, issues: [],
    identification: { enteredLabel: null, labelStatus: 'not-recorded', cropNames: [], cropIdentityCount: null,
      cropStatus: 'unavailable', description: 'Synthetic engineering identification only.' } }],
};
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
function mount() {
  let allowed = true;
  let check: (() => boolean) | null = null;
  let props: GrowerSeedPackBudgetProps = { reviewProof: Object.freeze({}), review,
    isCurrent: () => check ? check() : allowed,
    disabled: false, sample: false, formatting: formattingContext('en-US') };
  let renderer!: ReactTestRenderer;
  const element = () => React.createElement(Budget, props);
  act(() => { renderer = create(element()); }); mounted.add(renderer);
  const ui = {
    text: () => text(renderer.root),
    inputs: () => renderer.root.findAllByType('input'),
    currency: () => renderer.root.findByType('select'),
    get props() { return props; },
    update(patch: Partial<GrowerSeedPackBudgetProps> = {}) { props = { ...props, ...patch }; act(() => renderer.update(element())); },
    choose(value: unknown) { act(() => ui.currency().props.onChange({ target: { value } })); },
    enter(value: unknown) { act(() => ui.inputs()[0].props.onChange({ target: { value } })); },
    permit(value: boolean) { allowed = value; },
    check(value: (() => boolean) | null) { check = value; },
  };
  return ui;
}
function priced() {
  const ui = mount(); ui.choose('USD'); ui.enter('9.75');
  assert.equal(ui.inputs()[0].props.value, '9.75'); assert.match(ui.text(), /29[.,]25/);
  return ui;
}
function withdrawn(ui: ReturnType<typeof mount>): void {
  assert.equal(ui.inputs().length, 0, 'retired proof must withdraw its editor immediately');
  assert.doesNotMatch(ui.text(), /29[.,]25|3[.,]69/);
  assert.match(ui.text(), /held|unverified|unavailable/i);
}
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => hooks.deregister());

test('ordinary current string edits still calculate costs and explicitly changing denomination clears prices', () => {
  const ui = priced(); ui.enter('1.23'); assert.equal(ui.inputs()[0].props.value, '1.23'); assert.match(ui.text(), /3[.,]69/);
  ui.choose('GBP'); assert.equal(ui.currency().props.value, 'GBP'); assert.equal(ui.inputs()[0].props.value, '');
  ui.enter('2'); assert.equal(ui.inputs()[0].props.value, '2'); assert.match(ui.text(), /6[.,]00/);
});

test('a malformed price event stays inert while current but must still withdraw a newly rejected source', () => {
  const ui = priced(); let coercions = 0;
  const unsafe = Object.defineProperty({}, 'toString', { get() { coercions++; throw Error('must not coerce'); } });
  ui.enter(unsafe); assert.equal(ui.inputs()[0].props.value, '9.75'); assert.equal(coercions, 0);
  ui.permit(false); ui.enter(unsafe); withdrawn(ui); assert.equal(coercions, 0);
  ui.permit(true); ui.update(); withdrawn(ui);
});

for (const edit of ['price', 'currency'] as const) {
  test('a ' + edit + ' rejection after a same-proof rerender withdraws visible costs before another render', () => {
    const ui = priced();
    const retained = edit === 'price' ? ui.inputs()[0].props.onChange : ui.currency().props.onChange;
    let entered = false;
    ui.check(() => {
      if (entered) return true;
      entered = true;
      ui.update({ formatting: formattingContext('de-DE') });
      return false;
    });
    // Invoke outside an outer act: the predicate's own act must commit a real
    // intervening render before the original event resumes its continuation.
    retained({ target: { value: edit === 'price' ? '1.23' : 'GBP' } });
    assert.equal(entered, true); withdrawn(ui);
    ui.check(() => true); ui.update(); withdrawn(ui);
  });

  test('a ' + edit + ' predicate rerender cannot let its superseded callback overwrite the current editor', () => {
    const ui = priced();
    const retained = edit === 'price' ? ui.inputs()[0].props.onChange : ui.currency().props.onChange;
    let entered = false;
    ui.check(() => {
      if (entered) return true;
      entered = true;
      ui.update({ formatting: formattingContext('de-DE') });
      return true;
    });
    retained({ target: { value: edit === 'price' ? '1.23' : 'GBP' } });
    assert.equal(entered, true); assert.equal(ui.currency().props.value, 'USD');
    assert.equal(ui.inputs()[0].props.value, '9.75'); assert.match(ui.text(), /29,25/);
    ui.check(null); ui.enter('1.23'); assert.equal(ui.inputs()[0].props.value, '1.23'); assert.match(ui.text(), /3,69/);
  });
}

test('an old rejection after proof replacement cannot withdraw or overwrite the replacement editor', () => {
  const ui = priced(), retained = ui.inputs()[0].props.onChange;
  const replacement = Object.freeze({}); let entered = false;
  ui.check(() => {
    if (entered) return true;
    entered = true;
    ui.update({ reviewProof: replacement });
    ui.choose('GBP'); ui.enter('2');
    return false;
  });
  retained({ target: { value: '1.23' } });
  assert.equal(entered, true); assert.equal(ui.props.reviewProof, replacement);
  assert.equal(ui.currency().props.value, 'GBP'); assert.equal(ui.inputs()[0].props.value, '2'); assert.match(ui.text(), /6[.,]00/);
  ui.check(null); ui.update(); assert.equal(ui.inputs()[0].props.value, '2');
});
