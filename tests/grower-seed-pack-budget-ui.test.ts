import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { GrowerSeedPackBudgetProps } from '../components/crops/GrowerSeedPackBudget.tsx';
import type { GrowerSeedSourcingGroupReview, GrowerSeedSourcingReview, GrowerFieldSeedSourcingReview } from '../lib/international/grower-seed-sourcing.ts';
import { formattingContext, formatRecordedMoney } from '../lib/international/locales/formatting.ts';
import { INVOICE_PILOT_CURRENCIES } from '../lib/invoice-currency.ts';

// Controlled presentation DTOs and callback predicates only. These fixtures do
// not authenticate saved sources or grant production proof, purchase or storage.
const target = '/components/crops/GrowerSeedPackBudget.tsx';
const key = '__imbewuSeedPackBudgetTestObserver';
const oldGlobals = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT', key]
  .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const effects = { network: 0, storage: 0 };
const observation: { controls: Array<{ type: string; props: Record<string, unknown> }> } = { controls: [] };
const storage = () => { effects.storage++; throw Error('Temporary estimate must not use storage'); };
for (const [name, descriptor] of Object.entries({
  fetch: { value: () => { effects.network++; throw Error('Temporary estimate must not fetch or order'); } },
  window: { value: Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } }) },
  localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true }, [key]: { value: observation },
})) Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith(target) && specifier === 'react/jsx-runtime') {
      const real = next(specifier, context).url;
      // Transparent host-prop observation; real JSX runtime and React lifecycle
      // execute unchanged. This lets old pre-commit handlers be tested directly.
      const code = `import {jsx as realJsx,jsxs as realJsxs,Fragment} from ${JSON.stringify(real)};
        function observe(type,props){if(type==='select'||type==='input')globalThis.${key}.controls.push({type,props});}
        export function jsx(type,props,key){observe(type,props);return realJsx(type,props,key);}
        export function jsxs(type,props,key){observe(type,props);return realJsxs(type,props,key);}
        export {Fragment};`;
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(target)) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});
const { default: Budget } = await import('../components/crops/GrowerSeedPackBudget.tsx');
function group(patch: Partial<GrowerSeedSourcingGroupReview> = {}): GrowerSeedSourcingGroupReview {
  return { index: 73, id: 'private-budget-group-a', batchIds: ['private-budget-batch-a'], status: 'complete',
    knownRequiredSeedsSubtotal: 3, requiredSeeds: 3, counts: { status: 'complete', neededSeeds: 3, packsNeeded: 3, plannedPackSeeds: 3 }, issues: [],
    identification: { enteredLabel: 'Entered lot note', labelStatus: 'provided', cropNames: [], cropIdentityCount: null, cropStatus: 'unavailable', description: 'Synthetic engineering identification only.' }, ...patch };
}
function nursery(patch: Partial<GrowerSeedSourcingReview> = {}): GrowerSeedSourcingReview {
  return { status: 'available', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified', nurseryReviewStatus: 'ready',
    coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed', horizon: null,
    representedBatchCount: 1, assignedBatchCount: 1, unassignedBatchIds: [], sourceIssues: [], groups: [group()], issues: [],
    guidance: 'Synthetic planning presentation only.', ...patch };
}
function field(): GrowerFieldSeedSourcingReview {
  const { batchIds: _ignored, ...base } = group();
  return { status: 'partial', basis: 'grower-field-seed-sourcing-estimates', requirementBasis: 'entered-gross-whole-seed-count', sourceVerification: 'not-verified',
    coverage: 'represented-accepted-non-nursery-cycles-only', wholeFarmCoverage: 'not-assessed', cycles: [], representedCycleCount: 5, assignedCycleCount: 1,
    unassignedPlantingIds: ['private-unassigned-one', 'private-unassigned-two'], heldSourceRowCount: 2, legacySourceRowCount: 3, excludedNurseryCycleCount: 4,
    sourceIssues: [], groups: [{ ...base, plantingIds: ['private-field-cycle'], selectedCycleCount: 1 }], issues: [], guidance: 'Synthetic field presentation only.' };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value;
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
function mount(patch: Partial<GrowerSeedPackBudgetProps> = {}, strict = false) {
  const proof = Object.freeze({}); let current: object | null = proof, allowed = true;
  let props: GrowerSeedPackBudgetProps = { reviewProof: proof, review: deepFreeze(nursery()), isCurrent: candidate => allowed && candidate === current,
    disabled: false, sample: false, formatting: formattingContext('en-US'), ...patch };
  if (patch.reviewProof) current = patch.reviewProof;
  let renderer!: ReactTestRenderer;
  const element = () => strict ? React.createElement(React.StrictMode, null, React.createElement(Budget, props)) : React.createElement(Budget, props);
  act(() => { renderer = create(element()); }); mounted.add(renderer);
  const ui = { renderer, text: () => text(renderer.root), get props() { return props; },
    inputs: () => renderer.root.findAllByType('input').filter(node => node.props.inputMode === 'decimal'),
    currency: () => renderer.root.findByType('select'),
    update(next: Partial<GrowerSeedPackBudgetProps>) { props = { ...props, ...next }; act(() => renderer.update(element())); },
    permit(value: boolean) { allowed = value; },
    current(next: object | null) { current = next; },
    choose(value: unknown) { act(() => ui.currency().props.onChange({ target: { value } })); },
    enter(index: number, value: unknown) { act(() => ui.inputs()[index].props.onChange({ target: { value } })); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  }; return ui;
}
function labelFor(ui: ReturnType<typeof mount>, control: ReactTestInstance): ReactTestInstance {
  const label = ui.renderer.root.findAllByType('label').find(node => node.props.htmlFor === control.props.id); assert.ok(label); return label;
}
function money(amount: number, currency = 'USD', locale = 'en-US'): string {
  const formatted = formatRecordedMoney({ amount, currency }, formattingContext(locale)); assert.ok(formatted); return formatted.text;
}
function noPrivate(ui: ReturnType<typeof mount>): void {
  assert.doesNotMatch(JSON.stringify(ui.renderer.toJSON()), /private-|reviewProof|batchIds|plantingIds|decimal-representation-loss|invalid-pack-count/);
  for (const tag of ['form', 'a', 'script', 'img', 'iframe'] as const) assert.equal(ui.renderer.root.findAllByType(tag).length, 0, tag);
}
function noCurrentCost(ui: ReturnType<typeof mount>): void {
  assert.ok(ui.renderer.root.findAllByType('select').every(node => node.props.disabled === true));
  assert.ok(ui.inputs().every(node => node.props.disabled === true));
  assert.doesNotMatch(ui.text(), /USD\s*9\.75|USD\s*29\.25|USD\s*1\.23/);
}
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 }); observation.controls.length = 0;
});
after(() => { hooks.deregister(); for (const [name, descriptor] of oldGlobals) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
} });

