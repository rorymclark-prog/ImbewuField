import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { southAfricanTodayISODate, validFieldVisit, type FieldVisit } from '../lib/field-teams';
import { freshEvidenceData, validProgrammeMilestone, validTrainingRecord } from '../lib/programme-evidence';
import { validProductionSite } from '../lib/production-sites';

test('fieldwork reaches the next South African day at midnight, independently of the server timezone', () => {
  const originalTz = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      assert.equal(southAfricanTodayISODate(new Date('2026-10-27T21:59:59.999Z')), '2026-10-27');
      assert.equal(southAfricanTodayISODate(new Date('2026-10-27T22:00:00.000Z')), '2026-10-28');
      assert.equal(southAfricanTodayISODate(new Date('2026-12-31T22:00:00.000Z')), '2027-01-01');
    }
  } finally {
    if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
  }
});

test('after local midnight training, progress, visits and garden observations accept today and reject tomorrow', () => {
  // 00:30 SAST is still the previous UTC date: this must fail if UTC slicing returns.
  const now = new Date('2026-10-27T22:30:00.000Z');
  const today = southAfricanTodayISODate(now), tomorrow = '2026-10-29';
  assert.equal(now.toISOString().slice(0, 10), '2026-10-27');
  const { sessions: [original], milestones: [milestone] } = freshEvidenceData();
  const session = { ...original, date: '2026-10-28' };
  assert.equal(validTrainingRecord(session, today), true);
  assert.equal(validTrainingRecord({ ...session, date: tomorrow }, today), false);
  const observation = { ...milestone.observations[0], date: '2026-10-28' };
  assert.equal(validProgrammeMilestone({ ...milestone, observations: [observation] }, today), true);
  assert.equal(validProgrammeMilestone({ ...milestone, observations: [{ ...observation, date: tomorrow }] }, today), false);
  const visit: FieldVisit = { id: 'visit-1', mentorId: 'mentor-1', farmerId: 'farmer-1', date: '2026-10-28', notes: 'Observed beds.', agreedAction: 'Review the record.', actionCompletedOn: '2026-10-28', actionOutcome: 'Reviewed together.' };
  assert.equal(validFieldVisit(visit, today), true);
  assert.equal(validFieldVisit({ ...visit, date: tomorrow, actionCompletedOn: tomorrow }, today), false);
  assert.equal(validFieldVisit({ ...visit, actionCompletedOn: tomorrow }, today), false);
  const garden = { code: 'garden-1', name: 'Garden observation', observedOn: '2026-10-28', vegetableM2: 0, stapleM2: 0, boundaryM2: null, evidence: 'Dated observation recorded on site.', published: false };
  assert.equal(validProductionSite(garden, today), true);
  assert.equal(validProductionSite({ ...garden, observedOn: tomorrow }, today), false);
});

test('all fieldwork write routes pass the regional day into their date validators', () => {
  // Pure validators already accepted a supplied date; the regression was the API supplying
  // UTC yesterday. Guard that connection as well as exercising the validators above.
  const programme = readFileSync(new URL('../app/api/programme-evidence/route.ts', import.meta.url), 'utf8');
  assert.match(programme, /today\s*=\s*southAfricanTodayISODate\(instant\)/);
  assert.match(programme, /validTrainingRecord\(b\.session,\s*today\)/);
  assert.match(programme, /validProgrammeMilestone\(b\.milestone,\s*today\)/);
  const visits = readFileSync(new URL('../app/api/field-teams/route.ts', import.meta.url), 'utf8');
  assert.match(visits, /validFieldVisit\(visit,\s*southAfricanTodayISODate\(instant\)\)/);
  const gardens = readFileSync(new URL('../app/api/production-sites/route.ts', import.meta.url), 'utf8');
  assert.match(gardens, /validProductionSite\(body\.site,\s*southAfricanTodayISODate\(instant\)\)/);
});
