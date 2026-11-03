import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState, buildDemoFacilitatorState } from '../lib/demo-farm.ts';
import { sanitiseNurserySettings, type NurserySettings } from '../lib/nursery-settings.ts';
import { loadCropPlan, saveCropPlan } from '../lib/crop-plan.ts';
import { bindMountedAccountLocalStorageUid } from '../lib/account-local-storage.ts';
import { nurseryPeak } from '../lib/crop-export-schedule.ts';
import { decimalQuantityProduct } from '../lib/farm-records.ts';
import { buildGrowerNurseryCsv } from '../lib/nursery-export.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { assessGrowerPlanning, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { buildGrowerNurseryForecast, isGrowerNurseryForecastCurrent, nurserySettingsFingerprint,
  type GrowerNurseryRequest, type GrowerNurseryResourceWindow } from '../lib/international/grower-nursery.ts';

// Synthetic engineering values, not farming recommendations or actual farm data.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T,U extends string>(value:T,unit:U):Extract<GrowerInput<T,U>,{state:'provided'}> => ({state:'provided',value,unit,provenance:{kind:'grower-estimate',recordedAt:stamp}});
const missing = {state:'missing',reason:'not-entered'} as const;
const crop = CROPS.find(row=>!row.transplant)!;
function reviewed(request:GrowerNurseryRequest, settings:NurserySettings):GrowerNurseryRequest {
  const fingerprint=nurserySettingsFingerprint(settings);assert.ok(fingerprint);
  return {...request,settings,settingsReview:own(fingerprint,'nursery-settings-fingerprint')};
}
function repropose(request:GrowerNurseryRequest,currentRequest:GrowerAutoPlanRequest):GrowerNurseryRequest {
  const proposal=generateGrowerAutoPlan(currentRequest);assert.ok(proposal.status==='ready'||proposal.status==='with-gaps',proposal.issues.join(','));
  return {...request,source:{...(request.source.kind === 'proposal' ? request.source : {}),kind:'proposal',proposal,currentRequest}};
}
async function fixture(cloud=false) {
  const siteId='site:0.00000,0.00000';
  const canvas=buildDemoDesignCanvasState();canvas.siteId=siteId;canvas.frame.centerLat=0;canvas.frame.centerLng=0;
  canvas.items=[{...canvas.items.find(row=>row.defId==='veg_bed')!,id:'nursery-bed',wM:3,hM:4}];canvas.lines=[];canvas.zones=[];
  const design=buildDemoFacilitatorState();design.designId='nursery-cloud';design.bgSite={name:'Synthetic scope',lat:0,lon:0};
  design.items=[{...design.items.find(row=>row.type==='bed')!,id:'nursery-bed',wM:3,hM:4}];design.lines=[];design.sectors=[];
  const inspection=cloud?inspectGrowerWorkflowSource({kind:'facilitator-cloud',sourceId:design.designId,raw:{id:design.designId,owner_id:'fixture-owner',data:design},sourceRevision:'synthetic-cloud-receipt'})
    :inspectGrowerWorkflowSource({kind:'studio-canvas',sourceId:siteId,raw:canvas,sourceRevision:'synthetic-studio-receipt'});
  const resourceContext=await fingerprintGrowerWorkflowSource(inspection);assert.equal(resourceContext.status,'ready');if(resourceContext.status!=='ready')throw Error('fixture source');
  const scope=resourceContext.scope;
  const profile:GrowerPlanningProfile={version:1,profileId:'raising-profile',cropKey:crop.key,scope,inputs:{
    plantsPerM2:own(4,'plants/m2'),yieldKgPerM2:own(1,'kg/m2/cycle'),establishment:own('transplant','method'),nurseryDays:own(10,'days'),
    fieldEntryToFirstHarvestDays:own(1,'days'),pickingDays:own(2,'days'),fieldOccupancyDays:own(3,'days'),turnaroundDays:own(1,'days'),allowedEntryMonths:own([2],'utc-months')}};
  const currentRequest:GrowerAutoPlanRequest={requestedAt:stamp,scope,geometryFingerprint:resourceContext.geometryFingerprint,profiles:[profile],
    beds:resourceContext.beds.map(bed=>({bed,scope,measuredAreaM2:own(bed.areaM2,'m2')})),
    planningStart:own('2028-02-01','utc-date'),planningEndExclusive:own('2028-03-15','utc-date'),
    availability:resourceContext.beds.map(bed=>({bedId:bed.id,scope,window:own({start:'2028-02-01',endExclusive:'2028-03-15'},'utc-date-window')})),reserved:[],
    demands:[{demandId:'nursery-demand',profileId:profile.profileId,scope,totalKg:own(1,'kg-total'),harvestWindow:own({start:'2028-02-20',endExclusive:'2028-02-22'},'utc-date-window')}],maxAssessments:1000};
  const proposal=generateGrowerAutoPlan(currentRequest);assert.equal(proposal.status,'ready');assert.equal(proposal.cycles.length,1);
  const namespace=resourceContext.resourceSiteId;
  const settings:NurserySettings={version:1,containers:[{id:'tray',siteId:namespace,name:'Fixture trays',cells:40,widthCm:50,lengthCm:40,owned:5}],
    spaces:[{id:'bench',siteId:namespace,name:'Fixture bench',usableM2:2}],profiles:[{id:'recipe',siteId:namespace,cropKey:crop.key,model:'seed-cell',containerId:'tray',spaceId:'bench',
      fieldSurvivalPercent:80,germinationPercent:50,nurserySurvivalPercent:75}]};
  const windows:GrowerNurseryResourceWindow[]=[{resourceKind:'container',resourceId:'tray',scope,window:{start:'2028-02-01',endExclusive:'2028-03-15'},quantity:5},
    {resourceKind:'space',resourceId:'bench',scope,window:{start:'2028-02-01',endExclusive:'2028-03-15'},quantity:2}];
  // The synthetic proposal's companion saved book is empty, independently of
  // the user's separate assertion about other physical nursery uses.
  const request:GrowerNurseryRequest={source:{kind:'proposal',proposal,currentRequest,competingDemand:'assessed-none'},resourceContext,settings,
    settingsReview:own(nurserySettingsFingerprint(settings)!,'nursery-settings-fingerprint'),horizon:own({start:'2028-02-01',endExclusive:'2028-03-15'},'utc-date-window'),
    availability:own(windows,'nursery-resource-windows'),otherReservations:own([],'nursery-resource-reservations')};
  return {request,currentRequest,profile,proposal,settings,windows,resourceContext};
}

