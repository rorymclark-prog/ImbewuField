import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoFacilitatorState } from '../lib/demo-farm.ts';
import { sampleScalePair, scaleArrangement, scaleAnswer, checkScaleAnswers, type ScalePair } from '../lib/design-scale.ts';
import { DESIGN_WORKED, existingFeatureIds, rectLeavesTeachingFrame, rectsOverlap, workedArea, workedProblems, workedEdgeGap, workedHandoverText } from '../lib/design-worked.ts';

test('scale teaching uses the same dimensions as the sample garden without exporting site or household records', () => {
  const source = buildDemoFacilitatorState();
  const pair = sampleScalePair(source.items);
  assert.equal(pair.length, 2);
  for (const bed of pair) {
    const original = source.items.find(item=>item.id === bed.reference)!;
    assert.deepEqual([bed.xM, bed.yM, bed.widthM, bed.lengthM], [original.xM, original.yM, original.wM, original.hM]);
    assert.deepEqual(Object.keys(bed).sort(), ['reference','label','xM','yM','widthM','lengthM'].sort());
  }
  assert.ok(!JSON.stringify(pair).includes('bgSite'));
});

test('a changed source cannot silently turn aligned scale teaching into a rotated, missing or unequal-bed example', () => {
  const items = buildDemoFacilitatorState().items;
  assert.throws(()=>sampleScalePair(items.filter(item=>item.id !== 'demo-bed-2')));
  assert.throws(()=>sampleScalePair([...items,items.find(item=>item.id === 'demo-bed-1')!]));
  for (const patch of [{ rotation: 90 }, { wM: 0 }, { xM: NaN }, { yM: 99 }, { hM: 99 }, { xM: 4 }]) {
    assert.throws(()=>sampleScalePair(items.map(item=>item.id==='demo-bed-2' ? {...item,...patch} : item)));
  }
});

const pair: ScalePair = [
  { reference:'left', label:'Left', xM:10, yM:7, widthM:2, lengthM:3 },
  { reference:'right', label:'Right', xM:15, yM:7, widthM:2, lengthM:3 },
];

test('clear space is measured edge to edge and is not counted as bed area', () => {
  const model = scaleArrangement(pair,'supplied');
  assert.equal(model.gapM,3); // Centre separation is 5; the clear gap excludes the bed width.
  assert.equal(model.coveredM2,12);
  assert.equal(model.gapAreaM2,9);
  assert.equal(model.outerAreaM2,21);
  assert.equal(model.coveredM2+model.gapAreaM2,model.outerAreaM2);
});

test('moving a bed keeps its size while the shared ground is counted only once', () => {
  const source = structuredClone(pair);
  const supplied = scaleArrangement(pair,'supplied');
  const touching = scaleArrangement(pair,'touching');
  const overlap = scaleArrangement(pair,'overlap');
  assert.equal(touching.gapM,0); assert.equal(touching.overlapM,0); assert.equal(touching.coveredM2,12);
  assert.equal(overlap.overlapM,1); assert.equal(overlap.overlapAreaM2,3); assert.equal(overlap.coveredM2,9);
  assert.equal(overlap.bedAreaM2,supplied.bedAreaM2);
  assert.equal(overlap.frameWidthM,supplied.frameWidthM);
  assert.equal(touching.frameWidthM,supplied.frameWidthM);
  assert.equal(overlap.beds[1].widthM,source[1].widthM);
  assert.equal(overlap.beds[1].lengthM,source[1].lengthM);
  assert.deepEqual(pair,source);
});

