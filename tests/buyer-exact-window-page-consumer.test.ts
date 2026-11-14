import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import ts from 'typescript';
import { bindSiteContext, createSiteCountryContext } from '../lib/international/site-context.ts';
import { resolvePlanningSupport } from '../lib/international/planning-policy.ts';

// Execute actual route JSX availability and prop expressions without importing
// the page's hooks/browser. Boundary components are markers, not mounted editors
// or live actor/source authority. Other suites exercise those real consumers.
const source = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
const page = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let ownSection: ts.Expression | undefined;
const targetNodes: ts.JsxSelfClosingElement[] = [];
const ownReferences: ts.JsxExpression[] = [];
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'growerPlanningPanel') ownSection = node.initializer;
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'HarvestTargetsPanel') targetNodes.push(node);
  if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && node.expression.text === 'growerPlanningPanel') ownReferences.push(node);
  ts.forEachChild(node, visit);
}
visit(page); assert.ok(ownSection, 'Actual route own-planning section must be inspectable');
function explicitOwn(node: ts.JsxSelfClosingElement) {
  return node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(page) === 'basis'
    && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === 'own-records');
}
const ownNode = targetNodes.find(explicitOwn), legacyNode = targetNodes.find(node => !explicitOwn(node));
assert.ok(ownNode); assert.ok(legacyNode);
assert.ok(ownSection.pos <= ownNode.pos && ownNode.end <= ownSection.end, 'Own-records editor belongs to the actual shared section');
function contains(outer: ts.Node, inner: ts.Node) { return outer.pos <= inner.pos && inner.end <= outer.end; }
function hasCatalogueFlag(node: ts.Node): boolean {
  let found = false;
  function inspect(child: ts.Node) { if (ts.isIdentifier(child) && child.text === 'allowCataloguePlanning') found = true; ts.forEachChild(child, inspect); }
  inspect(node); return found;
}
let legacyAvailability: ts.Expression | undefined, legacyCountry: ts.ConditionalExpression | undefined;
for (let node: ts.Node | undefined = legacyNode.parent; node; node = node.parent) {
  if (!legacyAvailability && ts.isJsxExpression(node) && node.expression) legacyAvailability = node.expression;
  if (ts.isConditionalExpression(node) && hasCatalogueFlag(node.condition)) { legacyCountry = node; break; }
}
assert.ok(legacyAvailability, 'Actual lower-editor availability expression must remain');
assert.ok(legacyCountry, 'Lower catalogue editor must remain inside a country-support branch');
const legacyExpression = `(${legacyCountry.condition.getText(page)}) ? (${contains(legacyCountry.whenTrue, legacyNode) ? legacyAvailability.getText(page) : 'null'})
  : (${contains(legacyCountry.whenFalse, legacyNode) ? legacyAvailability.getText(page) : 'null'})`;
