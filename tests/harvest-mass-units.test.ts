import test from 'node:test';
import assert from 'node:assert/strict';
import { createMassDraft, editMassDraft, readMassDraft, switchMassDraftUnit, massToKilograms, kilogramsToMass, formatMassKilograms,
  type MassDraft, type MassUnit } from '../lib/mass-units.ts';
import { createNurseryDimensionDraft, lengthToMetres, nurseryDimensionToCanonical, type LengthUnit, type NurseryDimensionUnit } from '../lib/length-units.ts';
import { sanitiseHarvestTargets, type HarvestTarget, type KgHarvestTarget } from '../lib/crop-plan.ts';
import { targetDemand } from '../lib/harvest-targets.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { growerDemandFromHarvestTarget } from '../lib/international/grower-harvest-demand.ts';
import { nurseryCeilRatio } from '../lib/crop-export-schedule.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import type { GrowerPlanningProfile, GrowerInput } from '../lib/international/grower-planning.ts';

// Synthetic engineering quantities and zero-coordinate scope, not agronomic advice.
const sourceKey = 'synthetic-actor/target-source';
const recordedAt = '2026-11-03T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const own = <T,U extends string>(value:T,unit:U): GrowerInput<T,U> => ({ state:'provided',value,unit,provenance:{kind:'grower-estimate',recordedAt} });
const missing = { state:'missing',reason:'not-entered' } as const;
const profile: GrowerPlanningProfile = { version:1,profileId:'synthetic-profile',cropKey:CROPS[0].key,scope,inputs:{
  plantsPerM2:own(1,'plants/m2'),yieldKgPerM2:own(2,'kg/m2/cycle'),establishment:own('direct','method'),nurseryDays:missing,
  fieldEntryToFirstHarvestDays:own(1,'days'),pickingDays:own(1,'days'),fieldOccupancyDays:own(2,'days'),turnaroundDays:own(1,'days'),allowedEntryMonths:own([2],'utc-months') } };
const base = { id:'synthetic-target',siteId:scope.siteId,cropKey:profile.cropKey,startMonth:'2028-02',endMonth:'2028-02',marketablePercent:50,outlet:'Synthetic buyer' };
const target = (weeklyKg:number):KgHarvestTarget => ({...base,weeklyKg});
function read<K extends string>(draft:MassDraft<K>) { const r=readMassDraft(draft,sourceKey);assert.equal(r.status,'ready');return r.kilograms; }
function toggle<K extends string>(draft:MassDraft<K>,unit:MassUnit) { const r=switchMassDraftUnit(draft,unit,sourceKey);assert.equal(r.status,'ready');return r.draft; }
const draft = (unit:MassUnit='kg',weeklyKg:number|undefined=4.535923700000001) => createMassDraft({sourceKey,unit,kilograms:{weeklyKg}});
function downstream(value:HarvestTarget) {
  const saved=sanitiseHarvestTargets(JSON.parse(JSON.stringify([value])));assert.equal(saved.length,1);
  const adapter=growerDemandFromHarvestTarget({target:saved[0],profile,scope,recordedAt});assert.equal(adapter.status,'ready');
  if(adapter.status!=='ready') throw Error('Fixture demand held');
  const request:GrowerAutoPlanRequest={requestedAt:recordedAt,scope,geometryFingerprint:'synthetic-geometry',profiles:[profile],
    beds:[{scope,bed:{id:'bed',label:'Synthetic bed',areaM2:100,kind:'bed'},measuredAreaM2:own(100,'m2')}],
    planningStart:own('2028-02-01','utc-date'),planningEndExclusive:own('2028-03-01','utc-date'),
    availability:[{bedId:'bed',scope,window:own({start:'2028-02-01',endExclusive:'2028-03-01'},'utc-date-window')}],reserved:[],demands:[adapter.demand],maxAssessments:1000};
  const plan=generateGrowerAutoPlan(request);assert.equal(plan.status,'ready',plan.issues.join(','));assert.ok(plan.cycles.length>0);
  return {saved,demand:targetDemand(saved[0]),adapter,plan};
}

test('pound edits reach identical real harvest sanitization, actual-day buyer demand and own-cycle quantities as canonical kilograms',()=>{
  // Exact decimal product 4.591922757520679116151 converts once to Number.
  const pounds='10.1234567890123',expected=4.591922757520679;
  let entered=editMassDraft(draft('lb'),'weeklyKg',pounds);
  for(let i=0;i<100;i++)entered=toggle(entered,i%2?'lb':'kg');
  assert.equal(read(entered).weeklyKg,expected);
  assert.deepEqual(downstream(target(read(entered).weeklyKg!)),downstream(target(expected)));
  const actual=downstream(target(expected));assert.equal(actual.adapter.days,29);assert.equal(actual.adapter.buyerTotalKg,expected*29/7);
  assert.equal(actual.adapter.deliveryDistribution,'not-established');assert.equal(actual.adapter.sourceVerification,'not-verified');
});

