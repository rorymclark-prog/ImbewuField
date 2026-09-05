import test from 'node:test';
import assert from 'node:assert/strict';
import { freshEvidenceData, trainingTotals, milestoneAt, publishedTraining, validTrainingRecord, validProgrammeMilestone, validProgrammeBranding, validEvidenceImage } from '../lib/programme-evidence';
import { melCan } from '../lib/mel';

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
