import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenTrainingRoute, hasTrainingFeature, type AppAccess } from '../lib/app-access';

const grant = (tier: AppAccess['tier'], features: AppAccess['features'] = []): AppAccess => ({
  tier, features, org_id: 'act', updated_by: 'sandile', updated_at: '2026-09-27T00:00:00.000Z',
});

test('existing accounts keep current tools until an organisation assigns a training level', () => {
  assert.equal(canOpenTrainingRoute(null, '/farmer'), true);
  assert.equal(hasTrainingFeature(null, 'money_records'), true);
});

test('study access keeps learning open but closes a direct deep link to each advanced area', () => {
  const access = grant('study');
  for (const path of ['/student', '/student/soil-health', '/manual/zu/book', '/account', '/contact']) {
    assert.equal(canOpenTrainingRoute(access, path), true, path);
  }
  for (const path of ['/farmer', '/farmer?openSurvey=1', '/facilitator/crops', '/journal', '/finances', '/design', '/exchange']) {
    assert.equal(canOpenTrainingRoute(access, path), false, path);
  }
});

test('pilot access opens only assigned tools and full access opens all', () => {
  const access = grant('pilot', ['planning', 'field_records']);
  assert.equal(canOpenTrainingRoute(access, '/facilitator/crops'), true);
  assert.equal(canOpenTrainingRoute(access, '/journal'), true);
  assert.equal(canOpenTrainingRoute(access, '/records'), false);
  assert.equal(canOpenTrainingRoute(access, '/farmer'), false);
  assert.equal(canOpenTrainingRoute(grant('full'), '/records'), true);
});
