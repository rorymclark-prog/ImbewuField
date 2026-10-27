import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { UserFacingError, userFacingMessage } from '../lib/user-facing-error';

const copy: Record<string, string> = {
  networkOffline: 'OFFLINE',
  networkBusy: 'BUSY',
  networkFailed: 'FAILED',
};
const t = (key: string) => copy[key] ?? key;
const firebase = (code: string, message: string) => Object.assign(new Error(message), { name: 'FirebaseError', code });

test('a fetch network failure becomes the shared friendly message', () => {
  for (const message of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
    assert.equal(userFacingMessage(new TypeError(message), 'fallback', t), 'FAILED');
  }
});

test('Firebase errors never show their own wording', () => {
  assert.equal(userFacingMessage(firebase('permission-denied', 'Missing or insufficient permissions.'), 'fallback', t), 'fallback');
  assert.equal(userFacingMessage(firebase('unavailable', '[code=unavailable] The service is unavailable'), 'fallback', t), 'FAILED');
  assert.equal(userFacingMessage(firebase('resource-exhausted', 'Quota exceeded.'), 'fallback', t), 'fallback');
});

test('an unknown error uses the call site fallback', () => {
  // A TypeError from a bug in the app is not a network failure.
  assert.equal(userFacingMessage(new TypeError('x is not a function'), 'fallback', t), 'fallback');
  assert.equal(userFacingMessage(new Error('API error 500'), 'fallback', t), 'fallback');
  assert.equal(userFacingMessage('boom', 'fallback'), 'fallback');
  assert.equal(userFacingMessage(new TypeError('Failed to fetch'), 'fallback'), 'fallback');
});

test('a message the app threw on purpose is shown as written', () => {
  const own = new UserFacingError('That image is too big to store.');
  assert.equal(userFacingMessage(own, 'fallback', t), 'That image is too big to store.');
  assert.equal(userFacingMessage(own, 'fallback'), 'That image is too big to store.');
});

// app/offline/page.tsx and app/account/page.tsx are left out on purpose: the four-language work (#1122)
// pins that an unmapped server line there is shown exactly (tests/offline-ui-localization.test.ts), and
// on Account marked as of unknown language (tests/account-localization.test.ts).
const FILES = [
  'components/EvidenceSheet.tsx', 'app/records/page.tsx',
  'components/studies/PathwayOfflineDownload.tsx', 'components/studies/GuideOfflineDownload.tsx',
  'components/records/ReceiptPreview.tsx', 'components/funder/FunderAssessments.tsx',
  'components/design/DesignAdvisor.tsx', 'components/design/BasePhotoImport.tsx', 'components/SiteDesign.tsx',
  'components/ProductionAreas.tsx', 'components/MelEvidenceReport.tsx', 'components/MelDashboard.tsx',
  'app/invoice/page.tsx',
];

test('no listed screen passes a caught error message straight into a setter', () => {
  for (const file of FILES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /instanceof Error\s*\?\s*\w+\.message\s*:/, `${file} shows a raw error message`);
    assert.doesNotMatch(source, /set\w*(Error|Status|Msg|Message)\(\s*(\(\w+ as Error\)|\w+)\.message\s*\)/, `${file} shows a raw error message`);
    assert.doesNotMatch(source, /\.catch\(\s*\(?\w+\)?\s*=>\s*\{?\s*(if \([^)]*\)\s*)?set\w*\(\w+\.message\)/, `${file} shows a raw error message`);
  }
});

// Review fix: the fieldwork routes write their error bodies as staff copy ("This organisation is
// outside your access.", "Check the site code, date, areas…"); they stay visible rather than
// becoming "check your connection", and a storage failure keeps only the app's own reason.
test('fieldwork API copy is still shown; the storage engine wording is not', () => {
  const api = readFileSync(new URL('../lib/field-api.ts', import.meta.url), 'utf8');
  assert.match(api, /if \(!response\.ok\) throw Object\.assign\(new UserFacingError\(/);
  const core = readFileSync(new URL('../lib/field-api-core.ts', import.meta.url), 'utf8');
  assert.match(core, /function durableError\(error: unknown\) \{ return new UserFacingError\(/);
  assert.match(core, /error instanceof UserFacingError \? error\.message : ''/);
  const funder = readFileSync(new URL('../components/funder/FunderAssessments.tsx', import.meta.url), 'utf8');
  assert.match(funder, /if \(!res\.ok\) throw new UserFacingError\(/);
});