test('a real current proposal sizes its own contrary-method transplants without catalogue agronomy or fabricated acceptance',async()=>{
  const {request}=await fixture();const originals=new Map<string,PropertyDescriptor|undefined>();
  for(const key of ['transplant','daysToHarvest','yieldKgPerM2','rowSpacingCm','seedRateKgPerHaRange']){originals.set(key,Object.getOwnPropertyDescriptor(crop,key));Object.defineProperty(crop,key,{configurable:true,get(){throw Error('Catalogue agronomy read');}});}
  try{const result=buildGrowerNurseryForecast(request);assert.equal(result.status,'ready',result.issues.join(','));assert.equal(result.headroom,'within-budget');
    const row=result.batches[0];assert.equal(row.sourceStatus,'proposed');assert.deepEqual(row.plantingIds,[]);assert.equal(row.targetPositions,48);
    assert.equal(row.starts,60);assert.equal(row.seeds,160);assert.equal(row.trays,4);assert.equal(row.areaM2,0.8);
    assert.equal(row.startDate,'2028-02-09');assert.equal(row.endDateExclusive,'2028-02-19');assert.doesNotMatch(JSON.stringify(result.snapshot?.source),/acceptedAt|confirmedOnceSowing/);
  }finally{for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(crop,key,descriptor);else Reflect.deleteProperty(crop,key);}}
});

test('missing and zero survival stay distinct and neither becomes an implicit success rate',async()=>{
  const {request,settings}=await fixture();
  for(const value of [undefined,0]){const changed=structuredClone(settings);changed.profiles[0].fieldSurvivalPercent=value;
    const result=buildGrowerNurseryForecast(reviewed(request,changed));assert.equal(result.status,'partial');assert.equal(result.headroom,'unknown');assert.equal(result.batches[0].starts,null);
    assert.ok(result.batches[0].issues.includes(value===0?'field-survival-zero':'field-survival-missing'));}
  const changed=structuredClone(settings);changed.profiles[0].germinationPercent=0;
  assert.ok(buildGrowerNurseryForecast(reviewed(request,changed)).batches[0].issues.includes('germination-or-nursery-survival-zero'));
});

test('measured-output flats need no invented cells and do not apply nursery losses a second time',async()=>{
  const {request,settings}=await fixture();const changed=structuredClone(settings);delete changed.containers[0].cells;
  changed.profiles[0]={...changed.profiles[0],model:'measured-tray',usableStartsPerTray:20,seedsPerTray:0,germinationPercent:0,nurserySurvivalPercent:0};
  const result=buildGrowerNurseryForecast(reviewed(request,changed));assert.equal(result.status,'ready',result.issues.join(','));
  assert.equal(result.batches[0].starts,60);assert.equal(result.batches[0].trays,3);assert.equal(result.batches[0].seeds,0);
  assert.equal(result.snapshot?.settings.containers[0].cells,undefined);
  changed.profiles[0].usableStartsPerTray=0;const zero=buildGrowerNurseryForecast(reviewed(request,changed));
  assert.equal(zero.batches[0].trays,null);assert.ok(zero.batches[0].issues.includes('measured-tray-output-zero'));
  assert.equal(zero.snapshot?.settings.profiles[0].usableStartsPerTray,0);
  delete changed.profiles[0].usableStartsPerTray;assert.ok(buildGrowerNurseryForecast(reviewed(request,changed)).batches[0].issues.includes('measured-tray-output-missing'));
});

