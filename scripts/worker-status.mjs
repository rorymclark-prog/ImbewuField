#!/usr/bin/env node
// Is the render worker in production actually running the code on main?
//
// WHY: for nine days it was not, and nothing said so. The live runRenderJob was
// built 2026-07-24; ten commits to functions/ landed on main after that,
// including the one that taught the worker the 'implementation' key. Every
// Phasing AI render therefore came back `status: error, error: 'unknown sheet'`
// — which reads as "the app sent a sheet the worker doesn't recognise", i.e. an
// app bug, when the truth was "the worker is nine days old". Meanwhile the
// Deploy Cloud Functions workflow reported success on every run, because it
// warned about the missing credential and skipped rather than failing.
//
// So: ask Google what is deployed, ask git what should be, and print the gap.
// Same discipline as scripts/course-status.mjs — read the real artefacts, never
// a status file that drifts from them.
//
// USAGE
//   npm run worker:status
//
// Needs gcloud, authenticated on project fieldproof-sa. Read-only: it lists
// functions and reads git log. It deploys nothing.

import { execFileSync } from 'node:child_process';

const PROJECT = 'fieldproof-sa';
const FUNCTIONS = ['runRenderJob', 'sweepStaleRenderJobs'];

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let deployed;
try {
  deployed = JSON.parse(
    sh('gcloud', ['functions', 'list', '--project', PROJECT, '--format=json']),
  );
} catch (err) {
  console.error('\n  Could not reach Google Cloud. Is gcloud installed and authenticated?');
  console.error(`  ${String(err.message ?? err).split('\n')[0]}\n`);
  process.exit(2);
}

const byName = new Map(
  deployed.map((f) => [String(f.name).split('/').pop(), f]),
);

console.log(`\n  Render worker — deployed vs. main\n`);

let stale = false;

for (const name of FUNCTIONS) {
  const fn = byName.get(name);
  if (!fn) {
    console.log(`  ${name.padEnd(22)}NOT DEPLOYED`);
    stale = true;
    continue;
  }
  const when = fn.updateTime ?? fn.serviceConfig?.updateTime ?? '';
  console.log(`  ${name.padEnd(22)}${fn.state ?? '?'}   built ${when.slice(0, 16).replace('T', ' ')} UTC`);
}

// The worker is one bundle: any commit touching functions/ after the LAST build
// is code that is on main and not in production.
const newest = FUNCTIONS
  .map((n) => byName.get(n)?.updateTime)
  .filter(Boolean)
  .sort()
  .pop();

if (newest) {
  const since = sh('git', ['log', '--oneline', '--format=%h %ad %s', '--date=short', `--since=${newest}`, '--', 'functions/']);
  const lines = since ? since.split('\n') : [];
  console.log();
  if (lines.length === 0) {
    console.log('  ✓ Nothing in functions/ has changed since the newest deploy.\n');
  } else {
    stale = true;
    console.log(`  ⚠ ${lines.length} commit(s) to functions/ are on main but NOT in production:\n`);
    for (const l of lines) console.log(`     ${l}`);
    console.log('\n  Deploy:  gh workflow run deploy-functions.yml');
    console.log('  Or:      firebase deploy --only functions --project fieldproof-sa\n');
  }
}

process.exit(stale ? 1 : 0);