// The shared section now also mounts the provisional preview. Keep it as a
// boundary here; its actual UI/source lifecycle has its own mounted tests.
const names = ['SavedGrowerRows', 'HarvestTargetsPanel', 'ProvisionalCropPreview', 'GrowerPlanningPanel', 'GrowerAutoPlanPanel', 'GrowerNurseryReviewPanel', 'SavedGrowerNurseryReviewPanel'];
const boundaries = Object.fromEntries(names.map(name => [name, function Boundary() { return null; }]));
function compile(expression: string): (input: Record<string, unknown>) => unknown {
  const compiled = ts.transpileModule(`function view(){return (${expression});}`, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
  } }).outputText;
  return Function('React', 'boundaries', `const {${names.join(',')}}=boundaries;return input=>{with(input){${compiled};return view();}}`)(React, boundaries);
}
const renderOwn = compile(ownSection.getText(page)), renderLegacy = compile(`<>{${legacyExpression}}</>`);
function elements(value: unknown): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  const children = value.props.children;
  return [value, ...(Array.isArray(children) ? children.flatMap(elements) : elements(children))];
}
function target(value: unknown) { return elements(value).find(element => element.type === boundaries.HarvestTargetsPanel); }
const siteId = 'site:0.00000,0.00000';
function support(country?: string) {
  const place = { id: 'fictional-place', name: 'Engineering fixture', lat: 0, lon: 0, savedAt: '2026-11-01T12:00:00.000Z' };
  if (!country) return resolvePlanningSupport({ places: [place], siteId });
  const confirmation = createSiteCountryContext({ siteId, countryCode: country, confirmed: true }, '2026-11-02T12:00:00.000Z'); assert.ok(confirmation);
  const context = bindSiteContext(confirmation, place); assert.ok(context);
  return resolvePlanningSupport({ places: [{ ...place, siteCountryContext: context }], siteId });
}
function input(allowCataloguePlanning: boolean) {
  const targets = Object.freeze([{ marker: 'complete-current-target-row' }]), beds = Object.freeze([{ marker: 'current-bed-row' }]), plantings = Object.freeze([{ marker: 'current-planting-row' }]);
  const saveContext = Object.freeze({ marker: 'current-save-context' });
  const saved: unknown[][] = [];
  const saveHarvestTargets = (...args: unknown[]) => { saved.push(args); };
  const source = Object.freeze({ marker: 'current-checked-source' });
  const onReview = () => { throw Error('Consumer mount must not review automatically'); };
  // The actual section also passes current conditions and a guarded historical
  // export callback to SavedGrowerRows. Keep those boundaries explicit: copying
  // its JSX without these bindings throws before the buyer-editor assertions run.
  const growerConditions = Object.freeze({ marker: 'current-provisional-conditions' });
  const exportSavedGrowerRecord = () => { throw Error('Consumer mount must not export automatically'); };
  // The actual page's preview revision now includes climate changes. Supply
  // that state boundary too, so extracting its JSX still exercises the buyer
  // editor rather than failing on an unrelated missing lexical binding.
  const climateState = { revision: 7 };
  return { allowCataloguePlanning, productionSiteId: siteId, growerScope: { kind: 'mapped-site', siteId }, growerScopeKey: 'current-scope-key',
    planningScopeKey: 'current-catalogue-key', markedPlantings: [], plan: { harvestTargets: targets, growerPlanningProfiles: [], plantings },
    selectedGrowerSource: null, beds, plantings, pattern: 'mild-frost', harvestSaveContext: saveContext, saveHarvestTargets,
    canvasSite: null, design: null, designBeds: [], saveGrowerProfiles() {},
    growerActorIsCurrent: () => true, siteCountry: { status: 'unknown', context: null, siteId, placeIds: ['fictional-place'] }, planningSupport: { fingerprint: 'fixture-policy' },
    saveProvisionalProfile() { throw Error('Consumer mount must not save automatically'); },
    growerWorkflow: { source, sourceIssue: null, checking: false, contextRevision: 4, onReview, onRefresh() {}, onAccept() {},
      onCheckPreviewSource() { throw Error('Consumer mount must not read preview source automatically'); }, acceptance: { status: 'idle' }, savedNurseryReview: null },
    placeName: 'Engineering source', designTitle: 'Engineering design', growerSample: false, growerOwner: 'fixture-owner',
    countryPlaces: [{ id: 'fictional-place', name: 'Engineering fixture' }],
    siteClimate: null, hasSiteCoords: false, siteLat: 0, siteSurvey: null, saved,
    growerConditions, exportSavedGrowerRecord,
    get provisionalClimateRevision() { return climateState.revision; },
    setProvisionalClimateRevision(update: (value: number) => number) { climateState.revision = update(climateState.revision); } };
}

