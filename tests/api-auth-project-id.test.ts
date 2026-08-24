// The paid-API guard must be able to VERIFY a token, not merely to deny one.
//
// `lib/api-auth.ts` used to call `initializeApp()` with no argument. That resolves the Firebase
// project from Application Default Credentials or the GCP metadata server; this app runs on Vercel,
// which has neither, and no service account is configured (checked: `vercel env ls` lists no
// GOOGLE_APPLICATION_CREDENTIALS and the repo has no credential wiring at all). The SDK therefore
// threw "Unable to detect a Project Id in the current environment." on the FIRST line of
// verification, before the token was examined. The throw is caught and converted to
// `unauthorised()`, so with REQUIRE_API_AUTH=1 every request 401s — a valid farmer's included.
//
// WHY THIS NEEDED ITS OWN TEST. The obvious verification cannot see the bug. An anonymous request
// is supposed to 401, so "denies anonymous callers" passes identically whether the verifier works
// or is dead on its feet. The only distinguishing question is what happens to a token that SHOULD
// pass, and that is what this file asks: run the real Admin SDK and assert the failure it reports
// is about the TOKEN, never about the environment.
//
// Comments are stripped before the source scan below, so this paragraph cannot satisfy it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const ROOT = join(import.meta.dirname, '..');

/** An RS256 JWT that is structurally valid and cryptographically worthless. */
const BOGUS_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJzdWIiOiJ0ZXN0In0.not-a-real-signature';

const ENVIRONMENT_FAILURE = /Project Id|default credentials|GOOGLE_APPLICATION_CREDENTIALS/i;

test('the Admin SDK reaches token validation without ambient GCP credentials', async () => {
  // A distinct app name per run: firebase-admin throws on duplicate names.
  const app = initializeApp({ projectId: 'fieldproof-sa' }, `guard-probe-${process.pid}`);

  await assert.rejects(
    () => getAuth(app).verifyIdToken(BOGUS_TOKEN),
    (error: Error) => {
      assert.doesNotMatch(
        error.message,
        ENVIRONMENT_FAILURE,
        'verification died on environment resolution, not on the token — every signed-in user would 401',
      );
      // Having got past the environment, it must reject this token on its merits.
      assert.match(
        error.message,
        /aud|audience|iss|issuer|signature|decod/i,
        `expected a token-level rejection, got: ${error.message}`,
      );
      return true;
    },
  );
});

test('lib/api-auth.ts passes an explicit projectId to initializeApp', () => {
  const src = readFileSync(join(ROOT, 'lib', 'api-auth.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  assert.doesNotMatch(
    src,
    /initializeApp\(\s*\)/,
    'initializeApp() with no argument cannot resolve a project on Vercel — pass projectId explicitly',
  );
  assert.match(
    src,
    /initializeApp\(\s*\{[^}]*projectId/,
    'the admin app must be initialised with an explicit projectId',
  );
  assert.match(
    src,
    /NEXT_PUBLIC_FIREBASE_PROJECT_ID/,
    'the project id must fall back to the one env var that is actually set in every environment',
  );
});