test('unknown seed purchases do not erase known measured tray and surface budgets', async () => {
  const { request, settings } = await fixture();
  const changed = structuredClone(settings);
  changed.profiles[0] = { ...changed.profiles[0], model: 'measured-tray', usableStartsPerTray: 20 };
  delete changed.profiles[0].seedsPerTray;
  let result = buildGrowerNurseryForecast(reviewed(request, changed));
  assert.equal(result.status, 'partial');
  assert.equal(result.batches[0].seeds, null);
  assert.equal(result.batches[0].trays, 3);
  assert.equal(result.resources.find(row => row.resourceKind === 'container')?.headroom, 'within-budget');
  assert.equal(result.resources.find(row => row.resourceKind === 'space')?.headroom, 'within-budget');
  assert.equal(result.headroom, 'within-budget', 'this clearance covers assigned tray/surface resources only, not missing seed purchases');
  delete changed.containers[0].widthCm;
  result = buildGrowerNurseryForecast(reviewed(request, changed));
  assert.equal(result.batches[0].trays, 3);
  assert.equal(result.batches[0].areaM2, null);
  assert.equal(result.resources.find(row => row.resourceKind === 'container')?.headroom, 'within-budget');
  assert.equal(result.resources.find(row => row.resourceKind === 'space')?.headroom, 'unknown');
  assert.equal(result.headroom, 'unknown', 'a missing required bench footprint still prevents overall resource clearance');
});

test('known zero stock and surface produce shortages while unknown stock cannot certify capacity',async()=>{
  const {request,settings,windows}=await fixture();const changed=structuredClone(settings);changed.containers[0].owned=0;changed.spaces[0].usableM2=0;
  const req={...reviewed(request,changed),availability:own(windows.map(row=>({...row,quantity:0})),'nursery-resource-windows')};
  const result=buildGrowerNurseryForecast(req);assert.equal(result.status,'ready');assert.equal(result.headroom,'shortage');
  assert.equal(result.resources.find(row=>row.resourceKind==='container')?.shortage,4);assert.equal(result.resources.find(row=>row.resourceKind==='space')?.shortage,0.8);
  const unknownStock=structuredClone(settings);delete unknownStock.containers[0].owned;
  const unknown=buildGrowerNurseryForecast(reviewed(request,unknownStock));assert.equal(unknown.headroom,'unknown');
  assert.equal(unknown.resources.find(row=>row.resourceKind==='container')?.capacity,null);
});

test('missing geometry, stale proposal and changed resource namespace cannot authorize a nursery budget',async()=>{
  const {request,currentRequest}=await fixture();
  const altered={...currentRequest,geometryFingerprint:'changed-source'};
  assert.equal(buildGrowerNurseryForecast({...request,source:{...request.source,kind:'proposal',proposal:request.source.kind==='proposal'?request.source.proposal:generateGrowerAutoPlan(altered),currentRequest:altered}}).status,'stale-source');
  assert.equal(buildGrowerNurseryForecast({...request,resourceContext:null}).status,'stale-source');
  assert.equal(buildGrowerNurseryForecast({...request,resourceContext:{...request.resourceContext!,resourceSiteId:'design:another'}}).status,'stale-source');
  assert.equal(buildGrowerNurseryForecast({...request,resourceContext:{...request.resourceContext!,geometryFingerprint:'0'.repeat(64)}}).status,'stale-source');
});

test('cloud equipment follows the actual design namespace while mapped grower scope remains independent',async()=>{
  const {request,resourceContext}=await fixture(true);assert.equal(resourceContext.resourceSiteId,'design:nursery-cloud');
  assert.equal(buildGrowerNurseryForecast(request).status,'ready');
  const wrong=structuredClone(request.settings) as NurserySettings;wrong.profiles[0].siteId=resourceContext.scope.kind==='mapped-site'?resourceContext.scope.siteId:'virtual-bed';
  const result=buildGrowerNurseryForecast(reviewed(request,wrong));assert.equal(result.headroom,'unknown');assert.ok(result.batches[0].issues.includes('nursery-recipe-missing'));
});

test('duplicate canonical resources and crop recipes reject all winners and retain sticky source issues across parsing',async()=>{
  const {request,settings}=await fixture();const duplicate=structuredClone(settings);duplicate.containers.push({...duplicate.containers[0],owned:999});
  assert.equal(nurserySettingsFingerprint(duplicate),null);assert.equal(buildGrowerNurseryForecast({...request,settings:duplicate}).status,'invalid-inputs');
  const canonical=sanitiseNurserySettings(duplicate);assert.deepEqual(canonical.containers,[]);assert.ok(canonical.sourceIssues?.includes('ambiguous-nursery-container-identities'));
  assert.deepEqual(sanitiseNurserySettings(JSON.parse(JSON.stringify(canonical))),canonical);
  const window=request.availability.state==='provided'?request.availability.value.filter(row=>row.resourceKind!=='container'):[];
  const result=buildGrowerNurseryForecast({...reviewed(request,canonical),availability:own(window,'nursery-resource-windows')});
  assert.equal(result.headroom,'unknown');assert.ok(result.issues.includes('ambiguous-nursery-container-identities'));
  const recipes=structuredClone(settings);recipes.profiles.push({...recipes.profiles[0],id:'another-recipe'});
  const parsed=sanitiseNurserySettings(recipes);assert.deepEqual(parsed.profiles,[]);assert.ok(parsed.sourceIssues?.includes('ambiguous-nursery-recipe-identities'));
});

