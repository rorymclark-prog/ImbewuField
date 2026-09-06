import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleAssessments, freshSampleProgramme, samplePublishedAssessments } from '../lib/sample-programme';
import { MEL_TEMPLATES } from '../lib/mel-templates';
import { analyseAssessment, canChangeOrgRole, validAnswers } from '../lib/mel';
import { FARM_TOUR, sampleRolesFor, cleanTourProgress } from '../lib/sample-tour';
import { freshSampleAssessment, freshSampleFarmPack, SAMPLE_FARM_SITE_ID, sampleFarmSections, SAMPLE_PHOTOS } from '../lib/sample-farm-pack';
import { validFeedback, feedbackText } from '../lib/product-feedback';
import { buildDemoSavedPlace } from '../lib/demo-farm';

test('sample tour spans 15 minutes and leads to real farm pages with bounded progress',()=>{
  assert.equal(FARM_TOUR.reduce((n,s)=>n+s.minutes,0),15);
  assert.equal(new Set(FARM_TOUR.map(s=>s.id)).size,FARM_TOUR.length);
  for(const s of FARM_TOUR)assert.ok(existsSync(`app${s.href.split(/[?#]/)[0]}/page.tsx`),s.href);
  assert.deepEqual(cleanTourProgress(['map','map','made-up',null]),['map']);
  assert.deepEqual(sampleRolesFor('farmer'),['farmer']);
  assert.deepEqual(sampleRolesFor('mentor'),['mentor']);
  assert.deepEqual(sampleRolesFor('funder'),['funder']);
  assert.equal(sampleRolesFor('ngo').length,5);
});
test('farm evidence uses the saved place, reset-safe fixtures and explicit fictional provenance',()=>{
  const a=freshSampleAssessment(),p=freshSampleFarmPack();
  assert.equal(a.placeId,buildDemoSavedPlace().id);assert.equal(a.siteId,SAMPLE_FARM_SITE_ID);
  assert.match(a.notes,/FICTIONAL/);assert.match(p.soil.reference,/NOT A LAB CERTIFICATE/);
  p.household.adults=99;a.goals.length=0;
  assert.equal(freshSampleFarmPack().household.adults,2);assert.ok(freshSampleAssessment().goals.length>0);
  const sections=sampleFarmSections(p,a);assert.ok(sections.some(s=>s.lines.some(l=>l.includes('99 adults'))));
  for(const photo of SAMPLE_PHOTOS){assert.ok(existsSync(`public${photo.src}`));assert.match(photo.caption,/AI-generated/);}
});
test('feedback is bounded and never includes query strings, external URLs or automatic farm attachments',()=>{
  const good={id:'demo-request-001',kind:'bug',title:'Map labels',details:'The label is cut off on my phone.',path:'/farmer',sample:true};
  assert.ok(validFeedback(good));assert.match(feedbackText(good as import('../lib/product-feedback').FeedbackInput),/Sample workspace: yes/);
  for(const patch of [{id:'../bad'},{kind:'admin'},{details:'short'},{title:'x'.repeat(161)},{details:'x'.repeat(4001)},{path:'https://example.com'},{path:'/farmer?token=secret'},{sample:'yes'}])assert.equal(validFeedback({...good,...patch}),false);
  const route=readFileSync('app/api/product-feedback/route.ts','utf8');
  assert.match(route,/guardPaidApiRequest/);assert.match(route,/profile\.data\(\)\?\.role!=='admin'/);
  assert.match(route,/senderId:auth\.uid/);assert.match(route,/runTransaction/);
});

test('sample completion comes from assigned responses and never fabricates production or money', () => {
  for (const { assessment: a, rows } of buildSampleAssessments()) {
    const result = analyseAssessment(a, MEL_TEMPLATES[a.stage], rows);
    assert.equal(result.completed, rows.length);
    assert.ok(result.completed <= result.assigned);
    for (const row of rows) assert.ok(validAnswers(MEL_TEMPLATES[a.stage], row.answers));
    for (const q of MEL_TEMPLATES[a.stage].questions.filter(q => q.kind === 'number')) {
      assert.equal(result.metrics.find(m => m.id === q.id)?.mean, undefined);
    }
  }
});
test('sample sharing respects the master switch, publication and closed state', () => {
  const controls = freshSampleProgramme();
  assert.equal(samplePublishedAssessments(controls).length, 2);
  assert.equal(samplePublishedAssessments({ ...controls, funderAccess: false }).length, 0);
  assert.equal(samplePublishedAssessments({ ...controls, published: [] }).length, 0);
  const all = samplePublishedAssessments({ ...controls, published: buildSampleAssessments().map(x => x.assessment.id) });
  assert.ok(all.every(a => a.state === 'closed'));
  for (const a of all) for (const m of a.metrics) assert.ok(!MEL_TEMPLATES[a.stage].questions.find(q => q.id === m.id)?.private);
});
test('reset rebuilds independent sample controls', () => {
  const modified = freshSampleProgramme(); modified.people[0].analyse = true; modified.published.length = 0;
  assert.equal(freshSampleProgramme().people[0].analyse, false);
  assert.equal(freshSampleProgramme().published.length, 2);
});
test('owner access editor remains scoped to the selected NGO and cannot demote itself', () => {
  const actor = { id: 'owner', role: 'admin' as const, orgId: 'ngo-a' };
  const target = { id: 'member', role: 'farmer' as const, orgId: 'ngo-a' };
  assert.equal(canChangeOrgRole(actor, target, 'mentor'), true);
  assert.equal(canChangeOrgRole(actor, { ...target, orgId: 'ngo-b' }, 'mentor'), false);
  assert.equal(canChangeOrgRole(actor, actor, 'ngo'), false);
  assert.equal(canChangeOrgRole(actor, target, 'admin'), false);
  assert.equal(canChangeOrgRole(actor, target, 'funder'), false);
});