for (const country of ['ZA', 'US', undefined]) test(`${country ?? 'unconfirmed'} mapped country can reach the own-records editor and automatic own-estimate planner together`, () => {
  const policy = support(country); assert.equal(policy.allowCataloguePlanning, country === 'ZA');
  const fixture = { ...input(policy.allowCataloguePlanning), siteCountry: policy.siteCountry }, tree = renderOwn(fixture), editor = target(tree); assert.ok(editor);
  assert.equal(editor.props.basis, 'own-records'); assert.equal(editor.props.siteId, siteId);
  assert.ok(elements(tree).some(element => element.type === boundaries.GrowerAutoPlanPanel)); assert.equal(fixture.saved.length, 0);
  const preview = elements(tree).find(element => element.type === boundaries.ProvisionalCropPreview); assert.ok(preview);
  assert.equal(preview.props.scope, fixture.growerScope); assert.equal(preview.props.actorIsCurrent, fixture.growerActorIsCurrent);
  assert.equal(preview.props.countryCode, policy.siteCountry.status === 'confirmed' ? country : null);
  assert.equal(preview.props.sourceName, 'Engineering fixture', 'use current scope-matched places, not the older cover-name state');
  assert.equal(preview.props.onSaveProfile, fixture.saveProvisionalProfile);
  assert.equal(preview.props.onCheckSource, fixture.growerWorkflow.onCheckPreviewSource);
  assert.equal(preview.props.profiles, fixture.plan.growerPlanningProfiles);
});

test('provisional place labels use only this mapped scope or the selected unmapped design', () => {
  const fixture = input(false);
  const preview = (changes: Record<string, unknown>) => elements(renderOwn({ ...fixture, ...changes }))
    .find(element => element.type === boundaries.ProvisionalCropPreview)!;
  assert.equal(preview({ countryPlaces: [
    { id: 'another-place', name: 'Wrong garden' }, { id: 'fictional-place', name: 'Right garden' },
  ], placeName: 'Old cover label' }).props.sourceName, 'Right garden');
  assert.equal(preview({ countryPlaces: [{ id: 'another-place', name: 'Wrong garden' }] }).props.sourceName, '');
  assert.equal(preview({ siteCountry: { ...fixture.siteCountry, placeIds: ['fictional-place', 'alias'] },
    countryPlaces: [{ id: 'fictional-place', name: ' ' }, { id: 'alias', name: '' }] }).props.sourceName, '');
  assert.equal(preview({ growerScope: { kind: 'unmapped-workspace', workspaceId: 'design:fixture' },
    design: { title: 'Selected workspace' }, placeName: 'Old mapped label' }).props.sourceName, 'Selected workspace');
});

test('the actual preview mount forwards climate revision changes without reviewing or saving the buyer plan', () => {
  const fixture = input(false), before = JSON.stringify(fixture.plan);
  const preview = () => elements(renderOwn(fixture)).find(element => element.type === boundaries.ProvisionalCropPreview)!;
  const initial = preview(); assert.ok(initial);
  assert.equal(fixture.provisionalClimateRevision, 7, 'mounting must not invoke the change callback');
  assert.equal(initial.props.contextRevision, '4:fixture-policy:7');
  assert.equal(typeof initial.props.onClimateChanged, 'function');
  (initial.props.onClimateChanged as () => void)();
  assert.equal(fixture.provisionalClimateRevision, 8);
  assert.equal(preview().props.contextRevision, '4:fixture-policy:8', 'the next actual mount must receive the changed climate revision');
  assert.equal(JSON.stringify(fixture.plan), before); assert.equal(fixture.saved.length, 0);
});

test('absent site, absent grower scope and unmapped workspace cannot acquire the saved buyer editor', () => {
  for (const allowed of [false, true]) for (const change of [
    { productionSiteId: null }, { productionSiteId: '' }, { growerScope: null }, { growerScope: { kind: 'unmapped-workspace', workspaceId: 'reference-only' } },
  ]) assert.equal(target(renderOwn({ ...input(allowed), ...change })), undefined);
});

test('mapped target entry stays reachable before bed measurements are supplied, without starting source reads or reviews', () => {
  const fixture = { ...input(true), beds: [], selectedGrowerSource: null, designBeds: [] };
  const editor = target(renderOwn(fixture)); assert.ok(editor); assert.deepEqual(editor.props.beds, []); assert.equal(fixture.saved.length, 0);
});

