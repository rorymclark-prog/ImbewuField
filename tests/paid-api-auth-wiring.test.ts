// Every client call to a route that SPENDS MONEY must carry the caller's Firebase ID token.
//
// Why this is a source scan and not a behavioural test: `guardPaidApiRequest` is log-only until
// `REQUIRE_API_AUTH` is set (lib/api-auth.ts), and `paidApiHeaders()` returns `{}` when nobody is
// signed in. So a call site with NO token behaves identically to a correctly wired one — right up
// to the moment the switch is flipped, at which point the unwired ones 401 for every real farmer.
// The property is syntactic and invisible at runtime, so it is asserted against the source.
//
// This is the exact hole this test was written for (verified live on production, 2026-08-24):
//   curl -X POST https://imbewufield.vercel.app/api/chat -d '{"messages":[...]}'  ->  200 + a
//   real Claude completion, no account, no token. 18 routes were guarded; 2 call sites sent a
//   token. The guard was real, tested and switched off, and the wiring debt is what made the
//   switch unflippable.
//
// Comments are stripped before scanning, deliberately: the paragraph you are reading mentions
// `paidApiHeaders` and must not be allowed to satisfy the assertion it describes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CLIENT_DIRS = ['app', 'components', 'lib'];

/** Strip // line comments and block comments so prose can never satisfy a check. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Route names under app/api whose handler calls the paid-request guard. */
function guardedRoutes(): Set<string> {
  const guarded = new Set<string>();
  for (const file of walk(join(ROOT, 'app', 'api'))) {
    if (!/[/\\]route\.tsx?$/.test(file)) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!/\b(guardPaidApiRequest|authenticateApiRequest)\s*\(/.test(src)) continue;
    // app/api/foo/bar/route.ts -> "foo/bar"
    guarded.add(
      relative(join(ROOT, 'app', 'api'), file).replace(/[/\\]route\.tsx?$/, '').replace(/\\/g, '/'),
    );
  }
  return guarded;
}

interface CallSite { file: string; route: string; wired: boolean }

function clientCallSites(guarded: Set<string>): CallSite[] {
  const sites: CallSite[] = [];
  for (const dir of CLIENT_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel.startsWith('app/api/')) continue; // server handlers, not callers
      const src = stripComments(readFileSync(file, 'utf8'));
      const re = /(fetch|fieldApi)\(\s*[`'"]\/api\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const route = m[2];
        if (!guarded.has(route)) continue;
        // The token may be spread inline (`...await paidApiHeaders()`) or resolved just before the
        // fetch and threaded in (the .then() chain in LifeGuide), so look both directions.
        const window = src.slice(Math.max(0, m.index - 300), m.index + 400);
        sites.push({ file: rel, route, wired: m[1]==='fieldApi' ? /import\s*\{[^}]*fieldApi[^}]*\}\s*from\s*['"][^'"]*field-api['"]/.test(src) : window.includes('paidApiHeaders') });
      }
    }
  }
  return sites;
}

test('every client call to a money-spending route attaches the caller token', () => {
  const guarded = guardedRoutes();
  assert.ok(guarded.size >= 15, `expected the paid-route guard on many routes, found ${guarded.size}`);

  const sites = clientCallSites(guarded);
  assert.ok(sites.length > 0, 'found no client call sites at all — the scanner is broken, not the code');

  const unwired = sites.filter((s) => !s.wired);
  assert.deepEqual(
    unwired.map((s) => `${s.file} -> /api/${s.route}`),
    [],
    'these call sites would 401 for every signed-in farmer the moment REQUIRE_API_AUTH is set',
  );
});

test('paidApiHeaders actually produces an Authorization header', () => {
  const src = stripComments(readFileSync(join(ROOT, 'lib', 'api-client-auth.ts'), 'utf8'));
  assert.match(src, /Authorization/, 'the helper must set an Authorization header');
  assert.match(src, /Bearer/, 'the guard reads a Bearer token (lib/api-auth.ts)');
  assert.match(src, /getIdToken\(\)/, 'the token must be a live Firebase ID token, not a cached string');
  // Gutting the helper to `return {}` would leave every call site above still "wired" by the
  // scan while sending nothing. This is the second half of the property.
  assert.doesNotMatch(
    src.replace(/if\s*\(!user\)\s*return\s*\{\};?/, ''),
    /^\s*return\s*\{\};?\s*$/m,
    'the only unconditional-empty return allowed is the signed-out branch',
  );
});

test('a route guarded on the server but never called from the client is reported', () => {
  const guarded = guardedRoutes();
  const called = new Set(clientCallSites(guarded).map((s) => s.route));
  const orphans = [...guarded].filter((r) => !called.has(r)).sort();
  // Not a failure: these are deployed, publicly reachable and unreferenced by the UI. They need no
  // wiring — but they are attack surface, so a change in the list should be a deliberate decision.
  assert.deepEqual(orphans, [
    'auto-design',
    // contours IS called from the client (components/Map.tsx, lib/sheet-contours.ts), but neither
    // call site matches this scanner's literal-string-argument pattern: Map.tsx builds the URL in
    // a variable before calling fetch(url), and sheet-contours.ts calls an injected `fetcher(...)`
    // rather than `fetch(...)` directly. Genuinely reachable, invisible to this particular scan.
    'contours',
    'design-detect',
    'design-review',
    // Same shape as contours: OSM Overpass proxy, guarded for cost/quota reasons rather than because
    // a client call was found. No call site exists yet — added ahead of the map feature that will
    // use it, same as the other orphans below.
    'site-features',
    // network/farmers and network/orgs were BOTH listed here while components/network/* still ran
    // on demo data. They are now called by lib/use-network-portfolio.ts from /network, which is
    // the screen the projection was written for, so they have left this list on purpose.
    'suggest-zones-ai',
    'tree-id',
  ], 'the set of deployed-but-uncalled paid routes changed — add or remove one on purpose, not by accident');
});

// Field calls now defer authentication until replay; checking only direct fetch calls
// would silently remove these protected routes from the audit. Verify the shared transport.
test('the device queue authenticates its captured actor again when sending',()=>{
  const source=stripComments(readFileSync(join(ROOT,'lib/field-api.ts'),'utf8'));
  assert.match(source,/await paidApiHeaders\(actor\)/);
  assert.match(source,/headers: \{ \.\.\.headers/);
  assert.match(source,/assertCurrent\(\);\s*if \(controller.signal.aborted\)/);
  assert.match(source,/currentUser\?\.uid !== actor.uid/);
});