// Stateful demos must preserve the same publication and assignment rules as live work.
import { changeSampleAssessment, sampleAssessments } from '../lib/sample-programme';
import { freshSampleAreas, upsertSampleArea, sampleRead, sampleWrite } from '../lib/sample-operations';
import { freshFieldWorkspace, projectFieldWorkspace, validFieldTeam } from '../lib/field-teams';

test('opening a sample assessment needs participants and never invents completed responses', () => {
  const fresh = freshSampleProgramme();
  assert.throws(() => changeSampleAssessment(fresh, 'sample-closeout', { state: 'open', participantIds: [] }));
  const open = changeSampleAssessment(fresh, 'sample-closeout', { state: 'open', participantIds: ['sample-person-1'] });
  assert.equal(sampleAssessments(open).find(x => x.assessment.id === 'sample-closeout')!.rows.length, 0);
  assert.throws(() => changeSampleAssessment(open, 'sample-closeout', { state: 'open', participantIds: ['sample-person-1'] }));
  assert.equal(sampleAssessments(changeSampleAssessment(open, 'sample-closeout', { state: 'closed' })).find(x => x.assessment.id === 'sample-closeout')!.assessment.state, 'closed');
  assert.equal(sampleAssessments(fresh).find(x => x.assessment.id === 'sample-closeout')!.assessment.state, 'draft');
});
test('updating a sample garden replaces its area instead of double counting land', () => {
  const rows = freshSampleAreas();
  const changed = { ...rows[0], vegetableM2: rows[0].vegetableM2 + 10 };
  // The seed now covers the portfolio; replacement must preserve its size.
  assert.equal(upsertSampleArea(rows, changed, '2026-09-05').length, rows.length);
  assert.equal(upsertSampleArea(rows, changed, '2026-09-05').find(s => s.code === changed.code)!.vegetableM2, changed.vegetableM2);
  assert.throws(() => upsertSampleArea(rows, { ...changed, vegetableM2: -1 }, '2026-09-05'));
  assert.throws(() => upsertSampleArea(rows, { ...changed, observedOn: '2099-01-01' }, '2026-09-05'));
});
test('sample stores refuse use outside a sample, including stale handlers after exit', () => {
  assert.throws(() => sampleRead('areas', freshSampleAreas));
  assert.throws(() => sampleWrite('areas', []));
});
test('mentors receive only explicitly assigned people, guidance and their own visit notes', () => {
  const data = freshFieldWorkspace();
  data.teams.push({ mentorId: 'someone-else', location: 'Same location', farmerIds: ['s3'], guidance: 'Private other team', updatedAt: '' });
  data.visits = [
    { id: 'one', mentorId: 'sample-mentor', farmerId: 's1', date: '2026-09-01', notes: 'Mine' },
    { id: 'two', mentorId: 'someone-else', farmerId: 's1', date: '2026-09-01', notes: 'Another mentor' },
    { id: 'three', mentorId: 'sample-mentor', farmerId: 's3', date: '2026-09-01', notes: 'No longer assigned' },
  ];
  const view = projectFieldWorkspace(data, 'sample-mentor', false);
  assert.deepEqual(view.teams.map(t => t.mentorId), ['sample-mentor']);
  assert.deepEqual(view.people.map(p => p.id).sort(), [...data.teams[0].farmerIds, 'sample-mentor'].sort());
  assert.equal(view.people.some(p => p.id === 's3'), false, 'another mentor’s farmer stays private');
  assert.deepEqual(view.visits.map(v => v.id), ['one']);
  assert.equal(projectFieldWorkspace(data, 'unassigned', false).people.length, 0);
  assert.equal(projectFieldWorkspace(data, 'organisation', true).visits.length, 3);
});
test('team assignments reject malformed IDs and duplicate farmer membership', () => {
  const team = freshFieldWorkspace().teams[0];
  assert.ok(validFieldTeam(team));
  assert.equal(validFieldTeam({ ...team, farmerIds: ['s1', 's1'] }), false);
  assert.equal(validFieldTeam({ ...team, mentorId: '../other' }), false);
  assert.equal(validFieldTeam({ ...team, location: ' ' }), false);
});