test('calculation checks reject blank and partial numbers while accepting decimal commas and a genuine zero gap', () => {
  for (const input of ['', ' ', '6 m²', '1,2.3', '-1', 'Infinity', '1e2', 'NaN']) assert.equal(scaleAnswer(input),null,input);
  assert.equal(scaleAnswer('0,75'),0.75); assert.equal(scaleAnswer('0'),0);
  const touching = scaleArrangement(pair,'touching');
  assert.ok(checkScaleAnswers(touching, { bed:'6', space:'0', covered:'12' }).every(result=>result.correct));
  assert.ok(checkScaleAnswers(touching, { bed:'6', space:'', covered:'12' }).some(result=>!result.correct));
  const overlap = scaleArrangement(pair,'overlap');
  const naiveSum = checkScaleAnswers(overlap, { bed:'6', space:'1', covered:'12' });
  assert.equal(naiveSum.find(item=>item.id==='covered')!.correct,false);
  assert.equal(naiveSum.find(item=>item.id==='covered')!.expected,9);
});

test('the worked design source pack stays a bounded fictional model with named revision evidence', () => {
  assert.equal(DESIGN_WORKED.coordinateSystem.unit, 'metres');
  assert.match(DESIGN_WORKED.notice, /Fictional classroom model/);
  assert.ok(DESIGN_WORKED.sourceCards.some(card => card.id === DESIGN_WORKED.revision.source));
  assert.ok(DESIGN_WORKED.sourceCards.some(card => card.kind === 'unknown'));
});

test('the worked alternatives retain existing evidence and one supplied growing-area basis', () => {
  const existing = DESIGN_WORKED.existing.find(feature => feature.id === 'E-PLOT-A')!;
  const alternative = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')!.geometry[0]!;
  assert.equal(workedArea(existing), 48);
  assert.equal(workedArea(alternative), 48);
  assert.deepEqual(existingFeatureIds(), ['E-PLOT-A', 'E-HOME', 'E-ROUTE', 'E-GATE', 'E-WATER']);
  assert.equal(DESIGN_WORKED.proposal.status, 'deferred after W-CARE');
  assert.deepEqual(workedProblems(), []);
});

test('worked-plan geometry checks catch a deliberately misplaced or obstructing proposal', () => {
  const alternative = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')!.geometry[0]!;
  const route = DESIGN_WORKED.existing.find(feature => feature.id === 'E-ROUTE')! as typeof alternative;
  assert.equal(rectLeavesTeachingFrame({ ...alternative, x: 19 }), true);
  assert.equal(rectsOverlap({ ...alternative, x: 12.25 }, route), true);
  assert.equal(rectsOverlap(alternative, route), false);
});

test('a wrong alternative is rejected by the complete worked-pack check, not only a helper', () => {
  for (const patch of [{ x: 19 }, { x: 12.25 }, { width: 0 }, { x: NaN }]) {
    const altered = structuredClone(DESIGN_WORKED);
    Object.assign(altered.concepts.find(concept => concept.id === 'B')!.geometry[0], patch);
    assert.ok(workedProblems(altered).length > 0, JSON.stringify(patch));
  }
  const edge = workedEdgeGap();
  assert.equal(edge.gap, 0.5); // 13.5 − (12 + 1), not the 4 m centre separation.
  assert.deepEqual(workedProblems(), []);
});

test('a care refusal must reach work, purchasing and cost records before handover', () => {
  for (const patch of [{ phase: 'Build now' }, { quantity: 'Buy materials' }, { costStatus: '0' }, { careStatus: 'Assigned without agreement' }]) {
    const altered = structuredClone(DESIGN_WORKED);
    Object.assign(altered.dependencies.find(row => row.featureIds.includes('P-COMPOST'))!.R2, patch);
    assert.ok(workedProblems(altered).length > 0, JSON.stringify(patch));
  }
  const text = workedHandoverText();
  for (const row of DESIGN_WORKED.dependencies) {
    for (const id of row.featureIds) assert.ok(text.includes(id));
    for (const state of [row.R1, row.R2]) for (const value of Object.values(state)) assert.ok(text.includes(value), value);
  }
  for (const card of DESIGN_WORKED.sourceCards) assert.ok(text.includes(card.text));
  assert.ok(text.includes(DESIGN_WORKED.notice));
  assert.ok(text.includes(DESIGN_WORKED.revision.nextOwner));
  assert.ok(!text.includes(DESIGN_WORKED.variation.text), 'a separate practice variation must not rewrite the guided record');
});
