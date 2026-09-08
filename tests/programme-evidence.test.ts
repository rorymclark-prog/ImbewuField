import test from 'node:test';
import assert from 'node:assert/strict';
import { completeSampleEvidence, freshEvidenceData, trainingTotals, milestoneAt, publishedTraining, validTrainingRecord, validProgrammeMilestone, validProgrammeBranding, validEvidenceImage, trainingForStorage, trainingFromStorage, sharedTrainingPhotos, trainingFeedbackSummary } from '../lib/programme-evidence';
import { melCan, memberAccessSummary, programmeCapabilities } from '../lib/mel';
import { programmeRecordMetrics, PROGRESS_TEMPLATES, progressValue, progressRecordSections } from '../lib/programme-progress';
import { DEMO_NETWORK } from '../lib/network-demo';
import { productionAreaSummary } from '../lib/production-sites';

test('training totals count repeat attendance but deduplicate participants and respect the report date', () => {
  const session = freshEvidenceData().sessions[0];
  const later = { ...session, id:'later', date:'2026-09-01' };
  assert.deepEqual(trainingTotals([session,later], '2026-08-31'), {sessions:1,attendances:2,uniqueParticipants:2});
  assert.deepEqual(trainingTotals([session,later], '2026-09-05'), {sessions:2,attendances:4,uniqueParticipants:2});
  assert.equal(trainingTotals([publishedTraining(session)], '2026-09-05', false).uniqueParticipants, null);
});
test('funder training projection excludes named attendance, precise location and private follow-up', () => {
  const session = {...freshEvidenceData().sessions[0],latitude:-29,longitude:31,nextSteps:'Private support need',assessmentId:'private-assessment'};
  const view = publishedTraining(session);
  assert.deepEqual(view.attendance, []);
  for (const key of ['nextSteps','assessmentId','ownerId','facilitator'] as const) assert.equal(view[key], '');
  assert.equal(view.latitude, null); assert.equal(view.longitude, null);
  assert.equal(view.presentCount, 2); assert.equal(view.report, session.report);
  assert.ok(!JSON.stringify(view).includes('Nomvula'));
});
test('milestones use the latest cumulative observation, never sum totals across dates', () => {
  const milestone=freshEvidenceData().milestones[0];
  milestone.observations.push({date:'2026-09-01',actual:3,evidence:'Three completed registers',recordedAt:'2026-09-01T00:00:00Z'});
  assert.equal(milestoneAt(milestone,'2026-08-01').actual,null);
  assert.equal(milestoneAt(milestone,'2026-08-31').actual,1);
  assert.equal(milestoneAt(milestone,'2026-09-05').actual,3);
  assert.equal(milestoneAt(milestone,'2026-09-05').remaining,1);
  assert.equal(milestoneAt(milestone,'2026-12-01').status,'Overdue');
});
test('evidence validation rejects duplicate identities, malformed nested records, and future observations', () => {
  const {sessions:[s],milestones:[m]}=freshEvidenceData();
  assert.equal(validTrainingRecord(s,'2026-09-05'),true);
  assert.equal(validProgrammeMilestone(m,'2026-09-05'),true);
  assert.equal(validTrainingRecord({...s,attendance:[s.attendance[0],s.attendance[0]]},'2026-09-05'),false);
  assert.equal(validTrainingRecord({...s,attendance:[null]},'2026-09-05'),false);
  assert.equal(validTrainingRecord({...s,photos:[null]},'2026-09-05'),false);
  assert.equal(validTrainingRecord({...s,date:'2026-09-06'},'2026-09-05'),false);
  assert.equal(validTrainingRecord({...s,latitude:91,longitude:10},'2026-09-05'),false);
  assert.equal(validProgrammeMilestone({...m,observations:[null]},'2026-09-05'),false);
  assert.equal(validProgrammeMilestone({...m,observations:[{date:'2026-10-01',actual:2,evidence:'future'}]},'2026-09-05'),false);
  assert.equal(validProgrammeMilestone({...m,target:0},'2026-09-05'),false);
});
test('logos accept bounded image data rather than executable SVG or remote image URLs', () => {
  assert.equal(validProgrammeBranding(freshEvidenceData().branding),true);
  assert.equal(validEvidenceImage('https://example.com/logo.png'),false);
  assert.equal(validEvidenceImage('data:image/svg+xml;base64,PHN2Zz4='),false);
  assert.equal(validEvidenceImage('data:image/png;base64,'+'A'.repeat(200000)),false);
  assert.equal(validProgrammeBranding({organisation:null}),false);
});
test('training permission is independent from survey analysis and user-management powers', () => {
  assert.equal(melCan('mentor',{training:true},'training'),true);
  assert.equal(melCan('mentor',{training:true},'analyse'),false);
  assert.equal(melCan('mentor',{training:true},'people'),false);
  assert.equal(melCan('ngo',{training:false,manage:true},'training'),false);
  assert.equal(melCan('farmer',{training:true},'training'),false);
});


