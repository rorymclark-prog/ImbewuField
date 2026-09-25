import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Verified bug: on /surveys, non-staff non-farmer roles (funder, mentor) fell through to the same
// "answer this survey" flow as a farmer, with nothing stopping them submitting a response.
// STAFF_ROLES only ever covered ngo/admin, so `!isStaff` let mentor and funder through too.
// Fixed by gating the answer flow on the roles a survey is meant for — farmer, student, or a
// signed-out participant (role === null, e.g. the sample tour) — with a neutral view for anyone
// else, plus a matching firestore.rules check (tests/firestore-rules.test.ts).

const source = () => readFileSync(new URL('../app/surveys/page.tsx', import.meta.url), 'utf8');

test('the answer flow is gated on farmer/student/signed-out, not just "not staff"', () => {
  const src = source();
  assert.match(src, /const ANSWER_ROLES = new Set\(\['farmer', 'student'\]\)/,
    'the roles a survey is meant for changed shape — re-check the gate below still matches it');
  assert.match(src, /const canAnswer = role === null \|\| ANSWER_ROLES\.has\(role\)/,
    'canAnswer no longer derives from ANSWER_ROLES — mentor/funder could fall through again');
  assert.match(src, /\{!isStaff && canAnswer && \(/,
    'the farmer answer flow (FarmerSurveyCard) is no longer gated by canAnswer');
});

test('mentor and funder land on a neutral view, not the answer flow or the builder', () => {
  const src = source();
  assert.match(src, /\{!isStaff && !canAnswer && \(/,
    'there is no branch left for a signed-in role that is neither staff nor allowed to answer');
  const at = src.indexOf('{!isStaff && !canAnswer && (');
  assert.ok(at > 0, 'could not find the neutral (neither staff nor answerer) branch');
  const block = src.slice(at, at + 700);
  assert.doesNotMatch(block, /FarmerSurveyCard/, 'the neutral branch still renders the answerable survey flow');
  assert.doesNotMatch(block, /SurveyBuilder/, 'the neutral branch still renders the staff builder');
});

test('STAFF_ROLES (the survey builder gate) is unchanged — still ngo/admin only', () => {
  assert.match(source(), /const STAFF_ROLES = new Set\(\['ngo', 'admin'\]\)/,
    'STAFF_ROLES changed — re-check the builder is still never shown to mentor/funder/farmer/student');
});
