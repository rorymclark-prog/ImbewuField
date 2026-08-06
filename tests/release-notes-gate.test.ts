// The release-notes gate decides whether `main` is allowed to be green, so when it is wrong it is
// wrong about everything downstream of it. On 6 August it was wrong twice in one day.
//
// FIRST it was unsatisfiable. A squash merge creates a NEW commit, and the note riding inside it
// was necessarily stamped with a sha that predates it, so the note could never cover the commit
// carrying it. `main` went red on six consecutive merges — every one a false alarm — and because
// the rules tests sat downstream of the gate in the same job, they did not run on any of them.
//
// THEN the fix for that was wrong. It tolerated one unnoted commit only when that commit was HEAD
// itself. It passed on its branch and failed the instant it merged: the merge commit touched only
// .github/, scripts/ and docs/, so it never appears in this check at all, which left the tolerated
// commit one place below HEAD and no longer matching. Any docs-only or CI-only commit lands the
// same way.
//
// Both mistakes were invisible to `npm test` because nothing here could build a repository with
// known commits and ask the script what it thought. That is what these tests do. The property is
// COUNT, not position: one unnoted user-facing commit is a note not yet written, wherever it sits;
// two means one was skipped, which is the drift the check exists to stop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(fileURLToPath(new URL('..', import.meta.url)), 'scripts/release-notes-pending.mjs');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** A throwaway repository whose commits we choose, so the gate's answer is a fact and not a guess. */
function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'notes-gate-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  mkdirSync(join(dir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  return dir;
}

/** Commit a file under `path`; returns the short sha. */
function commit(dir: string, path: string, body: string, subject: string): string {
  writeFileSync(join(dir, path), body);
  git(dir, ['add', path]);
  git(dir, ['commit', '-q', '-m', subject]);
  return git(dir, ['rev-parse', '--short', 'HEAD']);
}

/**
 * Point the notes file at `sha` and commit that too — exactly what a branch does before merging.
 * `nonce` only keeps the file contents distinct so git has something to commit when the same sha
 * is stamped twice; the gate never reads it.
 */
function stampNotes(dir: string, sha: string, nonce = ''): void {
  const body = `export const RELEASE_NOTES = [{ sha: '${sha}' }]; // ${nonce}\n`;
  commit(dir, 'lib/release-notes.ts', body, 'notes');
}

function runGate(dir: string): number {
  const r = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    env: { ...process.env, NOTES_REPO_ROOT: dir },
    encoding: 'utf8',
  });
  return r.status ?? -1;
}

test('nothing user-facing since the note: the banner is telling the truth', () => {
  const dir = repo();
  try {
    const base = commit(dir, 'app/page.tsx', 'v1', 'first screen');
    stampNotes(dir, base);
    commit(dir, 'docs/notes.md', 'docs only', 'write some docs');
    assert.equal(runGate(dir), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one unnoted commit passes when it is HEAD — the squash-merge case', () => {
  const dir = repo();
  try {
    const base = commit(dir, 'app/page.tsx', 'v1', 'first screen');
    stampNotes(dir, base);
    commit(dir, 'app/page.tsx', 'v2', 'change a screen');
    assert.equal(runGate(dir), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// THIS IS THE ONE THAT WOULD HAVE CAUGHT THE 6 AUGUST REGRESSION.
test('one unnoted commit still passes once a CI-only commit lands on top of it', () => {
  const dir = repo();
  try {
    const base = commit(dir, 'app/page.tsx', 'v1', 'first screen');
    stampNotes(dir, base);
    commit(dir, 'app/page.tsx', 'v2', 'change a screen');
    // A merge that touches only CI and docs. It is not user-facing, so it never appears in this
    // check — but it does move HEAD, which is what broke the first fix.
    commit(dir, 'docs/CODEX-QUEUE.md', 'queue', 'CI: fix the gate');
    assert.equal(runGate(dir), 0, 'a docs-only commit on top must not turn a tolerated lag into a failure');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('two unnoted commits fail — this is the drift the check exists to stop', () => {
  const dir = repo();
  try {
    const base = commit(dir, 'app/page.tsx', 'v1', 'first screen');
    stampNotes(dir, base);
    commit(dir, 'app/page.tsx', 'v2', 'change a screen');
    commit(dir, 'app/other.tsx', 'v1', 'change another screen');
    assert.equal(runGate(dir), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the notes file changing is not itself news', () => {
  const dir = repo();
  try {
    const base = commit(dir, 'app/page.tsx', 'v1', 'first screen');
    stampNotes(dir, base);
    // Two more notes-only commits under lib/. If these counted, every branch that wrote a note
    // twice would fail for having written notes.
    stampNotes(dir, base, 'second');
    stampNotes(dir, base, 'third');
    assert.equal(runGate(dir), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