test('saved staff switches cannot grant programme powers after a member becomes a farmer or funder', () => {
  const all = { manage: true, analyse: true, people: true, training: true };
  for (const role of ['farmer', 'student', 'funder'] as const) {
    assert.ok(memberAccessSummary(role, all).every(c => !c.allowed));
    assert.deepEqual(programmeCapabilities(role, all), {manage:false,brand:false,record:false,analyse:false,read:false});
  }
  const mentor = memberAccessSummary('mentor', all);
  assert.equal(mentor.find(c => c.id === 'people')?.allowed, false);
  assert.equal(mentor.find(c => c.id === 'publish')?.allowed, false);
  assert.equal(mentor.find(c => c.id === 'training')?.allowed, true);
  assert.equal(mentor.find(c => c.id === 'visits')?.allowed, true);
});

test('access inspection honours explicit denial and preserves organisation defaults', () => {
  const defaults = memberAccessSummary('ngo', null);
  assert.equal(defaults.find(c => c.id === 'people')?.allowed, true);
  const denied = memberAccessSummary('ngo', {manage:false,analyse:false,people:false,training:false});
  assert.ok(denied.every(c => !c.allowed));
  const traineeRecorder = memberAccessSummary('mentor', {training:true,analyse:false});
  assert.equal(traineeRecorder.find(c => c.id === 'evidence')?.allowed, true);
  assert.equal(traineeRecorder.find(c => c.id === 'analyse')?.allowed, false);
});

test('observed indicators may have an unagreed target without inventing progress percentages', () => {
  const m={...freshEvidenceData().milestones[0],target:null,category:'water-energy' as const};
  assert.equal(validProgrammeMilestone(m,'2026-09-06'),true);
  assert.equal(milestoneAt(m,'2026-09-06').actual,1);
  assert.equal(milestoneAt(m,'2026-09-06').percent,null);
  assert.equal(milestoneAt(m,'2026-09-06').remaining,null);
  assert.equal(milestoneAt(m,'2026-08-01').actual,null);
  assert.equal(validProgrammeMilestone({...m,category:'invented'},'2026-09-06'),false);
  assert.equal(validProgrammeMilestone({...m,category:undefined,target:4},'2026-09-06'),true,'older indicators remain readable');
});
test('programme totals distinguish unavailable records from recorded zero and preserve separate sources', () => {
  const missing=programmeRecordMetrics(null,null);
  assert.ok(missing.metrics.every(m=>m.value===null));
  const farmer=structuredClone(DEMO_NETWORK.farmers[0]);
  farmer.metrics.producedKg=0;farmer.metrics.incomeZar=null;farmer.metrics.expensesZar=null;
  const records=programmeRecordMetrics([farmer],productionAreaSummary([]),2);
  assert.equal(records.metrics.find(m=>m.id==='harvest')!.value,0);
  assert.equal(records.metrics.find(m=>m.id==='income')!.value,null);
  assert.equal(records.metrics.find(m=>m.id==='hectares')!.value,null);
  assert.ok(records.notes.some(n=>n.includes('2 enrolled farmers')));
  assert.ok(progressRecordSections(records).some(s=>s.title.includes('livelihoods')));
  assert.ok(!records.metrics.some(m=>/profit|per m|r\/m/i.test(m.label)));
  assert.notEqual(progressValue(0.0001,'ha'),'0 ha');
});
test('indicator suggestions cover the whole programme and do not pre-fill results or numeric targets', () => {
  assert.equal(new Set(PROGRESS_TEMPLATES.map(t=>t.category)).size,7);
  for(const template of PROGRESS_TEMPLATES){assert.ok(template.method);assert.ok(!('target' in template));assert.ok(!('baseline' in template));assert.ok(!('actual' in template));}
});

