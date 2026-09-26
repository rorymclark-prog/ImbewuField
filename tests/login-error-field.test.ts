import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// app/login/page.tsx had two bugs in create-account mode: the email field's error style was
// `inputStyle(!!error && mode !== 'create')`, which is always false while mode === 'create', so
// the email field was NEVER highlighted there — and the password field was highlighted for EVERY
// error (`inputStyle(!!error)`), including ones that had nothing to do with the password (an
// unrecognised email, say). Fixed by mapping each known error message to the field it is actually
// about, and highlighting only that one.

const source = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

test('the old always-false create-mode guard on the email field is gone', () => {
  assert.ok(
    !source.includes("inputStyle(!!error && mode !== 'create')"),
    'the email field must not use a style expression that is always false in create mode',
  );
});

test('the old blanket password highlight is gone', () => {
  assert.ok(
    !source.includes('style={inputStyle(!!error)}'),
    'the password field must not be highlighted for every error regardless of which field it is about',
  );
});

test('each input is highlighted only for errors actually about that field', () => {
  assert.ok(source.includes("style={inputStyle(errorField === 'email')}"), 'the email input must key off errorField');
  assert.ok(source.includes("style={inputStyle(errorField === 'password')}"), 'the password input must key off errorField');
});

test('the field map names a field only for messages actually about that field', () => {
  const start = source.indexOf('const AUTH_ERROR_FIELD');
  assert.ok(start > -1, 'AUTH_ERROR_FIELD map is missing');
  const end = source.indexOf('\n};', start);
  const mapSrc = source.slice(start, end);

  assert.ok(mapSrc.includes("'No account found with that email.': 'email'"));
  assert.ok(mapSrc.includes("'Incorrect password — try again.': 'password'"));
  assert.ok(mapSrc.includes("'Choose a stronger password (at least 6 characters).': 'password'"));

  // Deliberately ambiguous — naming a field here would leak which one was wrong.
  assert.ok(!mapSrc.includes('Email or password is incorrect'));
  // Not field-specific at all (rate limit / config / network messages).
  assert.ok(!mapSrc.includes('Too many attempts'));
  assert.ok(!mapSrc.includes('Network error'));
});
