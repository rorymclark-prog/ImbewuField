import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// bug-09: createUserWithEmailAndPassword() cannot be re-run for the same email once it has
// succeeded — a retry after that point fails with "email already in use", with no way back in
// except support. So a failure in the profile write that follows account creation must never be
// reported as a failed sign-up; it must instead be recovered the next time the app loads.
// Static source checks (not a full Firebase mock) because the meaningful guarantee here is in
// the control flow around already-committed side effects, not in a value a render could assert.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('a failed profile write during sign-up is not reported as a failed sign-up', () => {
  const auth = source('../lib/auth.tsx');
  const signUpStart = auth.indexOf('const signUp = useCallback(async (');
  const signUpEnd = auth.indexOf('\n  }, [syncProfile]);', signUpStart);
  const signUpBody = auth.slice(signUpStart, signUpEnd);
  assert.ok(signUpStart > 0 && signUpEnd > signUpStart, 'signUp must still exist in its expected shape');

  // The account-creating call and the profile-writing calls must not share one try/catch whose
  // catch reports friendlyAuthError() — that was the regression: a rejected updateMyProfile()
  // after the account already existed surfaced as "sign-up failed".
  assert.match(signUpBody, /await createUserWithEmailAndPassword\(/, 'signUp must still create the account');
  const createIndex = signUpBody.indexOf('await createUserWithEmailAndPassword(');
  const innerTryIndex = signUpBody.indexOf('try {', createIndex);
  const innerCatchIndex = signUpBody.indexOf('} catch (err) {', innerTryIndex);
  assert.ok(innerTryIndex > createIndex && innerCatchIndex > innerTryIndex,
    'the profile-write steps (updateProfile/updateMyProfile) must have their own try/catch, separate from account creation');
  const innerCatchBody = signUpBody.slice(innerCatchIndex, signUpBody.indexOf('\n      }', innerCatchIndex));
  assert.doesNotMatch(innerCatchBody, /friendlyAuthError/,
    'a failed profile write must not be turned into a sign-up error message');
  assert.match(innerCatchBody, /console\.error/, 'a failed profile write must still be logged somewhere');

  // And the function must still resolve to "success" (null) afterwards, not return early from
  // inside that inner catch.
  const afterInnerCatch = signUpBody.slice(signUpBody.indexOf('\n      }', innerCatchIndex));
  assert.match(afterInnerCatch, /return null;/, 'signUp must still report success once the account exists');
});

test('a profile that failed to write during sign-up is retried the next time the app loads', () => {
  const auth = source('../lib/auth.tsx');
  // The onAuthStateChanged handler is what runs on every fresh load/sign-in, including the one
  // immediately after signUp() resolves — so a missing profile doc is recovered right there,
  // the same default-profile write the Google sign-in path already performs for a new user.
  const handlerStart = auth.indexOf('const unsub = onAuthStateChanged(fb.auth, async (firebaseUser) => {');
  const handlerEnd = auth.indexOf('\n    });', handlerStart);
  const handlerBody = auth.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart > 0 && handlerEnd > handlerStart, 'the onAuthStateChanged handler must still exist in its expected shape');

  assert.match(handlerBody, /let nextProfile = firebaseUser \? await getMyProfile\(\) : null;/,
    'nextProfile must be reassignable so a retry can update it');
  assert.match(handlerBody, /if \(firebaseUser && !nextProfile\) \{/,
    'a missing profile (read succeeded, found nothing) must trigger a retry attempt');
  assert.match(handlerBody, /await updateMyProfile\(\{ full_name: firebaseUser\.displayName \?\? '', role: 'farmer', language: 'en' \}\);/,
    'the retry must write the same default-profile shape the Google sign-in path uses for a new user');
  assert.match(handlerBody, /nextProfile = await getMyProfile\(\);/,
    'the retry must re-read the profile it just tried to create, not assume it worked');
});
