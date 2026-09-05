import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleAssessments, freshSampleProgramme, samplePublishedAssessments } from '../lib/sample-programme';
import { MEL_TEMPLATES } from '../lib/mel-templates';
import { analyseAssessment, canChangeOrgRole, validAnswers } from '../lib/mel';

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