test('ambiguous inventory preserves exact held input claims without multiplying or using them as capacity', async () => {
  const { settings } = await fixture();
  const duplicate = structuredClone(settings);
  duplicate.containers.push({ ...duplicate.containers[0] });
  const originals = JSON.stringify(duplicate.containers);
  const parsed = sanitiseNurserySettings(duplicate);
  assert.deepEqual(parsed.containers, []);
  assert.equal(parsed.heldInputs?.length, 1);
  assert.equal(parsed.heldInputs?.[0].collection, 'containers');
  assert.equal(JSON.stringify(parsed.heldInputs?.[0].rows), originals, 'identical duplicate occurrences remain separate evidence');
  assert.deepEqual(sanitiseNurserySettings(parsed), parsed, 'a normal repeated read must not append the same captured input group');
  const stripped = { ...parsed, sourceIssues: undefined };
  assert.ok(sanitiseNurserySettings(stripped).sourceIssues?.includes('nursery-held-inputs-unresolved'));
  duplicate.containers[0].owned = 1;
  assert.equal(JSON.stringify(parsed.heldInputs?.[0].rows), originals, 'held data is detached from the caller');
  const unknownGroup = { collection: 'unrecognised-collection', reason: 'unrecognised-review-reason', rows: [settings.containers[0]] };
  const retained = sanitiseNurserySettings({ ...settings, heldInputs: [unknownGroup] });
  assert.deepEqual(retained.heldInputs?.[0].rows, [unknownGroup], 'JSON-safe unrecognised held metadata remains evidence rather than being erased');
  assert.deepEqual(sanitiseNurserySettings(retained), retained);
  const spaces = [settings.spaces[0], { ...settings.spaces[0], siteId: 'design:synthetic-other-site', usableM2: 0 }];
  const heldSpaces = sanitiseNurserySettings({ ...settings, spaces });
  assert.equal(JSON.stringify(heldSpaces.heldInputs?.find(group => group.collection === 'spaces')?.rows), JSON.stringify(spaces));
  const profiles = [settings.profiles[0], { ...settings.profiles[0], id: 'contradictory-recipe', fieldSurvivalPercent: 0 }];
  const heldProfiles = sanitiseNurserySettings({ ...settings, profiles });
  assert.equal(JSON.stringify(heldProfiles.heldInputs?.find(group => group.collection === 'profiles')?.rows), JSON.stringify(profiles));
});

test('unreadable held claims become durable sentinels without invoking accessors or persisting executable values', async () => {
  const { settings } = await fixture();
  let accesses = 0;
  const accessor = { ...settings.containers[0] };
  Object.defineProperty(accessor, 'owned', { enumerable: true, get() { accesses++; return 999; } });
  const cyclic: Record<string, unknown> = { id: 'cyclic-held-claim' }; cyclic.self = cyclic;
  const accessorRows: unknown[] = [settings.containers[0]];
  Object.defineProperty(accessorRows, 1, { enumerable: true, get() { accesses++; return accessor; } });
  const heldWrapper = { collection: 'containers', reason: 'ambiguous-identities' };
  Object.defineProperty(heldWrapper, 'rows', { enumerable: true, get() { accesses++; return [accessor]; } });
  const cases = [
    { ...settings, heldInputs: [{ collection: 'containers', reason: 'ambiguous-identities', rows: [accessor, cyclic, () => 999] }] },
    { ...settings, heldInputs: [heldWrapper] },
    { ...settings, heldInputs: [{ collection: 'containers', reason: 'ambiguous-identities', rows: accessorRows }] },
    { ...settings, containers: [accessor] },
  ];
  for (const value of cases) {
    const parsed = sanitiseNurserySettings(value);
    assert.ok(parsed.sourceIssues?.includes('nursery-held-input-unreadable'));
    assert.ok(parsed.heldInputs?.length);
    const bytes = JSON.stringify(parsed);
    assert.match(bytes, /unreadable-nursery-input/);
    assert.doesNotMatch(bytes, /999|cyclic-held-claim/);
    assert.deepEqual(sanitiseNurserySettings(JSON.parse(bytes)), parsed);
  }
  const partial = sanitiseNurserySettings(cases[2]);
  assert.deepEqual(partial.heldInputs?.[0].rows[0], settings.containers[0], 'an unreadable neighbour must not erase a separate JSON-safe row');
  assert.equal(accesses, 0);
});

