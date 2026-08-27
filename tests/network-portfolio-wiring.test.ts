/*
 * THE PORTFOLIO VIEW MUST NOT DRESS A FAILED READ AS DATA.
 *
 * /network shows one person's harvest and income to another person. Two distinct states can put
 * an empty or partial roster on that screen, and they must never be confused:
 *
 *   • SAMPLE MODE — no backend, or nobody signed in. Invented farmers, clearly labelled.
 *   • A FAILED AUTHORISED READ — we asked who this caller may see and did not get an answer.
 *
 * If the second ever falls back to the first, the screen fills with fabricated names and rands at
 * exactly the moment we know least, and it looks indistinguishable from a working portfolio. That
 * is the failure this file exists to prevent. It is a source-shape test rather than a behavioural
 * one because the hook is a React hook over fetch, and the invariant is about which BRANCH may
 * mention the demo constant at all — which is checkable directly and does not rot the way a
 * mocked-fetch test would.
 *
 * Same style as tests/paid-api-auth-wiring.test.ts: read the source, assert on its shape.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const hook = readFileSync(join(ROOT, 'lib/use-network-portfolio.ts'), 'utf8');
const page = readFileSync(join(ROOT, 'app/network/page.tsx'), 'utf8');

/** Strip block and line comments, so a rule is never satisfied (or broken) by prose about it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the demo portfolio is reachable ONLY from the not-live branch, never from an error path', () => {
  const body = code(hook);
  const uses = [...body.matchAll(/DEMO_NETWORK/g)].map((m) => m.index ?? 0);
  // One import, one use. If a third appears, someone has added a fallback.
  assert.equal(uses.length, 2, 'DEMO_NETWORK should appear exactly twice in the hook: the import and the sample-mode return');

  const guard = body.indexOf('if (!live)');
  assert.ok(guard > 0, 'the sample-mode branch `if (!live)` must exist');
  const lastUse = uses[uses.length - 1];
  assert.ok(lastUse > guard, 'the only DEMO_NETWORK value use must sit inside the `if (!live)` branch');

  // And it must not be reachable from either failure path.
  for (const [label, re] of [
    ['a catch block', /catch\s*(\([^)]*\))?\s*\{[^}]*DEMO_NETWORK/],
    ['a non-ok response branch', /!res\.ok[\s\S]{0,400}?DEMO_NETWORK/],
  ] as const) {
    assert.ok(!re.test(body), `DEMO_NETWORK must never be returned from ${label} — an unknown portfolio is not a sample one`);
  }
});

test('an authorised read that fails clears the rows rather than leaving stale ones', () => {
  const body = code(hook);
  // Both failure paths in the farmers effect must reset rows AND the withheld count; a stale
  // roster from a previously-selected org is another way to show the wrong org's people.
  const failures = [...body.matchAll(/setRows\(\[\]\); setWithheld\(0\);/g)];
  assert.ok(failures.length >= 2, 'both the non-ok and the catch path must clear rows and the withheld count');
});

test('/network is gated to the portfolio roles — it reads other people’s money', () => {
  const body = code(page);
  assert.match(body, /canAccessRolePage\(role, NETWORK_ALLOWED_ROLES\)/, '/network must call the shared role gate');
  const set = body.match(/NETWORK_ALLOWED_ROLES = new Set<UserRole>\(\[([^\]]*)\]\)/);
  assert.ok(set, 'NETWORK_ALLOWED_ROLES must be declared as an explicit set');
  const roles = set[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean).sort();
  assert.deepEqual(roles, ['admin', 'funder', 'ngo'],
    'the portfolio view is for programme teams, their funders and admins — a farmer or mentor must not reach it');
});

test('the sample-data label tracks the data, in both directions', () => {
  const body = code(page);
  // Present only when the rows really are invented...
  assert.match(body, /\{portfolio\.isDemo && \(/, 'the "Sample portfolio" pill must be conditional on isDemo');
  // ...and it must not have been made conditional on something merely correlated, like a
  // breakpoint or a loading flag, which was the original bug in the other direction.
  assert.ok(!/hidden md:block[\s\S]{0,200}Sample portfolio/.test(body),
    'the sample label must never be hidden on small screens — that is the size people screenshot');
});