test('the funder tour has dated results and evidence in every area of programme work', () => {
  const data=freshEvidenceData();
  const categories=['growing','water-energy','land-nature','livelihoods','participation','learning','delivery'];
  for(const category of categories){
    const measures=data.milestones.filter(m=>m.category===category);
    assert.ok(measures.length>0,`${category} must not open an empty category in the tour`);
    for(const measure of measures){
      assert.equal(validProgrammeMilestone(measure,'2026-09-07'),true,measure.title);
      assert.equal(measure.published,true);
      assert.equal(milestoneAt(measure,'2026-08-01').actual,null);
      assert.ok(milestoneAt(measure,'2026-09-07').actual!>0,measure.title);
      assert.ok(measure.observations.every(o=>o.evidence.length>40),measure.title);
    }
  }
  for(const session of data.sessions)assert.equal(validTrainingRecord(session,'2026-09-07'),true);
  assert.ok(data.milestones.some(m=>m.target===null),'a reading without an agreed target should also be demonstrated');
});

test('demo programme observations keep production, survival and participant counts coherent', () => {
  const data=freshEvidenceData();
  const value=(key:string,date:string)=>milestoneAt(data.milestones.find(m=>m.id===`sample-progress-${key}`)!,date).actual!;
  for(const date of ['2026-08-15','2026-09-01']){
    assert.ok(value('food-distributed',date)<=value('harvest',date),'food distribution is part of the recorded harvest');
    assert.ok(value('surviving-trees',date)<=value('trees',date),'survival cannot exceed the planted cohort');
    assert.ok(value('skills',date)<=trainingTotals(data.sessions,date).uniqueParticipants!,'repeated practical checks cannot invent new learners');
  }
  assert.ok(value('surviving-trees','2026-09-01')<value('surviving-trees','2026-08-15'),'the tour must also demonstrate a decline requiring follow-up');
});

test('older tours gain programme examples without overwriting edits or duplicating indicators', () => {
  const fresh=freshEvidenceData();
  const edited={...fresh.milestones.find(m=>m.category==='water-energy')!,title:'My edited tank check',target:45000,published:false};
  const custom={...fresh.milestones[0],id:'visitor-indicator',title:'My own agreed indicator'};
  const stored={...fresh,sessions:[{...fresh.sessions[0],report:'My own session notes'}],milestones:[fresh.milestones[0],edited,custom]};
  const before=structuredClone(stored);
  const completed=completeSampleEvidence(stored);
  assert.deepEqual(stored,before,'hydration must not mutate stored visitor work');
  assert.deepEqual(completed.milestones.find(m=>m.id===edited.id),edited);
  assert.deepEqual(completed.milestones.find(m=>m.id===custom.id),custom);
  assert.equal(completed.sessions[0].report,'My own session notes');
  assert.equal(new Set(completed.milestones.map(m=>m.id)).size,completed.milestones.length);
  assert.deepEqual(completeSampleEvidence(completed),completed,'reopening the page must not add duplicate examples');
  const real={...stored,sample:false};
  assert.equal(completeSampleEvidence(real),real,'a real organisation must never receive tour observations');
});


