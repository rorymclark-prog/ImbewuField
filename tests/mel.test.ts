import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseAssessment, matchedChange, canChangeOrgRole, melCan, validAnswers, MEL_STAGES, type MelAssessment, type MelResponse } from '../lib/mel';
import { MEL_TEMPLATES } from '../lib/mel-templates';
import { canSeeWorkspaceLink, visibleRoleTabs } from '../lib/role-navigation';

const assessment = (id = 'a', stage: MelAssessment['stage'] = 'baseline'): MelAssessment => ({ id, orgId: 'ngo-a', project: 'Project one', title: 'Review', version: 1, stage, participantIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], due: '2026-09-30', state: 'open', published: false, createdAt: '2026-09-01', updatedAt: '2026-09-01', action: '', actionOwner: '', actionDue: '', actionDone: false });
const response = (participantId: string, answers: Record<string, string>, assessmentId = 'a'): MelResponse => ({ participantId, answers, assessmentId, orgId: 'ngo-a', version: 1, consent: true, language: 'en', submittedAt: '2026-09-05' });

test('all assessment stages carry isiZulu questions and stable shared baseline keys', () => {
  for (const stage of MEL_STAGES) {
    const t = MEL_TEMPLATES[stage];
    assert.equal(new Set(t.questions.map(q => q.id)).size, t.questions.length);
    assert.ok(t.zu && t.en && t.questions.length);
    for (const q of t.questions) { assert.ok(q.zu && q.en); for (const o of q.options ?? []) assert.ok(o.zu && o.en); }
  }
  for (const stage of ['midpoint', 'closeout'] as const) {
    for (const q of MEL_TEMPLATES.baseline.questions.filter(q => q.id !== 'goal')) assert.deepEqual(MEL_TEMPLATES[stage].questions.find(x => x.id === q.id), q);
  }
});
test('invalid numbers and invented response choices are refused; zero is distinct from skipped', () => {
  const t = MEL_TEMPLATES.baseline;
  for (const value of ['-1', 'Infinity', 'NaN', '1e6', 'abc']) assert.equal(validAnswers(t, { growing_m2: value }), false);
  assert.equal(validAnswers(t, { home_food_days_7d: '8' }), false);
  assert.equal(validAnswers(t, { water_reliable: 'maybe invented' }), false);
  assert.equal(validAnswers(t, { unknown: 'yes' }), false);
  assert.equal(validAnswers(t, { growing_m2: '0', home_food_days_7d: '' }), true);
  const m = analyseAssessment(assessment(), t, [response('p1', { growing_m2: '0' }), response('p2', { growing_m2: '' })]).metrics.find(m => m.id === 'growing_m2')!;
  assert.equal(m.mean, 0); assert.equal(m.n, 1); assert.equal(m.missing, 1);
});
test('retries, another organisation and unassigned respondents never inflate completion', () => {
  const a = assessment();
  const first = response('p1', { growing_m2: '10' });
  const rows = [first, { ...first, submittedAt: '2026-09-06', answers: { growing_m2: '20' } }, response('outsider', { growing_m2: '9999' }), { ...response('p2', { growing_m2: '9999' }), orgId: 'ngo-b' }, { ...response('p3', { growing_m2: '9999' }), assessmentId: 'other' }];
  const result = analyseAssessment(a, MEL_TEMPLATES.baseline, rows);
  assert.equal(result.completed, 1); assert.equal(result.assigned, 6);
  assert.equal(result.metrics.find(m => m.id === 'growing_m2')?.mean, 20);
});
test('a funder summary excludes written feedback and staff ratings and suppresses small complements', () => {
  const a = assessment('a', 'midpoint');
  const rows = a.participantIds.map((id, i) => response(id, { growing_m2: '20', water_reliable: i ? 'yes' : 'no', staff_help: '1', support_change: 'PRIVATE STAFF COMPLAINT' }));
  const result = analyseAssessment(a, MEL_TEMPLATES.midpoint, rows, true);
  assert.ok(!JSON.stringify(result).includes('PRIVATE STAFF COMPLAINT'));
  assert.ok(!result.metrics.some(m => m.id === 'staff_help'));
  assert.equal(result.metrics.find(m => m.id === 'water_reliable')?.suppressed, true);
  assert.equal(result.metrics.find(m => m.id === 'growing_m2')?.mean, 20);
  assert.equal(analyseAssessment(a, MEL_TEMPLATES.midpoint, rows.slice(0, 4), true).metrics.find(m => m.id === 'growing_m2')?.suppressed, true);
});
test('change uses the same participants and the same project, not two unrelated cohort averages', () => {
  const b = assessment('before'), a = assessment('after', 'closeout');
  const old = [response('p1', { growing_m2: '10' }, 'before'), response('p2', { growing_m2: '1000' }, 'before')];
  const recent = [response('p1', { growing_m2: '30' }, 'after'), response('p3', { growing_m2: '9000' }, 'after')];
  assert.deepEqual(matchedChange(b, a, old, recent, 'growing_m2'), { n: 1, change: 20 });
  assert.deepEqual(matchedChange(b, { ...a, project: 'Other project' }, old, recent, 'growing_m2'), { n: 0, change: null });
});
test('an NGO cannot promote itself, create a platform admin or cross an organisation boundary', () => {
  const actor = { id: 'owner', role: 'ngo' as const, orgId: 'ngo-a' };
  const target = { id: 'member', role: 'farmer' as const, orgId: 'ngo-a' };
  assert.equal(canChangeOrgRole(actor, target, 'mentor'), true);
  assert.equal(canChangeOrgRole(actor, target, 'admin'), false);
  assert.equal(canChangeOrgRole(actor, target, 'funder'), false);
  assert.equal(canChangeOrgRole(actor, { ...target, orgId: 'ngo-b' }, 'ngo'), false);
  assert.equal(canChangeOrgRole(actor, { ...actor }, 'mentor'), false);
  assert.equal(melCan('ngo', { analyse: false }, 'analyse'), false);
  assert.equal(melCan('mentor', null, 'analyse'), false);
  assert.equal(melCan('mentor', { analyse: true }, 'analyse'), true);
  assert.equal(melCan('funder', { analyse: true, people: true }, 'analyse'), false);
});
test('a funder has no farmer, mentor or design navigation, while the owner retains all role tabs', () => {
  assert.deepEqual(visibleRoleTabs('funder'), ['funder']);
  assert.equal(visibleRoleTabs('admin').length, 5);
  for (const href of ['/farmer', '/farmer?panel=Reports', '/mentor', '/student', '/design', '/facilitator/crops', '/records', '/ngo']) assert.equal(canSeeWorkspaceLink('funder', href), false, href);
  for (const href of ['/funder', '/network', '/account']) assert.equal(canSeeWorkspaceLink('funder', href), true);
});
