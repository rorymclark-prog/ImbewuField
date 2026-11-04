import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// bug-09: createUserWithEmailAndPassword() cannot be re-run for the same email once it has
// succeeded — a retry after that point fails with "email already in use", with no way back in
// except support. So a failure in the profile write that follows account creation must never be
// reported as a failed sign-up; it must instead be recovered the next time the app loads.
// Static source checks (not a full Firebase mock) because the meaningful guarantee here is in
// the control flow around already-committed side effects, not in a value a render could assert.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

function callsWithin(node: ts.Node, name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  function visit(child: ts.Node) {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === name) calls.push(child);
    ts.forEachChild(child, visit);
  }
  visit(node); return calls;
}
function expressionPath(expression: ts.Expression): string[] {
  if (ts.isParenthesizedExpression(expression)) return expressionPath(expression.expression);
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) return [...expressionPath(expression.expression), expression.name.text];
  assert.fail('the default name must read the initializing actor’s displayName');
}
function objectProperties(expression: ts.Expression): Map<string, ts.Expression> {
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  assert.ok(ts.isObjectLiteralExpression(expression), 'the default write must expose its explicit payload');
  const properties = new Map<string, ts.Expression>();
  for (const property of expression.properties) {
    assert.ok(ts.isPropertyAssignment(property), 'a spread, accessor or shorthand cannot prove personal-account defaults');
    const name = property.name;
    const key = ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text
      : ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression) ? name.expression.text : null;
    assert.ok(key !== null && !properties.has(key), 'default property names must be explicit and unambiguous');
    properties.set(key, property.initializer);
  }
  return properties;
}
function singleProfileWrite(node: ts.Node): ts.CallExpression {
  const writes = callsWithin(node, 'updateMyProfile');
  assert.equal(writes.length, 1, 'the initialization path must have one identifiable profile write');
  assert.ok(ts.isAwaitExpression(writes[0].parent), 'the initialization must await its profile write');
  assert.equal(writes[0].arguments.length, 1);
  return writes[0];
}
function assertPersonalDefaults(write: ts.CallExpression, actorPath: readonly string[]) {
  const properties = objectProperties(write.arguments[0]);
  assert.deepEqual([...properties.keys()].sort(), ['full_name', 'language', 'org_id', 'role'],
    'default initialization must explicitly state its name, farmer role, language and absent organization');
  const fullName = properties.get('full_name')!;
  assert.ok(ts.isBinaryExpression(fullName) && fullName.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken,
    'a missing display name uses the empty-string nullish fallback');
  assert.deepEqual(expressionPath(fullName.left), [...actorPath, 'displayName'], 'the default name belongs to the initializing actor');
  assert.ok(ts.isStringLiteralLike(fullName.right) && fullName.right.text === '', 'the missing-name fallback must be empty');
  const role = properties.get('role')!, language = properties.get('language')!, organization = properties.get('org_id')!;
  assert.ok(ts.isStringLiteralLike(role) && role.text === 'farmer', 'automatic initialization never grants a privileged role');
  assert.ok(ts.isStringLiteralLike(language) && language.text === 'en', 'the initial language remains English');
  assert.equal(organization.kind, ts.SyntaxKind.NullKeyword, 'an automatic personal profile must explicitly have no organization');
  return { name: 'actor.displayName ?? empty', role: role.text, language: language.text, org_id: null };
}

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
  // Explicit null membership was added to all personal initializers. Compare
  // their meaning rather than pinning the obsolete three-field source spelling.
  const parsed = ts.createSourceFile('auth.tsx', auth, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const observers = callsWithin(parsed, 'onAuthStateChanged'); assert.equal(observers.length, 1);
  const observer = observers[0].arguments[1];
  assert.ok(observer && ts.isArrowFunction(observer), 'the auth observer must expose its retry callback');
  const retryDefaults = assertPersonalDefaults(singleProfileWrite(observer), ['firebaseUser']);
  const redirects = callsWithin(parsed, 'getRedirectResult'); assert.equal(redirects.length, 1);
  const then = redirects[0].parent;
  assert.ok(ts.isPropertyAccessExpression(then) && then.name.text === 'then'
    && ts.isCallExpression(then.parent), 'the Google redirect result must have its own initialization callback');
  const redirect = then.parent.arguments[0]; assert.ok(redirect && ts.isArrowFunction(redirect));
  assert.deepEqual(retryDefaults, assertPersonalDefaults(singleProfileWrite(redirect), ['result', 'user']));
  const popups: ts.VariableDeclaration[] = [];
  function findPopup(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'signInWithGoogle') popups.push(node);
    ts.forEachChild(node, findPopup);
  }
  findPopup(parsed); assert.equal(popups.length, 1);
  const popup = popups[0]; assert.ok(popup.initializer, 'the Google popup path must remain independently checked');
  assert.deepEqual(retryDefaults, assertPersonalDefaults(singleProfileWrite(popup.initializer), ['cred', 'user']));
  assert.match(handlerBody, /nextProfile = await getMyProfile\(\);/,
    'the retry must re-read the profile it just tried to create, not assume it worked');
});

function syntheticWrite(payload: string) {
  const parsed = ts.createSourceFile('default-control.ts', `async function initialize() { await updateMyProfile(${payload}); }`, ts.ScriptTarget.Latest, true);
  return singleProfileWrite(parsed);
}

test('the semantic default contract accepts equivalent formatting but rejects affiliation, privilege or altered name fallback', () => {
  assertPersonalDefaults(syntheticWrite(`{
    'org_id': null, language: "en", 'full_name': firebaseUser.displayName ?? "", role: "farmer"
  }`), ['firebaseUser']);
  const invalidPayloads = [
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'en' }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'en', org_id: 'tenant' }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'en', org_id: undefined }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'admin', language: 'en', org_id: null }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'mentor', language: 'en', org_id: null }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'zu', org_id: null }`,
    `{ full_name: anotherUser.displayName ?? '', role: 'farmer', language: 'en', org_id: null }`,
    `{ full_name: firebaseUser.displayName || '', role: 'farmer', language: 'en', org_id: null }`,
    `{ full_name: firebaseUser.displayName ?? 'Unknown', role: 'farmer', language: 'en', org_id: null }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'en', org_id: null, ...externalDefaults }`,
    `{ full_name: firebaseUser.displayName ?? '', role: 'farmer', language: 'en', org_id: null, role: 'admin' }`,
  ];
  for (const payload of invalidPayloads) {
    assert.throws(() => assertPersonalDefaults(syntheticWrite(payload), ['firebaseUser']), assert.AssertionError, payload);
  }
});
