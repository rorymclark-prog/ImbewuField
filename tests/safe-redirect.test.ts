import assert from 'node:assert/strict';
import test from 'node:test';
import { safeLoginRedirect } from '../lib/safe-redirect.ts';

// bug-13: app/login/page.tsx's `from` deep-link target accepted `//example.com` because
// `fromParam.startsWith('/')` is also true for a protocol-relative URL. safeLoginRedirect is the
// exported helper that replaced the inline check — this pins exactly which inputs it must refuse.

test('a normal same-app path is accepted', () => {
  assert.equal(safeLoginRedirect('/farmer?panel=Water'), '/farmer?panel=Water');
  assert.equal(safeLoginRedirect('/'), '/');
});

test('protocol-relative and backslash-led paths are rejected', () => {
  assert.equal(safeLoginRedirect('//example.com'), null);
  assert.equal(safeLoginRedirect('//evil.com/phish'), null);
  assert.equal(safeLoginRedirect('/\\evil.com'), null);
  assert.equal(safeLoginRedirect('\\\\evil.com'), null);
});

test('an absolute URL or a path containing a backslash anywhere is rejected', () => {
  assert.equal(safeLoginRedirect('https://evil.com'), null);
  assert.equal(safeLoginRedirect('http://evil.com'), null);
  assert.equal(safeLoginRedirect('/farmer\\..\\evil'), null);
});

test('missing or empty values are rejected', () => {
  assert.equal(safeLoginRedirect(null), null);
  assert.equal(safeLoginRedirect(undefined), null);
  assert.equal(safeLoginRedirect(''), null);
});