test('missing footprints and unassigned bench space remain explicit without borrowing other space',async()=>{
  const {request,settings,windows}=await fixture();const changed=structuredClone(settings);delete changed.containers[0].lengthCm;
  let result=buildGrowerNurseryForecast(reviewed(request,changed));assert.equal(result.batches[0].trays,4);assert.equal(result.batches[0].areaM2,null);
  assert.equal(result.headroom,'unknown');assert.ok(result.batches[0].issues.includes('container-footprint-missing'));
  delete changed.profiles[0].spaceId;result=buildGrowerNurseryForecast(reviewed(request,changed));assert.ok(result.batches[0].issues.includes('nursery-space-missing'));
  changed.spaces=[];result=buildGrowerNurseryForecast({...reviewed(request,changed),availability:own(windows.filter(row=>row.resourceKind==='container'),'nursery-resource-windows')});
  assert.equal(result.batches[0].spaceId,undefined);assert.equal(result.headroom,'unknown');
});

test('touching exact nursery intervals reuse stock, while concurrent raising for successive field cycles requires peak stock',async()=>{
  const {request,currentRequest}=await fixture();const first=currentRequest.demands[0];
  const touching={...currentRequest,demands:[first,{...first,demandId:'later-demand',harvestWindow:own({start:'2028-03-01',endExclusive:'2028-03-03'},'utc-date-window')}]};
  const adjacent=buildGrowerNurseryForecast(repropose(request,touching));assert.equal(adjacent.batches.length,2);assert.equal(adjacent.batches[0].endDateExclusive,adjacent.batches[1].startDate);
  assert.deepEqual(adjacent.forecast.peakTrays,[4,4]);assert.deepEqual(adjacent.forecast.cumulativeTrayUses,[8,8]);
  const overlapping={...currentRequest,demands:[{...first,totalKg:own(13,'kg-total'),harvestWindow:own({start:'2028-02-20',endExclusive:'2028-03-10'},'utc-date-window')}]};
  const concurrent=buildGrowerNurseryForecast(repropose(request,overlapping));assert.equal(concurrent.batches.length,2);
  assert.deepEqual(concurrent.forecast.peakTrays,[8,8]);assert.equal(concurrent.resources.find(row=>row.resourceKind==='container')?.shortage,3);
});

test('availability gaps and missing other-use assertions never act as zero reservations or spare capacity',async()=>{
  const {request,windows}=await fixture();
  assert.equal(buildGrowerNurseryForecast({...request,availability:missing}).headroom,'unknown');
  assert.equal(buildGrowerNurseryForecast({...request,otherReservations:missing}).headroom,'unknown');
  const gapped=windows.flatMap(row=>[{...row,window:{start:'2028-02-01',endExclusive:'2028-02-12'}},{...row,window:{start:'2028-02-13',endExclusive:'2028-03-15'}}]);
  const result=buildGrowerNurseryForecast({...request,availability:own(gapped,'nursery-resource-windows')});assert.equal(result.headroom,'unknown');assert.ok(result.resources.every(row=>!row.availabilityComplete));
  const external={...windows[0],id:'other-trays',quantity:2,window:{start:'2028-02-10',endExclusive:'2028-02-11'}};
  const crowded=buildGrowerNurseryForecast({...request,otherReservations:own([external],'nursery-resource-reservations')});assert.equal(crowded.resources[0].shortage,1);
});

test('known field reservations require their exact explicit nursery-accounting acknowledgement',async()=>{
  const {request,currentRequest}=await fixture();const reserved={id:'existing-field-use',bedId:currentRequest.beds[0].bed.id,scope:currentRequest.scope,
    window:own({start:'2028-02-01',endExclusive:'2028-02-02'},'utc-date-window')};
  const pending=repropose(request,{...currentRequest,reserved:[reserved]});
  assert.ok(buildGrowerNurseryForecast(pending).issues.includes('existing-field-reservations-not-accounted-for'));
  assert.equal(buildGrowerNurseryForecast({...pending,accountedFieldReservations:own(['wrong'],'nursery-accounted-field-reservations')}).headroom,'unknown');
  assert.equal(buildGrowerNurseryForecast({...pending,accountedFieldReservations:own([reserved.id],'nursery-accounted-field-reservations')}).headroom,'within-budget');
});

test('saved own cycles use the real projection and held or legacy competing work remains unknown',async()=>{
  const {request,proposal,resourceContext}=await fixture();const row=createGrowerCyclePlanting(proposal.cycles[0],{plantingId:'saved-cycle',acceptedAt:stamp,geometryFingerprint:resourceContext.geometryFingerprint});assert.ok(row);
  const source={kind:'saved-cycles',rows:[row],cycleContext:{scope:resourceContext.scope,beds:resourceContext.beds,geometryFingerprint:resourceContext.geometryFingerprint}} as const;
  const saved=buildGrowerNurseryForecast({...request,source});assert.equal(saved.status,'ready');assert.equal(saved.sourceStatus,'saved-planned');assert.deepEqual(saved.batches[0].plantingIds,[row.id]);
  for(const extra of [{id:'legacy',bedId:row.bedId,cropKey:row.cropKey,sowMonth:1},{id:'held',growerCycle:undefined}]){
    const result=buildGrowerNurseryForecast({...request,source:{...source,rows:[row,extra]}});assert.equal(result.headroom,'unknown');assert.equal(result.status,'partial');
  }
});