test('the committed editor begins with explicit blank currency and prices, labels and temporary-estimate copy, without private handles', () => {
  const ui = mount(); assert.match(ui.text(), /Temporary seed.pack budget/i); assert.equal(ui.currency().props.value, '');
  assert.deepEqual(ui.currency().findAllByType('option').map(node => node.props.value), ['', ...INVOICE_PILOT_CURRENCIES]);
  assert.match(text(labelFor(ui, ui.currency())), /currency/i); assert.equal(ui.inputs().length, 1);
  assert.equal(ui.inputs()[0].props.type, 'text'); assert.equal(ui.inputs()[0].props.value, '');
  assert.match(text(labelFor(ui, ui.inputs()[0])), /price|pack/i); assert.match(ui.inputs()[0].props.className, /min-h-11/);
  assert.match(ui.currency().props.className, /min-h-11/); assert.match(ui.text(), /Supply group 1/); assert.match(ui.text(), /Entered lot note/);
  assert.match(ui.text(), /dot|comma/i); assert.match(ui.text(), /decimal/i); assert.match(ui.text(), /not.*(?:order|invoice|expense|stock)/i);
  assert.match(ui.text(), /whole.farm.*not assessed|not assessed.*whole.farm/i); noPrivate(ui);
});
for (const review of [nursery(), field()]) test('actual ' + review.basis + ' gets the correct public group identity and coverage without whole-farm completeness', () => {
  const before = JSON.stringify(review), ui = mount({ review: deepFreeze(review), sample: true });
  assert.ok(ui.renderer.root.findAllByType('span').some(node => text(node).trim() === 'DEMO'), 'DEMO is a distinct visible badge even when text traversal concatenates adjacent elements');
  assert.ok(ui.text().includes(review.basis === 'grower-field-seed-sourcing-estimates' ? 'Field supply group 1' : 'Supply group 1'));
  assert.match(ui.text(), review.basis === 'grower-field-seed-sourcing-estimates' ? /accepted|non.nursery/i : /transplant|nursery/i);
  if (review.basis === 'grower-field-seed-sourcing-estimates') {
    assert.match(ui.text(), /unassigned[^0-9]*2/i); assert.match(ui.text(), /held[^0-9]*2/i);
    assert.match(ui.text(), /legacy[^0-9]*3/i); assert.match(ui.text(), /excluded[^0-9]*4/i);
  }
  ui.choose('USD'); ui.enter(0, '1');
  if (review.status === 'partial') assert.match(ui.text(), /known subtotal.*incomplete budget/i);
  assert.equal(JSON.stringify(review), before); noPrivate(ui);
});
test('blank price remains Unknown and entered zero is a known zero only after explicit currency choice', () => {
  const ui = mount(); ui.choose('USD'); assert.match(ui.text(), /Unknown/i); assert.equal(ui.text().includes(money(0)), false);
  ui.enter(0, '0'); assert.ok(ui.text().includes(money(0))); assert.doesNotMatch(ui.text(), /known subtotal.*incomplete budget/i);
  ui.enter(0, ''); assert.match(ui.text(), /known subtotal.*incomplete budget/i); assert.match(ui.text(), /Unknown/i); assert.equal(ui.text().includes(money(0)), false);
});
test('price decimal grammar and exact raw text survive while invalid text produces friendly validation rather than a numeric prefix', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, ' 0,1 '); assert.equal(ui.inputs()[0].props.value, ' 0,1 ');
  assert.ok(ui.text().includes(money(0.3)));
  for (const invalid of ['1pack', '1e2', '-0', '-2', '0.10000000000000001']) {
    ui.enter(0, invalid); assert.equal(ui.inputs()[0].props.value, invalid);
    assert.match(ui.text(), /valid|review|check|invalid|plain decimal|negative|represented exactly|finish/i); assert.match(ui.text(), /known subtotal.*incomplete budget/i);
    assert.doesNotMatch(ui.text(), /plain-decimal-required|negative-price-rejected|decimal-representation-loss/);
  }
});
test('every explicit pilot currency remains the chosen denomination and changing denomination clears all prices', () => {
  const ui = mount({ review: nursery({ groups: [group(), group({ id: 'private-budget-group-b' })] }) });
  for (const currency of INVOICE_PILOT_CURRENCIES) {
    ui.choose(currency); assert.equal(ui.currency().props.value, currency); assert.deepEqual(ui.inputs().map(node => node.props.value), ['', '']);
    ui.enter(0, '1'); ui.enter(1, '2'); assert.ok(ui.text().includes(money(9, currency)));
    ui.choose(currency); assert.deepEqual(ui.inputs().map(node => node.props.value), ['1', '2']);
  }
  ui.choose(''); assert.equal(ui.currency().props.value, ''); assert.deepEqual(ui.inputs().map(node => node.props.value), ['', '']);
});
test('unsupported currency tokens and nonstring price events are inert without coercion or a hidden country default', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '1'); let calls = 0;
  const unsafe = Object.defineProperty({}, 'toString', { get() { calls++; throw Error('coercion'); } });
  for (const currency of ['usd', ' USD', 'USD ', 'US', null, unsafe]) { ui.choose(currency); assert.equal(ui.currency().props.value, 'USD'); }
  ui.enter(0, unsafe); assert.equal(ui.inputs()[0].props.value, '1'); assert.equal(calls, 0);
});
test('subtotal uses exact independent line values and representation-losing aggregate totals are unavailable', () => {
  const onePack = { status: 'complete' as const, neededSeeds: 1, packsNeeded: 1, plannedPackSeeds: 1 };
  const ui = mount({ review: nursery({ groups: [group({ counts: onePack }), group({ id: 'private-budget-group-b', counts: onePack })] }) });
  ui.choose('USD'); ui.enter(0, '0.1'); ui.enter(1, '0.2'); assert.ok(ui.text().includes(money(0.3)));
  ui.enter(0, '9007199254740991'); ui.enter(1, '2');
  assert.match(ui.text(), /subtotal[^.]*unavailable|unavailable[^.]*subtotal/i);
  assert.doesNotMatch(ui.text(), /9,007,199,254,740,992\.00/); noPrivate(ui);
});
test('a product hold leaves no known cost but retains the original displayed review counts', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9007199254740991');
  assert.match(ui.text(), /review|unavailable|invalid/i); assert.match(ui.text(), /known subtotal.*incomplete budget/i);
  const article = ui.renderer.root.findByType('article');
  const term = article.findAllByType('dt').find(node => text(node) === 'Estimated line cost'); assert.ok(term);
  assert.match(text(term.parent!.findByType('dd')), /unavailable|cannot|held|review/i, 'known-factor arithmetic failure must be distinct from genuinely missing Unknown');
  assert.ok(article.findAllByType('span').some(node => /calcula|product|represent.*exact|review.*(?:cost|price)|cost.*(?:review|exact)/i.test(text(node))),
    'the affected row must explain the arithmetic hold in ordinary user language');
  assert.equal(ui.inputs()[0].props.value, '9007199254740991'); assert.doesNotMatch(ui.text(), /27,021,597,764,222,972/);
});
test('held, unknown and overflow groups remain visible but numeric surviving pack counts cannot authorize price controls', () => {
  const ui = mount({ review: nursery({ status: 'partial', groups: [group(),
    group({ id: 'private-held', status: 'held', counts: null }),
    group({ id: 'private-unknown', status: 'unknown', counts: { status: 'unknown', neededSeeds: 0, packsNeeded: null, plannedPackSeeds: null } }),
    group({ id: 'private-overflow', status: 'overflow', counts: { status: 'overflow', neededSeeds: 7, packsNeeded: 777, plannedPackSeeds: null } }),
    group({ id: 'private-count-overflow', status: 'complete', counts: { status: 'overflow', neededSeeds: 7, packsNeeded: 888, plannedPackSeeds: null } }),
  ] }) });
  assert.equal(ui.inputs().length, 1); for (let index = 1; index <= 5; index++) assert.ok(ui.text().includes(`Supply group ${index}`));
  assert.match(ui.text(), /777/); assert.match(ui.text(), /888/); ui.choose('USD'); ui.enter(0, '1');
  assert.match(ui.text(), /known subtotal.*incomplete budget/i); noPrivate(ui);
});
test('duplicate and null group identities stay visible without indexed or label-based price controls', () => {
  const shared = 'private-duplicate';
  const ui = mount({ review: nursery({ status: 'partial', groups: [group({ id: shared }), group({ id: shared }), group({ id: null }), group({ id: 'private-unique' })] }) });
  assert.equal(ui.inputs().length, 1); for (let index = 1; index <= 4; index++) assert.ok(ui.text().includes(`Supply group ${index}`));
  ui.choose('USD'); ui.enter(0, '1'); assert.match(ui.text(), /known subtotal.*incomplete budget/i); noPrivate(ui);
});
test('unavailable and empty reviews cannot manufacture a complete zero budget', () => {
  for (const review of [nursery({ status: 'unavailable' }), nursery({ groups: [] })]) {
    const ui = mount({ review }); assert.equal(ui.inputs().length, 0); assert.doesNotMatch(ui.text(), /complete represented budget/i);
    assert.match(ui.text(), /unavailable|Unknown|incomplete|review/i);
  }
});
test('locale-only, formatting and currentness callback reference changes preserve raw amounts and denomination while retiring old callbacks', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, ' 1,23 ');
  const old = ui.inputs()[0].props.onChange; ui.update({ formatting: formattingContext('de-DE'), isCurrent: candidate => candidate === ui.props.reviewProof });
  assert.equal(ui.currency().props.value, 'USD'); assert.equal(ui.inputs()[0].props.value, ' 1,23 '); assert.ok(ui.text().includes(money(3.69, 'USD', 'de-DE')));
  act(() => old({ target: { value: '9.75' } })); assert.equal(ui.inputs()[0].props.value, ' 1,23 ');
  ui.update({ formatting: formattingContext('not_a_locale') }); assert.ok(ui.text().includes('Invalid locale tag; English formatting is shown explicitly.'));
  assert.equal(ui.inputs()[0].props.value, ' 1,23 '); assert.equal(ui.currency().props.value, 'USD');
});
test('each successful edit updates the live editor immediately so replay cannot overwrite a newer price', () => {
  const ui = mount(); ui.choose('USD'); const old = ui.inputs()[0].props.onChange;
  act(() => { old({ target: { value: '1.23' } }); old({ target: { value: '9.75' } }); });
  assert.equal(ui.inputs()[0].props.value, '1.23');
  const price = ui.inputs()[0].props.onChange, currency = ui.currency().props.onChange;
  ui.choose('GBP'); act(() => price({ target: { value: '9.75' } })); assert.equal(ui.inputs()[0].props.value, '');
  act(() => currency({ target: { value: 'EUR' } })); assert.equal(ui.currency().props.value, 'GBP');
});
test('temporary disabled hold withdraws costs, blocks handlers and then recovers without retiring the current proof', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); const old = ui.inputs()[0].props.onChange;
  ui.update({ disabled: true }); noCurrentCost(ui); act(() => old({ target: { value: '1.23' } }));
  ui.update({ disabled: false }); assert.equal(ui.currency().props.value, 'USD'); assert.equal(ui.inputs()[0].props.value, '9.75');
  assert.ok(ui.text().includes(money(29.25))); act(() => old({ target: { value: '1.23' } })); assert.equal(ui.inputs()[0].props.value, '9.75');
});
test('declined currentness withdraws cost and the same proof remains retired even if the predicate later returns true', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); const old = ui.inputs()[0].props.onChange;
  ui.permit(false); act(() => old({ target: { value: '1.23' } })); ui.update({}); noCurrentCost(ui);
  ui.permit(true); ui.update({}); noCurrentCost(ui);
  const next = Object.freeze({}); ui.current(next); ui.update({ reviewProof: next }); assert.equal(ui.currency().props.value, '');
  ui.choose('USD'); ui.enter(0, '1'); assert.ok(ui.text().includes(money(3)));
});
test('a current handler that discovers lost currentness withdraws the displayed budget without an unrelated parent render', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); ui.permit(false);
  ui.enter(0, '1.23'); noCurrentCost(ui);
  assert.match(ui.text(), /held|current|review|unavailable/i);
});
test('a current currency handler also withdraws displayed costs immediately when its proof is declined', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); ui.permit(false);
  ui.choose('GBP'); noCurrentCost(ui);
  ui.permit(true); ui.update({}); noCurrentCost(ui);
});
for (const edit of ['price', 'currency'] as const) test('a current ' + edit + ' handler retires and withdraws on a thrown currentness check without leaking details', () => {
  let throws = false;
  const ui = mount({ isCurrent: () => { if (throws) throw Error('PRIVATE_EVENT_CURRENTNESS'); return true; } });
  ui.choose('USD'); ui.enter(0, '9.75'); throws = true;
  if (edit === 'price') ui.enter(0, '1.23'); else ui.choose('GBP');
  noCurrentCost(ui); assert.doesNotMatch(ui.text(), /PRIVATE_EVENT_CURRENTNESS/);
  throws = false; ui.update({}); noCurrentCost(ui);
});
test('currentness exceptions withhold results and never leak internal exception text', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75');
  ui.update({ isCurrent: () => { throw Error('PRIVATE_CURRENTNESS_DETAIL'); } }); noCurrentCost(ui);
  assert.doesNotMatch(ui.text(), /PRIVATE_CURRENTNESS_DETAIL/);
  ui.update({ isCurrent: () => true }); noCurrentCost(ui);
});
test('a changed review under the same proof retires it and cannot be repaired by supplying the previous review again', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); const original = ui.props.review, old = ui.inputs()[0].props.onChange;
  ui.update({ review: deepFreeze(nursery()) }); noCurrentCost(ui); ui.update({ review: original }); noCurrentCost(ui);
  const next = Object.freeze({}); ui.current(next); ui.update({ reviewProof: next }); assert.equal(ui.currency().props.value, '');
  act(() => old({ target: { value: '1.23' } })); assert.equal(ui.currency().props.value, '');
});
test('proof replacement clears entries and returning through proof ABA cannot resurrect the old editor', () => {
  const ui = mount(); ui.choose('USD'); ui.enter(0, '9.75'); const first = ui.props.reviewProof, old = ui.currency().props.onChange;
  const next = Object.freeze({}); ui.current(next); ui.update({ reviewProof: next }); assert.equal(ui.currency().props.value, ''); assert.equal(ui.inputs()[0].props.value, '');
  ui.choose('GBP'); ui.enter(0, '1'); ui.current(first); ui.update({ reviewProof: first }); noCurrentCost(ui);
  act(() => old({ target: { value: 'USD' } })); noCurrentCost(ui);
});
test('server pre-commit markup withholds prices and StrictMode effect cleanup/setup leaves a fresh usable editor with old callbacks inert', () => {
  const props: GrowerSeedPackBudgetProps = { reviewProof: {}, review: nursery(), isCurrent: () => true, disabled: false, sample: false, formatting: formattingContext('en-US') };
  const html = renderToStaticMarkup(React.createElement(Budget, props)); assert.doesNotMatch(html, /USD\s*(?:1\.23|9\.75)/);
  assert.match(html, /held|current|review|unavailable|prepar/i);
  observation.controls.length = 0; const ui = mount({}, true);
  const early = observation.controls.find(control => control.type === 'select')?.props.onChange;
  assert.equal(typeof early, 'function', 'the observer must capture a real control generation for the retained-handler check');
  ui.choose('USD'); ui.enter(0, '1.23'); assert.equal(ui.currency().props.value, 'USD');
  if (typeof early !== 'function') throw Error('No real control callback was observed');
  act(() => early({ target: { value: 'GBP' } }));
  assert.equal(ui.currency().props.value, 'USD'); assert.equal(ui.inputs()[0].props.value, '1.23');
});
test('unmounted handlers cannot affect a fresh component or persist temporary entries', () => {
  const prior = mount(); prior.choose('USD'); prior.enter(0, '9.75'); const oldPrice = prior.inputs()[0].props.onChange, oldCurrency = prior.currency().props.onChange;
  prior.dispose(); const current = mount(); act(() => { oldPrice({ target: { value: '1.23' } }); oldCurrency({ target: { value: 'GBP' } }); });
  assert.equal(current.currency().props.value, ''); assert.equal(current.inputs()[0].props.value, ''); assert.match(current.text(), /Unknown/i);
});