test('untouched awkward canonical kilograms never drift through rounded display, toggles or JSON reopen',()=>{
  const original=1.2345678901234567;let value=draft('lb',original);
  assert.notEqual(Number(value.fields.weeklyKg.text)*0.45359237,original,'display reparse negative control');
  assert.equal(editMassDraft(value,'weeklyKg',value.fields.weeklyKg.text),value);
  for(let i=0;i<200;i++)value=toggle(value,i%2?'lb':'kg');
  assert.equal(Object.is(read(value).weeklyKg,original),true);
  const saved=sanitiseHarvestTargets(JSON.parse(JSON.stringify([target(read(value).weeklyKg!)])))[0];
  const reopened=createMassDraft({sourceKey,unit:'lb',kilograms:{weeklyKg:saved.weeklyKg}});
  assert.equal(read(reopened).weeklyKg,original);assert.deepEqual(downstream(saved),downstream(target(original)));
});

test('the rounded table pound factor changes actual buyer demand and cannot replace footnote22 exactness',()=>{
  const exact=massToKilograms(10,'lb');assert.equal(exact,4.5359237);
  const rounded=10*0.4535924;assert.notEqual(exact,rounded);
  assert.notDeepEqual(targetDemand(target(exact!)),targetDemand(target(rounded)));
  assert.equal(kilogramsToMass(0.45359237,'lb'),1);assert.equal(massToKilograms(1,'lb'),0.45359237);
});

test('a missing optional pack weight stays unknown through unit choice, edits and real pack-demand consumers',()=>{
  let value=createMassDraft({sourceKey,unit:'lb',kilograms:{kgPerUnit:undefined},optionalFields:['kgPerUnit']});
  value=toggle(value,'kg');assert.equal(read(value).kgPerUnit,undefined);
  value=editMassDraft(value,'kgPerUnit','2');value=editMassDraft(value,'kgPerUnit',' ');value=toggle(value,'lb');assert.equal(read(value).kgPerUnit,undefined);
  const pack:HarvestTarget={...base,unit:'bunches',weeklyQuantity:7,...read(value)};
  const saved=sanitiseHarvestTargets(JSON.parse(JSON.stringify([pack])))[0];assert.ok(saved);assert.equal(saved.kgPerUnit,undefined);
  assert.deepEqual(targetDemand(saved),{days:29,demandKg:null});
  assert.deepEqual(growerDemandFromHarvestTarget({target:saved,profile,scope,recordedAt}),{status:'held',reasons:['unit-weight-missing']});
});

test('a supplied pounds-per-pack weight changes only canonical pack mass, preserving quantity, unit, dates and saleable share',()=>{
  let value=createMassDraft({sourceKey,unit:'lb',kilograms:{kgPerUnit:undefined},optionalFields:['kgPerUnit']});
  value=editMassDraft(value,'kgPerUnit','1.25');for(let i=0;i<80;i++)value=toggle(value,i%2?'kg':'lb');
  const expected=0.5669904625,actual={...base,unit:'crates' as const,weeklyQuantity:3,kgPerUnit:read(value).kgPerUnit};
  assert.deepEqual(downstream(actual),downstream({...actual,kgPerUnit:expected}));
  const saved=sanitiseHarvestTargets([actual])[0];assert.equal(saved.weeklyQuantity,3);assert.equal(saved.unit,'crates');assert.equal(saved.marketablePercent,50);assert.equal(saved.startMonth,'2028-02');
});

test('pristine required blank can choose pounds before entry while dirty cleared or incomplete mass holds its text/unit',()=>{
  const initial=createMassDraft({sourceKey,unit:'kg',kilograms:{weeklyKg:undefined}});assert.equal(readMassDraft(initial,sourceKey).status,'held');
  const switched=toggle(initial,'lb');assert.equal(switched.fields.weeklyKg.text,'');assert.equal(readMassDraft(switched,sourceKey).status,'held');
  const entered=editMassDraft(switched,'weeklyKg','.5');assert.equal(read(entered).weeklyKg,0.226796185);
  for(const text of ['', ' ', '-', '+', '.', ',', '1,000.5','1 lb','1/2','1e3']) {
    const changed=editMassDraft(entered,'weeklyKg',text),result=switchMassDraftUnit(changed,'kg',sourceKey);
    assert.equal(result.status,'held',text);assert.equal(result.draft,changed);assert.equal(changed.unit,'lb');assert.equal(changed.fields.weeklyKg.text,text);
  }
});

