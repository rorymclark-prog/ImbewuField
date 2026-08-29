// The empty demo that started this: the /partners page and the funder concept note both
// send people to "try the app" via sample mode — and the funders/NGO Gardens tab answered
// with a blank screen. Two independent breaks, both only on production:
//
//   1. /funder and /ngo bounced any user-less visitor to /login whenever a backend was
//      configured. Sample mode has no user BY DESIGN, and production always has a backend,
//      so the demo could never even reach the dashboard.
//   2. NgoDashboard only entered demo mode when getFirebase() returned null (backend
//      unconfigured — never true in production). In sample mode it fell through to
//      listGardens(), which answers [] in the sandbox, and rendered "confirmed empty".
//
// Neither break was visible in local dev without Firebase env vars, where !fb made
// everything demo. That is why this is pinned as source shape: the failing combination
// (backend configured + no user + sample flag) only exists on a real deployment.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/sample-demo-dashboards.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dash = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
const funder = readFileSync(new URL('../app/funder/page.tsx', import.meta.url), 'utf8');
const ngo = readFileSync(new URL('../app/ngo/page.tsx', import.meta.url), 'utf8');
const queries = readFileSync(new URL('../lib/db/queries.ts', import.meta.url), 'utf8');
const cohort = readFileSync(new URL('../components/funder/CohortDashboard.tsx', import.meta.url), 'utf8');

test('NgoDashboard enters demo mode in sample mode, not only when the backend is absent', () => {
  assert.match(dash, /import \{ isSampleMode \} from '@\/lib\/sample-mode';/);
  // The gardens fetch effect: sample mode takes the demo branch before any query runs.
  assert.match(dash, /if \(!fb \|\| isSampleMode\(\)\) \{\s*\n\s*setIsDemo\(true\);/);
  // And auth rehydration is skipped for the demo — nothing to wait for.
  assert.match(dash, /if \(!fb \|\| isSampleMode\(\)\) \{ setAuthReady\(true\); return; \}/);
});

test('the sample gardens live in the component; the query layer stays empty on purpose', () => {
  // listGardens() answering [] in sample mode is CORRECT — an org-scoped Firestore
  // query has no meaning in the sandbox. If you are here because you moved the sample
  // fallback into lib/db/queries.ts: don't. NgoDashboard owns the demo dataset
  // (SAMPLE_GARDENS + seeded gardeners); two sources of sample gardens will drift.
  assert.match(queries, /export async function listGardens\(\): Promise<Garden\[\]> \{\s*\n\s*if \(isSampleMode\(\)\) return \[\];/);
  assert.match(dash, /const SAMPLE_GARDENS: Garden\[\] = \[/);
});

test('/funder and /ngo stay reachable in sample mode instead of bouncing to /login', () => {
  for (const [name, src] of [['funder', funder], ['ngo', ngo]] as const) {
    assert.match(src, /if \(!loading && !user && isLive && !isSampleMode\(\)\) router\.replace\('\/login'\);/,
      `${name}: the login bounce must exempt sample mode`);
  }
});

test('the gardens view is labeled "sample data" in sample mode, hydration-safely', () => {
  for (const [name, src] of [['funder', funder], ['ngo', ngo]] as const) {
    // Badge condition covers both demo causes. Scoped to the gardens view — the cohort
    // view labels itself from portfolio.isDemo, the more exact test for its own read.
    assert.match(src, /\{\(!isLive \|\| sample\) && view === 'gardens' && \(/,
      `${name}: badge must show for sample mode too`);
    // sessionStorage is client-only: the flag must reach render via state set in an
    // effect, never a bare isSampleMode() call in JSX, or hydration disagrees.
    assert.match(src, /const \[sample, setSample\] = useState\(false\);/, `${name}: hydration-safe state`);
    assert.match(src, /useEffect\(\(\) => \{ setSample\(isSampleMode\(\)\); \}, \[\]\);/, `${name}: set from effect`);
  }
});

test('the default cohort view demos off the absence of a user, which covers sample mode', () => {
  // useNetworkPortfolio(live=false) returns the demo portfolio with isDemo: true.
  // Sample mode never has a user, so Boolean(user) is the load-bearing expression:
  // change it to "backend configured" and the funder landing view goes blank in demos.
  assert.match(cohort, /useNetworkPortfolio\(Boolean\(user\)\)/);
});