test('zero cells stay recorded and unusable in seed-cell mode; duration conflicts never move the own field date',async()=>{
  const {request,settings}=await fixture();const changed=structuredClone(settings);changed.containers[0].cells=0;
  let result=buildGrowerNurseryForecast(reviewed(request,changed));assert.equal(result.snapshot?.settings.containers[0].cells,0);assert.ok(result.batches[0].issues.includes('container-cells-zero'));assert.equal(result.batches[0].trays,null);
  changed.containers[0].cells=40;changed.profiles[0].nurseryWeeks=3;result=buildGrowerNurseryForecast(reviewed(request,changed));assert.ok(result.batches[0].issues.includes('recipe-duration-conflicts-with-cycle'));
  assert.equal(result.batches[0].startDate,'2028-02-09');assert.equal(result.batches[0].endDateExclusive,'2028-02-19');
});

test('zero target demand remains zero and zero-duration raising stays visibly unresolved without invented days',async()=>{
  const {request,currentRequest,proposal,resourceContext}=await fixture();
  const old=proposal.cycles[0].assessment.snapshot;
  const profile={...old.profile,inputs:{...old.profile.inputs,plantsPerM2:own(0.001,'plants/m2')}};
  const assessment=assessGrowerPlanning({...old,profile});assert.equal(assessment.status,'ready');if(assessment.status!=='ready')return;
  const row=createGrowerCyclePlanting({...proposal.cycles[0],assessment},{plantingId:'zero-target-record',acceptedAt:stamp,geometryFingerprint:resourceContext.geometryFingerprint});assert.ok(row);
  const zero=buildGrowerNurseryForecast({...request,source:{kind:'saved-cycles',rows:[row],cycleContext:{scope:resourceContext.scope,beds:resourceContext.beds,geometryFingerprint:resourceContext.geometryFingerprint}}});
  assert.equal(zero.batches[0].targetPositions,0);assert.equal(zero.batches[0].starts,0);assert.equal(zero.batches[0].seeds,0);assert.equal(zero.batches[0].trays,0);assert.equal(zero.batches[0].areaM2,0);
  const durationProfile={...currentRequest.profiles[0],inputs:{...currentRequest.profiles[0].inputs,nurseryDays:own(0,'days')}};
  const instantaneous=buildGrowerNurseryForecast(repropose(request,{...currentRequest,profiles:[durationProfile]}));
  assert.equal(instantaneous.batches[0].startDate,instantaneous.batches[0].endDateExclusive);assert.equal(instantaneous.headroom,'unknown');
  assert.ok(instantaneous.batches[0].issues.includes('positive-target-zero-nursery-interval'));
});

test('forged proposal output is ignored in favor of freshly regenerated actual cycle assessments',async()=>{
  const {request,currentRequest,proposal}=await fixture();const forged=structuredClone(proposal);
  if(forged.status!=='ready'&&forged.status!=='with-gaps')throw Error('fixture proposal');
  const cycles=forged.cycles as unknown as {assessment:{capacity:{estimatedPlantCount:number}}}[];
  cycles[0].assessment.capacity.estimatedPlantCount=999;
  const result=buildGrowerNurseryForecast({...request,source:{kind:'proposal',proposal:forged,currentRequest,competingDemand:'assessed-none'}});
  assert.equal(result.batches[0].targetPositions,48);assert.equal(result.batches[0].sourceStatus,'proposed');
});

test('known unresolved saved work cannot be waived by an empty physical nursery reservation list', async () => {
  const { request } = await fixture();
  if (request.source.kind !== 'proposal') throw Error('fixture source');
  for (const competingDemand of [undefined, 'unresolved'] as const) {
    const result = buildGrowerNurseryForecast({ ...request, source: { ...request.source, competingDemand } });
    assert.equal(result.status, 'partial');
    assert.equal(result.headroom, 'unknown');
    assert.ok(result.resources.every(resource => resource.headroom !== 'within-budget'));
    assert.ok(result.issues.includes(competingDemand === 'unresolved'
      ? 'competing-nursery-demand-unresolved' : 'competing-nursery-demand-review-missing'));
  }
  const reviewed = buildGrowerNurseryForecast(request);
  assert.equal(reviewed.headroom, 'within-budget');
  assert.equal(isGrowerNurseryForecastCurrent(reviewed, { ...request, source: { ...request.source, competingDemand: 'unresolved' } }), false);
});