test('zero and negative known masses remain numeric and are rejected by the existing positive harvest schema, never changed into unknown',()=>{
  for(const text of ['0','-1']) {
    const value=editMassDraft(draft(),'weeklyKg',text);assert.equal(read(value).weeklyKg,Number(text));assert.equal(sanitiseHarvestTargets([target(read(value).weeklyKg!)]).length,0);
    const pack=createMassDraft({sourceKey,unit:'kg',kilograms:{kgPerUnit:undefined},optionalFields:['kgPerUnit']});
    const edited=editMassDraft(pack,'kgPerUnit',text);assert.equal(read(edited).kgPerUnit,Number(text));
    assert.equal(sanitiseHarvestTargets([{...base,unit:'bags',weeklyQuantity:3,kgPerUnit:read(edited).kgPerUnit}]).length,0);
  }
});

test('the shared decimal convention accepts leading/comma decimals and never treats pack counts as a mass unit',()=>{
  for(const [text,kg]of [['.5',0.226796185],[',5',0.226796185],['+.5',0.226796185],['+1,25',0.5669904625]]as const) assert.equal(read(editMassDraft(draft('lb'),'weeklyKg',text)).weeklyKg,kg);
  for(const invalid of ['oz','troy-lb','lbf','fl-oz','g','ft','in','m2','bunches','']) {
    assert.equal(massToKilograms(1,invalid as MassUnit),null);assert.equal(kilogramsToMass(1,invalid as MassUnit),null);
    const current=draft();assert.equal(switchMassDraftUnit(current,invalid as MassUnit,sourceKey).draft,current);
  }
  assert.equal(lengthToMetres(1,'lb' as LengthUnit),null);assert.equal(nurseryDimensionToCanonical(1,'lb' as NurseryDimensionUnit),null);
});

test('nonzero range limits cannot become an accepted zero or Infinity and display never rounds tiny canonical mass to zero',()=>{
  assert.equal(massToKilograms(Number.MIN_VALUE,'lb'),null);assert.equal(kilogramsToMass(Number.MAX_VALUE,'lb'),null);
  for(const n of [Infinity,-Infinity,NaN]) {assert.equal(massToKilograms(n,'kg'),null);assert.equal(kilogramsToMass(n,'lb'),null);}
  const tiny=formatMassKilograms(Number.MIN_VALUE,'kg');assert.ok(tiny);assert.notEqual(Number(tiny),0);
  const parsed=editMassDraft(draft(),'weeklyKg',`0.${'0'.repeat(400)}1`);assert.equal(readMassDraft(parsed,sourceKey).status,'held');
  const huge=draft('kg',Number.MAX_VALUE);assert.equal(switchMassDraftUnit(huge,'lb',sourceKey).draft,huge);assert.equal(read(huge).weeklyKg,Number.MAX_VALUE);
  assert.equal(sanitiseHarvestTargets([target(Number.MAX_VALUE)]).length,0,'schema still owns aggregate range');
});

test('source, family, optional field and per-field unit damage hold instead of relabelling another dimension',()=>{
  const value=draft();assert.equal(readMassDraft(value,'another-actor/source').status,'held');assert.equal(switchMassDraftUnit(value,'lb','another-source').draft,value);
  const mixed={...value,fields:{weeklyKg:{...value.fields.weeklyKg,inputUnit:'lb' as const}}};assert.equal(readMassDraft(mixed,sourceKey).status,'held');
  const missing={...value,fields:{}}as MassDraft<'weeklyKg'>;assert.equal(readMassDraft(missing,sourceKey).status,'held');
  const nonfinite={...value,fields:{weeklyKg:{...value.fields.weeklyKg,status:'ready' as const,canonicalValue:Infinity}}};assert.equal(readMassDraft(nonfinite,sourceKey).status,'held');
  const extraOptional={...value,optionalFields:['absent']}as unknown as MassDraft<'weeklyKg'>;assert.equal(readMassDraft(extraOptional,sourceKey).status,'held');
  const duplicateOptional={...value,optionalFields:['weeklyKg','weeklyKg']}as MassDraft<'weeklyKg'>;assert.equal(readMassDraft(duplicateOptional,sourceKey).status,'held');
  const nursery=createNurseryDimensionDraft({sourceKey,unit:'cm',values:{weeklyKg:1}});assert.equal(readMassDraft(nursery as unknown as MassDraft<'weeklyKg'>,sourceKey).status,'held');
  const wrongKind={...value,kind:'tray-length'}as unknown as MassDraft<'weeklyKg'>;assert.equal(readMassDraft(wrongKind,sourceKey).status,'held');
});

