import test from 'node:test';
import assert from 'node:assert/strict';
import { freshEvidenceData, trainingTotals, milestoneAt, publishedTraining, validTrainingRecord, validProgrammeMilestone, validProgrammeBranding, validEvidenceImage } from '../lib/programme-evidence';
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