test('decimal ceiling boundaries reuse the shared nursery arithmetic and overflow never becomes a number',async()=>{
  const {request,currentRequest,settings}=await fixture();const profile=currentRequest.profiles[0];
  const changedProfile={...profile,inputs:{...profile.inputs,plantsPerM2:own(4.75,'plants/m2')}};
  const settings2=structuredClone(settings);Object.assign(settings2.profiles[0],{fieldSurvivalPercent:100,germinationPercent:28.5,nurserySurvivalPercent:100});settings2.containers[0].cells=200;
  const result=buildGrowerNurseryForecast(reviewed(repropose(request,{...currentRequest,profiles:[changedProfile]}),settings2));assert.equal(result.batches[0].seeds,200);assert.equal(result.batches[0].trays,1);
  settings2.profiles[0].germinationPercent=Number.MIN_VALUE;const overflow=buildGrowerNurseryForecast(reviewed(request,settings2));assert.equal(overflow.batches[0].seeds,null);assert.equal(overflow.headroom,'unknown');
  assert.doesNotMatch(JSON.stringify(overflow),/Infinity|NaN/);
});

test('exact entered surface allocations do not invent a shortage at a decimal boundary', async () => {
  const { request, settings, windows } = await fixture();
  const changed = structuredClone(settings);
  changed.containers[0].widthCm = 20;
  changed.containers[0].lengthCm = 50;
  changed.spaces[0].usableM2 = 0.3;
  changed.profiles[0] = { ...changed.profiles[0], model: 'measured-tray', usableStartsPerTray: 60, seedsPerTray: 0 };
  const otherUse = { ...windows[1], id: 'other-surface-use', quantity: 0.2,
    window: { start: '2028-02-09', endExclusive: '2028-02-19' } };
  const result = buildGrowerNurseryForecast({ ...reviewed(request, changed),
    availability: own(windows.map(row => row.resourceKind === 'space' ? { ...row, quantity: 0.3 } : row), 'nursery-resource-windows'),
    otherReservations: own([otherUse], 'nursery-resource-reservations') });
  assert.equal(result.batches[0].areaM2, 0.1);
  const space = result.resources.find(row => row.resourceKind === 'space')!;
  assert.deepEqual(space.peak, [0.3, 0.3]);
  assert.equal(space.shortage, 0);
  assert.equal(space.headroom, 'within-budget');
  const genuineExcess = buildGrowerNurseryForecast({ ...reviewed(request, changed),
    availability: own(windows.map(row => row.resourceKind === 'space' ? { ...row, quantity: 0.3 } : row), 'nursery-resource-windows'),
    otherReservations: own([{ ...otherUse, quantity: 0.20000000000000004 }], 'nursery-resource-reservations') });
  assert.equal(genuineExcess.resources.find(row => row.resourceKind === 'space')?.shortage, 4e-17);
  assert.equal(genuineExcess.headroom, 'shortage', 'a tolerance must not discard a positive amount actually entered');
  assert.deepEqual(nurseryPeak([
    { start: 0, end: 1, value: [0.1, 0.1], incomplete: false },
    { start: 0, end: 1, value: [0.2, 0.2], incomplete: false },
    { start: 1, end: 2, value: [0.3, 0.3], incomplete: false },
  ], 0, 2, 0.3), { value: [0.3, 0.3], incomplete: false, shortage: 0 });
  const threeTrays = structuredClone(changed);
  threeTrays.profiles[0].usableStartsPerTray = 20;
  const fullBench = buildGrowerNurseryForecast({ ...reviewed(request, threeTrays),
    availability: own(windows.map(row => row.resourceKind === 'space' ? { ...row, quantity: 0.3 } : row), 'nursery-resource-windows') });
  assert.equal(fullBench.batches[0].trays, 3);
  assert.equal(fullBench.batches[0].areaM2, 0.3, 'multiply entered footprint decimals before the single number conversion');
  assert.equal(fullBench.resources.find(row => row.resourceKind === 'space')?.shortage, 0);
  assert.equal(fullBench.headroom, 'within-budget');
});

test('unrepresentable positive surface products stay unknown rather than becoming zero or infinity', () => {
  assert.equal(decimalQuantityProduct([0.1, 3]), 0.3);
  assert.equal(decimalQuantityProduct([Number.MAX_VALUE, Number.MAX_VALUE]), null);
  assert.equal(decimalQuantityProduct([Number.MIN_VALUE, Number.MIN_VALUE]), null);
  assert.equal(decimalQuantityProduct([0, Number.MIN_VALUE]), 0, 'an explicitly entered zero remains different from underflow');
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(decimalQuantityProduct([1, invalid]), null);
});