test('signed attendance survives the Firestore document encoding and read projection', async () => {
  const { getFirestore }=await import('firebase-admin/firestore');
  const { initializeApp, deleteApp }=await import('firebase-admin/app');
  const app=initializeApp({projectId:'training-serializer-check'},'training-serializer-check');
  try {
    const db=getFirestore(app) as unknown as {_serializer:{encodeFields:(value:object)=>unknown}};
    const source=freshEvidenceData().sessions[0],stored=trainingForStorage(source);
    assert.doesNotThrow(()=>db._serializer.encodeFields(stored),'actual Firestore serializer must accept saved signatures');
    const reopened=trainingFromStorage(JSON.parse(JSON.stringify(stored)));
    assert.deepEqual(reopened.attendance,source.attendance);
    assert.deepEqual(reopened.feedback,source.feedback);
    assert.deepEqual(reopened.photos,source.photos);
    assert.equal(validTrainingRecord(reopened,'2026-09-08'),true);
    assert.equal(trainingFeedbackSummary(reopened).completed,2);
    const view=publishedTraining(reopened),json=JSON.stringify(view);
    for(const privateText of ['Nomvula','GP-01-001','ATT-2026-0815-001','strokes','Bring a second scale'])assert.ok(!json.includes(privateText));
    assert.equal(view.presentCount,2);assert.equal(view.registeredCount,2);
    assert.equal(view.feedbackSummary?.completed,2);
    assert.ok(view.feedbackSummary?.metrics.every(m=>m.suppressed),'small feedback groups remain suppressed for funders');
  } finally {await deleteApp(app);}
});
test('register images, unchecked photos and legacy images require explicit sharing',()=>{
  const image=freshEvidenceData().sessions[0].photos[0].image;
  const photos=[{image,caption:'Paper register',kind:'register' as const,shared:true},{image,caption:'Unreviewed',kind:'group' as const,shared:false},{image,caption:'Legacy'},{image,caption:'Reviewed activities',kind:'activity' as const,shared:true}];
  assert.deepEqual(sharedTrainingPhotos(photos).map(p=>p.caption),['Reviewed activities']);
  assert.deepEqual(publishedTraining({...freshEvidenceData().sessions[0],photos}).photos.map(p=>p.caption),['Reviewed activities']);
});
test('attendance signatures and feedback reject malformed, absent, duplicate and excessive records',()=>{
  const s=freshEvidenceData().sessions[0],a=s.attendance[0];
  assert.equal(validTrainingRecord({...s,attendance:[{...a,present:false}]},'2026-09-08'),false);
  assert.equal(validTrainingRecord({...s,attendance:[{...a,signature:{signedAt:s.updatedAt,strokes:[[[0,0],[1001,10]]]}}]},'2026-09-08'),false);
  assert.equal(validTrainingRecord({...s,feedback:[s.feedback![0],s.feedback![0]]},'2026-09-08'),false);
  assert.equal(validTrainingRecord({...s,feedback:[{...s.feedback![0],consent:false}]},'2026-09-08'),false);
  assert.equal(validTrainingRecord({...s,feedback:[{...s.feedback![0],answers:{course_clear:'99'}}]},'2026-09-08'),false);
  assert.equal(validTrainingRecord({...s,photos:Array.from({length:9},()=>s.photos[0])},'2026-09-08'),false);
  const legacy={...s,feedback:undefined,attendance:s.attendance.map(({id,name,present})=>({id,name,present}))};
  assert.equal(validTrainingRecord(legacy,'2026-09-08'),true,'old unsigned records remain editable');
  const edited={...s,title:'My saved title',updatedAt:'2026-09-08T10:00:00Z',photos:[],photoCount:0,feedback:undefined};
  assert.equal(completeSampleEvidence({...freshEvidenceData(),sessions:[edited]}).sessions[0].title,'My saved title');
});