test('snapshots are detached and immutable, and absent saleable share is never supplied by unit conversion',()=>{
  const input={weeklyKg:4.535923700000001},value=createMassDraft({sourceKey,unit:'lb',kilograms:input});input.weeklyKg=1;
  assert.equal(read(value).weeklyKg,4.535923700000001);assert.equal(value.originalKilograms,value.originalCanonical);
  assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.originalKilograms));assert.ok(Object.isFrozen(value.fields.weeklyKg));
  const {marketablePercent:_percent,...without}=target(read(value).weeklyKg!);
  assert.deepEqual(growerDemandFromHarvestTarget({target:without,profile,scope,recordedAt}),{status:'held',reasons:['saleable-share-missing']});
});


test('independently entered 4.5359237 kilograms and ten pounds need the same single real own cycle and capacity count', async()=>{
  const fixture=await import('./international-grower-operations-fixture.ts');
  try {
    const {row,source}=await fixture.ownRow();
    const originalProfile=row.growerCycle.assessmentSnapshot.profile;
    // Synthetic boundary: the real 8m² source bed yields exactly this month's demand.
    const profile={...originalProfile,inputs:{...originalProfile.inputs,
      allowedEntryMonths:own([2],'utc-months'),yieldKgPerM2:own(2.3489604875,'kg/m2/cycle')}};
    const metricWeeklyKg=Number('4.5359237'); // Independent metric entry; no converter-derived oracle.
    const blankPounds=createMassDraft({sourceKey,unit:'lb',kilograms:{weeklyKg:undefined}});
    const imperialWeeklyKg=read(editMassDraft(blankPounds,'weeklyKg','10')).weeklyKg!;
    const evaluate=(weeklyKg:number,expectedDemand=18.7916839,expectedCycles=1,expectedPositions=8)=>{
      const input={...base,siteId:source.resourceSiteId,weeklyKg,marketablePercent:100};
      const demand=targetDemand(input);assert.deepEqual(demand,{days:29,demandKg:expectedDemand});
      const adapted=growerDemandFromHarvestTarget({target:input,profile,scope:source.scope,source,recordedAt});
      assert.equal(adapted.status,'ready');if(adapted.status!=='ready')throw Error('Fixture demand held');
      const request:GrowerAutoPlanRequest={requestedAt:recordedAt,scope:source.scope,geometryFingerprint:source.geometryFingerprint,profiles:[profile],
        beds:source.beds.map(bed=>({bed,scope:source.scope,measuredAreaM2:own(bed.areaM2,'m2')})),
        planningStart:own('2028-02-01','utc-date'),planningEndExclusive:own('2028-03-01','utc-date'),
        availability:source.beds.map(bed=>({bedId:bed.id,scope:source.scope,window:own({start:'2028-02-01',endExclusive:'2028-03-01'},'utc-date-window')})),
        reserved:[],demands:[adapted.demand],maxAssessments:1000};
      const plan=generateGrowerAutoPlan(request);assert.equal(plan.status,'ready');assert.equal(plan.cycles.length,expectedCycles);
      assert.equal(plan.cycles[0].assessment.capacity.estimatedYieldKg,18.7916839);
      assert.equal(plan.cycles.reduce((n,cycle)=>n+cycle.assessment.capacity.estimatedPlantCount,0),expectedPositions);
      assert.equal(nurseryCeilRatio([adapted.grossCapacityRequiredKg],[18.7916839]),expectedCycles);
      return {demand,adapted,plan};
    };
    assert.equal(imperialWeeklyKg,metricWeeklyKg);
    assert.deepEqual(evaluate(imperialWeeklyKg),evaluate(metricWeeklyKg));
    // Existing measured precision remains evidence, even when the lb display is 10.
    const retained=draft('lb',4.535923700000001);
    assert.equal(editMassDraft(retained,'weeklyKg','10'),retained);
    assert.equal(read(retained).weeklyKg,4.535923700000001);
    evaluate(read(retained).weeklyKg!,18.791683900000002,2,16);
    // The original extra multiplication ULP exceeds a whole-cycle/ceil boundary.
    assert.notEqual(10*0.45359237,metricWeeklyKg);
    assert.equal(nurseryCeilRatio([targetDemand({...base,weeklyKg:10*0.45359237,marketablePercent:100})!.demandKg!],[18.7916839]),2);
  } finally {fixture.cleanup();}
});

test('decimal pound conversion preserves signed finite semantics without making tiny nonzero quantities zero',()=>{
  assert.equal(massToKilograms(-10,'lb'),-4.5359237);
  assert.equal(Object.is(massToKilograms(-0,'lb'),-0),true);
  assert.equal(Object.is(massToKilograms(-0,'kg'),-0),true);
  assert.equal(massToKilograms(-Number.MIN_VALUE,'lb'),null);
  assert.equal(massToKilograms(Number.MIN_VALUE,'lb'),null);
});