test('the actual own-records mount retains its exact key, full rows, save context and request-bound callbacks', () => {
  const fixture = input(true), tree = renderOwn(fixture), editor = target(tree); assert.ok(editor);
  assert.equal(editor.key, `own-targets:${siteId}:${fixture.growerScopeKey}`);
  assert.equal(editor.props.targets, fixture.plan.harvestTargets); assert.equal(editor.props.beds, fixture.beds); assert.equal(editor.props.plantings, fixture.plantings);
  assert.equal(editor.props.pattern, fixture.pattern); assert.deepEqual(editor.props.climate, {});
  assert.equal(editor.props.saveContext, fixture.harvestSaveContext); assert.equal(editor.props.onTargets, fixture.saveHarvestTargets); assert.equal(editor.props.onSaveTargets, fixture.saveHarvestTargets);
  assert.equal(typeof editor.props.onAccept, 'function');
  const before = JSON.stringify(fixture.plan);
  (editor.props.onAccept as () => void)(); assert.equal(JSON.stringify(fixture.plan), before); assert.equal(fixture.saved.length, 0);
  const auto = elements(tree).find(element => element.type === boundaries.GrowerAutoPlanPanel); assert.ok(auto);
  assert.equal(auto.props.source, fixture.growerWorkflow.source); assert.equal(auto.props.onReview, fixture.growerWorkflow.onReview);
  const history = elements(tree).find(element => element.type === boundaries.SavedGrowerRows); assert.ok(history);
  assert.equal(history.props.wholeBookRows, fixture.plan.plantings);
  assert.equal(history.props.conditions, fixture.growerConditions);
  assert.equal(history.props.onExport, fixture.exportSavedGrowerRecord);
});

test('an absent current plan passes empty target rows rather than borrowing another source', () => {
  const editor = target(renderOwn({ ...input(false), plan: null })); assert.ok(editor); assert.deepEqual(editor.props.targets, []);
});

test('the separate legacy catalogue editor keeps its actual supported-country and growing-space guards', () => {
  for (const country of ['ZA', 'US', undefined]) {
    const policy = support(country), fixture = input(policy.allowCataloguePlanning), editor = target(renderLegacy(fixture));
    assert.equal(!!editor, country === 'ZA');
    if (editor) { assert.equal(editor.props.basis, undefined); assert.equal(editor.props.saveContext, fixture.harvestSaveContext); }
  }
  assert.equal(target(renderLegacy({ ...input(true), productionSiteId: null })), undefined);
  assert.equal(target(renderLegacy({ ...input(true), beds: [] })), undefined);
});

test('the shared own-planning section remains referenced on both actual country-support branches', () => {
  const paths = ownReferences.map(reference => {
    for (let node: ts.Node | undefined = reference.parent; node; node = node.parent) {
      if (ts.isConditionalExpression(node) && hasCatalogueFlag(node.condition)) {
        const gate = node;
        const evaluate = Function('allowCataloguePlanning', `return (${gate.condition.getText(page)});`);
        const condition = (allowed: boolean): boolean => {
          const result: unknown = evaluate(allowed);
          assert.equal(typeof result, 'boolean', 'Actual country-support condition must evaluate to a boolean');
          if (typeof result !== 'boolean') assert.fail('Country-support branch returned a non-boolean result');
          return result;
        };
        return (allowed: boolean) => condition(allowed) ? contains(gate.whenTrue, reference) : contains(gate.whenFalse, reference);
      }
    }
    assert.fail('Actual shared-section use must retain its country-support route branch');
  });
  for (const country of ['ZA', 'US', undefined]) {
    const allowed = support(country).allowCataloguePlanning;
    assert.ok(paths.some(path => path(allowed)), 'Both catalogue-supported and held-country routes retain the own-estimate section');
  }
});
