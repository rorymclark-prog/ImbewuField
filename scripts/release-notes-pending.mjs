#!/usr/bin/env node
// What has shipped to farmers that the update banner has not told them about.
//
// WHY: on 2026-08-02 Rory said the banner "keeps showing me old updates not the new ones". The
// banner was working perfectly — /api/build-info serves the new build's own notes, and the
// component renders them. The notes themselves were the problem: RELEASE_NOTES is written by
// hand, its newest entry was 1 August, and 55 commits touching app/, components/ and lib/ had
// landed since. A whole day of money fixes, sheet fixes and a Mentor privilege hole, invisible.
//
// A build SHA that moves while the notes stand still is worse than no notes at all: the banner
// says "New version a6d035f available" and then lists changes that are not in it. So this script
// makes the gap a one-command question — the same trick as scripts/course-status.mjs and
// scripts/worker-status.mjs. Read the real artefacts; never trust a list to have been updated.
//
// USAGE
//   npm run notes:pending
//
// Exits 1 when there is unwritten work, so it can gate a release if that is ever wanted.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Where a farmer-visible change can come from. Docs, tests, scripts and functions/ are excluded
// on purpose: none of them change what is on the screen in front of someone standing in a field.
const USER_FACING = ['app/', 'components/', 'lib/'];
// The notes file changing is not itself news.
const IGNORE = /^lib\/release-notes\.ts$/;

function sh(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

const source = readFileSync(new URL('../lib/release-notes.ts', import.meta.url), 'utf8');
const shaMatch = source.match(/sha:\s*'([0-9a-f]{7,40})'/);

if (!shaMatch) {
  console.error('\n  No `sha` on the newest RELEASE_NOTES entry — nothing to measure drift from.');
  console.error('  Add one (the newest commit that entry covers) so this check can work.\n');
  process.exit(2);
}

const since = shaMatch[1];

let commits;
try {
  commits = sh(['log', '--format=%h\t%ad\t%s', '--date=short', `${since}..HEAD`, '--', ...USER_FACING]);
} catch {
  console.error(`\n  Cannot read history from ${since} — is that commit in this checkout?\n`);
  process.exit(2);
}

const rows = commits
  ? commits.split('\n').map((l) => l.split('\t')).filter(([sha]) => {
    // Skip commits whose ONLY user-facing file is the notes file itself.
    const files = sh(['show', '--name-only', '--format=', sha]).split('\n').filter(Boolean);
    return files.some((f) => USER_FACING.some((d) => f.startsWith(d)) && !IGNORE.test(f));
  })
  : [];

console.log(`\n  Release notes written at ${since}\n`);

if (rows.length === 0) {
  console.log('  ✓ Nothing user-facing has shipped since. The banner is telling the truth.\n');
  process.exit(0);
}

// ONE COMMIT OF LAG IS TOLERATED, AND ONLY WHEN IT IS HEAD ITSELF.
//
// WHY: made blocking on main (2026-08-03), this check turned main red on six consecutive merges on
// 6 August — every one of them a false alarm. A squash merge creates a NEW commit on main, and the
// note travelling inside it was necessarily stamped with a sha that predates it. So the note can
// never cover the commit that carries it, and the next branch stamps THAT sha and lands another
// unnoted squash. Codex chased its own tail, permanently exactly one commit behind, and the job
// died at this step on every push — which also meant the Firestore rules step below it never ran.
//
// The fix is not to weaken the rule but to state it correctly: what matters is that notes do not
// DRIFT. A note that lands on the next push, minutes later, is not the stale banner Rory complained
// about four times — 55 unnoted commits was. So one commit of lag passes and TWO still fail, which
// is what stops drift from accumulating. Anything older than HEAD is real drift and stays blocking.
const headSha = sh(['rev-parse', 'HEAD']);
if (rows.length === 1 && sh(['rev-parse', rows[0][0]]) === headSha) {
  console.log('  ⚠ 1 commit — HEAD itself — has no note yet:\n');
  console.log(`     ${rows[0][0]}  ${rows[0][1]}  ${rows[0][2]}\n`);
  console.log(`  Tolerated: a squash merge cannot carry a note stamped with its own sha. Stamp the
  next entry with '${sh(['rev-parse', '--short', 'HEAD'])}' and this clears. A SECOND unnoted commit fails.\n`);
  process.exit(0);
}

console.log(`  ⚠ ${rows.length} commit(s) touching app/ components/ lib/ have no farmer-facing note:\n`);
for (const [sha, date, subject] of rows) console.log(`     ${sha}  ${date}  ${subject}`);
console.log(`
  These are commit subjects, written for developers. Do NOT paste them into
  lib/release-notes.ts — rewrite each one that a farmer would actually notice in
  what-you-will-see terms (see the house style at the top of that file), drop the
  ones that are invisible from the field, then stamp the new entry with:

     sha: '${sh(['rev-parse', '--short', 'HEAD'])}'
`);
process.exit(1);
