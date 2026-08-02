#!/usr/bin/env node
// Does the file package.json calls `main` actually exist after a build?
//
// WHY. `tsc` exits 0 whether or not it emitted the entry point where anyone expects it, and
// firebase only notices at the very end of a deploy — where it reports the failure as
// "There was an error reading functions/package.json: functions/lib/index.js does not exist",
// which sends you to look at package.json, which is fine.
//
// What actually happened (found 2026-08-02): functions/src/index.ts imports the app's
// lib/render-difference.ts — the paid-render billing gate, deliberately NOT duplicated here —
// so tsc's inferred common root moved up to the repo root and the entry point moved with it,
// from lib/index.js to lib/functions/src/index.js. Every deploy after that commit was broken.
// Nobody saw it for over a week because deploy-functions.yml was skipping and reporting success
// (see 4181a86), and locally the stale lib/index.js from an earlier build was still lying around,
// so it looked fine on the one machine that mattered. rootDir is now pinned so the layout cannot
// drift again; this check is what makes a future drift fail HERE, in one line, instead of at the
// end of a deploy.

import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const main = pkg.main;
const path = new URL(`./${main}`, import.meta.url);

if (!main) {
  console.error('\n  functions/package.json has no "main" — firebase would not know what to run.\n');
  process.exit(1);
}

if (!existsSync(path)) {
  console.error(`
  Build finished but "main" does not exist: ${main}

  tsc emitted somewhere else. This happens when an import reaches outside functions/src and
  moves the inferred common root — check "rootDir" in functions/tsconfig.json, then point
  "main" at whatever tsc actually produced.
`);
  process.exit(1);
}

console.log(`  functions entry point ok: ${main}`);