test('detached frozen reviews do not freeze or mutate editors, and settings or source edits invalidate export checks',async()=>{
  const {request,settings}=await fixture();const before=JSON.stringify(request);const result=buildGrowerNurseryForecast(request);
  assert.equal(JSON.stringify(request),before);assert.equal(Object.isFrozen(settings),false);assert.equal(Object.isFrozen(settings.profiles[0]),false);assert.equal(Object.isFrozen(result.snapshot?.settings),true);
  assert.equal(isGrowerNurseryForecastCurrent(result,request),true);const changed=structuredClone(settings);changed.containers[0].widthCm=60;
  assert.equal(isGrowerNurseryForecastCurrent(result,reviewed(request,changed)),false);
  const staleReview={...request,settings:changed};assert.ok(buildGrowerNurseryForecast(staleReview).issues.includes('nursery-settings-review-stale'));
  settings.containers[0].owned=0;assert.notEqual(result.snapshot?.settings.containers[0].owned,0);
});

test('an unchanged input fingerprint cannot certify altered nursery quantities or clearance for export', async () => {
  const { request } = await fixture();
  const result = buildGrowerNurseryForecast(request);
  for (const change of [
    (draft: ReturnType<typeof buildGrowerNurseryForecast>) => { (draft.batches[0] as { trays: number }).trays = 999; },
    (draft: ReturnType<typeof buildGrowerNurseryForecast>) => { (draft.resources[0] as { shortage: number }).shortage = 999; },
    (draft: ReturnType<typeof buildGrowerNurseryForecast>) => { (draft as { headroom: string }).headroom = 'shortage'; },
  ]) {
    const altered = structuredClone(result);
    change(altered);
    assert.equal(altered.fingerprint, result.fingerprint);
    assert.equal(isGrowerNurseryForecastCurrent(altered, request), false);
  }
  assert.equal(isGrowerNurseryForecastCurrent(result, request), true);
});

test('canonical device reload and another field edit preserve held inventory bytes and zeros without publishing raw claims',async()=>{
  const {request,settings}=await fixture();const ambiguous=structuredClone(settings);
  const foreign = { ...ambiguous.containers[0], siteId: 'design:synthetic-other-site', widthCm: 61, owned: 999,
    note: 'synthetic-held-inventory-private-marker' };
  ambiguous.containers.push(foreign);
  const inventoryBytes = JSON.stringify(ambiguous.containers);
  ambiguous.profiles[0]={...ambiguous.profiles[0],model:'measured-tray',usableStartsPerTray:0,seedsPerTray:0};
  const original=Object.getOwnPropertyDescriptor(globalThis,'window'),values=new Map<string,string>();
  Object.defineProperty(globalThis,'window',{configurable:true,value:{
    localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)},
    sessionStorage:{getItem:()=>null},dispatchEvent:()=>true,
  }});
  bindMountedAccountLocalStorageUid('synthetic-nursery-owner');
  try{
    assert.equal(saveCropPlan({version:1,plantings:[],nursery:ambiguous,updatedAt:1}),true);
    const first=loadCropPlan().nursery;assert.ok(first);assert.deepEqual(first.containers,[]);
    assert.ok(first.sourceIssues?.includes('ambiguous-nursery-container-identities'));
    assert.equal(first.profiles[0].usableStartsPerTray,0);assert.equal(first.profiles[0].seedsPerTray,0);
    assert.equal(JSON.stringify(first.heldInputs?.find(group => group.collection === 'containers')?.rows), inventoryBytes);
    const opened = loadCropPlan();
    assert.equal(saveCropPlan({...opened,harvestTargets:[],updatedAt:2}),true);
    const reloaded = loadCropPlan().nursery;
    assert.deepEqual(reloaded,first);
    const onlySpace = request.availability.state === 'provided' ? request.availability.value.filter(row => row.resourceKind === 'space') : [];
    const result = buildGrowerNurseryForecast({ ...reviewed(request, reloaded!), availability: own(onlySpace, 'nursery-resource-windows') });
    assert.equal(result.headroom, 'unknown');
    const csv = buildGrowerNurseryCsv(result, request.resourceContext!.beds);
    assert.doesNotMatch(csv, /synthetic-held-inventory-private-marker|synthetic-other-site|999|"61"/);
  }finally{
    bindMountedAccountLocalStorageUid(null);
    if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');
  }
});

test('conflicting allocation windows, foreign scope and claimed stock above equipment cannot certify a budget',async()=>{
  const {request,windows}=await fixture();
  for(const changed of [
    [...windows,windows[0]],
    windows.map(row=>({...row,scope:{kind:'unmapped-workspace' as const,workspaceId:'design:local'}})),
    windows.map(row=>row.resourceKind==='container'?{...row,quantity:6}:row),
    windows.map(row=>row.resourceKind==='container'?{...row,quantity:0.5}:row),
  ]){
    const result=buildGrowerNurseryForecast({...request,availability:own(changed,'nursery-resource-windows')});
    assert.equal(result.status,'invalid-inputs');assert.equal(result.headroom,'unknown');assert.deepEqual(result.batches,[]);
  }
  const unreviewed=buildGrowerNurseryForecast({...request,settingsReview:missing});
  assert.equal(unreviewed.status,'partial');assert.equal(unreviewed.headroom,'unknown');
  assert.ok(unreviewed.issues.includes('nursery-settings-review-missing'));
});