import { buildProgrammePdf } from '../lib/programme-report-pdf';
test('sample reports retain their sample warning on every page and summaries omit excess detail', async () => {
  const sections = [{ title: 'Recorded visits', lines: Array.from({ length: 90 }, (_, i) => `Visit record ${i + 1}: fictional demonstration notes for the assigned farmer.`) }];
  const full = await buildProgrammePdf('Field report', true, sections, 'full');
  assert.ok(full.getNumberOfPages() > 1);
  const output = full.output();
  assert.equal(output.split('SAMPLE - NOT ACTUAL RESULTS').length - 1, full.getNumberOfPages());
  assert.ok(output.includes('Visit record 90:'));
  const brief = await buildProgrammePdf('Field report', true, sections, 'summary');
  assert.ok(brief.output().includes('Visit record 5:'));
  assert.ok(!brief.output().includes('Visit record 6:'));
});

test('three demo mentors each receive fifteen distinct gardens without cross-team leakage', () => {
  const data = freshFieldWorkspace();
  assert.equal(data.teams.length, 3);
  assert.equal(new Set(data.teams.flatMap(t => t.farmerIds)).size, 45);
  for (const team of data.teams) {
    assert.equal(team.farmerIds.length, 15);
    const view = projectFieldWorkspace(data, team.mentorId, false);
    const gardeners = view.people.filter(p => p.id !== team.mentorId);
    assert.equal(gardeners.length, 15);
    assert.equal(new Set(gardeners.map(p => p.gardenName)).size, 15);
    assert.ok(gardeners.every(p => p.gardenName && p.gardenAreaM2 && p.gardenAreaM2 > 0));
    assert.equal(new Set(gardeners.map(p => p.gardenType)).size, 5);
  }
});

// Demo identities must not regress to blank initials or missing public files.
import { existsSync, readFileSync } from 'node:fs';
import { SAMPLE_PORTRAITS, samplePortrait } from '../lib/sample-media';
import { SAMPLE_BRANDING } from '../lib/sample-branding';
import { validProgrammeBranding } from '../lib/programme-evidence';
import { DEMO_NETWORK } from '../lib/network-demo';
test('all fifteen demo portraits are distinct assets and every portfolio person has one', () => {
  assert.equal(SAMPLE_PORTRAITS.length, 15);
  assert.equal(new Set(SAMPLE_PORTRAITS.map(path => readFileSync(`public${path}`).toString('base64'))).size, 15);
  for (const row of DEMO_NETWORK.records) {
    assert.ok(row.farmer.photoUrl);
    assert.ok(existsSync(`public${row.farmer.photoUrl}`));
    assert.equal(row.farmer.photoUrl, samplePortrait(row.farmer.name));
    assert.equal(row.farmer.isDemo, true);
  }
  assert.ok(validProgrammeBranding(SAMPLE_BRANDING), 'sample logos must obey the same PDF image limits as uploaded branding');
});

import { sampleChoicesForAccount } from '../lib/sample-tour';
test('sample choices use confirmed account identity and fail closed during loading', () => {
  assert.equal(sampleChoicesForAccount(null, false, true).length, 5);
  assert.equal(sampleChoicesForAccount('ngo', true, true).length, 5);
  assert.equal(sampleChoicesForAccount('admin', true, true).length, 5);
  assert.deepEqual(sampleChoicesForAccount('farmer', true, true), ['farmer']);
  assert.deepEqual(sampleChoicesForAccount('mentor', true, true), ['mentor']);
  assert.deepEqual(sampleChoicesForAccount(null, true, true), []);
  assert.deepEqual(sampleChoicesForAccount('admin', true, false), []);
});
test('chooser does not authorize from the sandbox farmer profile after reload', () => {
  const source=readFileSync(new URL('../app/samples/page.tsx',import.meta.url),'utf8');
  assert.match(source,/readSampleChooserAccountRole\(user.uid\)/);
  assert.match(source,/sampleChoicesForAccount\(accountRole, !!user, choicesReady\)/);
  assert.match(source,/examples.map\(/);
  assert.doesNotMatch(source,/examples.filter\(/);
  const reader=readFileSync(new URL('../lib/sample-choice-access.ts',import.meta.url),'utf8');
  assert.match(reader,/doc\(firebase.db, 'profiles', expectedUid\)/);
  assert.doesNotMatch(reader,/getSandboxProfile|getMyProfile/);
  assert.equal((reader.match(/currentUser\?\.uid !== expectedUid/g)||[]).length,2);
});
test('sample controls cannot recreate the fixed bottom strip', () => {
  const source=readFileSync(new URL('../components/SampleModeBanner.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/bottom:|bottom-\[|zIndex:\s*9999/);
  const menu=readFileSync(new URL('../components/NavDrawer.tsx',import.meta.url),'utf8');
  assert.match(menu,/Sample controls/);
  assert.match(menu,/Exit sample/);
  assert.match(menu,/18 gardens &amp; completed reports/);
});
