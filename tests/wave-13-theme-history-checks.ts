import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureWave14StudyCurrent, wave14StudySourceBefore } from './wave-14-study-history-checks.ts';

// Wave 13 (17 Oct 2026, code-01 / dark-02 / desk-09): the Studies page moved its hardcoded
// ink, forest, ochre and water hexes onto the theme tokens (hex and alpha-hex literals became
// var(--…) and color-mix() of those tokens) and the Lima bar moved out of the page flow to the
// end of the page. Wording, markup order and every other byte are unchanged. The WebP layer
// below pins this file byte-exact, so this layer keeps that exact successor as a fixture
// (older owners still see their predecessor through it) and holds the live file to "only
// colour values, whitespace and the Lima bar's position changed" on top of its own pin.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; moved: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-wave-13.tsx.txt',
    beforeSha256: '8ccbf5a6965bd9e0fc872b76f3715a2e3b32bec695bbd1b579e80b7a9c2ddf6b',
    afterSha256: 'f45c2f30b7d00cff3159a6da1792a591f55cfdc5fca38608ae5bedfdcf817ecd',
    afterBytes: 88597,
    moved: ['<LimaBar />'],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved wave 13 predecessor');
  beforeFiles.set(file, before);
}

const COLOUR = /var\(--[a-z0-9-]+\)|rgba\([\d.,\s]+\)|#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b/g;
const MIX = /color-mix\(in srgb, \u25C7 \d+%, transparent\)/g;
const shape = (text: string) => text.split('\n').map(line => line.replace(COLOUR, '\u25C7').replace(MIX, '\u25C7').trim()).filter(Boolean);
/** Every non-blank line survives in order with only its colour literals and surrounding whitespace
 * changed; each named moved line appears exactly once on both sides, anywhere. */
function assertOnlyColourAndWhitespaceChanges(before: Buffer, live: Buffer, moved: string[], label: string) {
  let a = shape(before.toString()), b = shape(live.toString());
  for (const line of moved) {
    assert.equal(a.filter(l => l === line).length, 1, label + ': moved line present once in the predecessor: ' + line);
    assert.equal(b.filter(l => l === line).length, 1, label + ': moved line present once in the successor: ' + line);
    a = a.filter(l => l !== line); b = b.filter(l => l !== line);
  }
  assert.equal(b.length, a.length, label + ': same number of non-blank lines');
  for (let i = 0; i < a.length; i++) assert.equal(b[i], a[i], label + ': line ' + (i + 1) + ' changed beyond its colour values');
}

let lastSuccessfulSignature = '';
export function ensureWave13ThemeCurrent(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  // The newer wave 14 study layer sits on this one: its owned sources are checked and
  // projected to their exact wave 13 successor before this layer's byte-exact pins run.
  ensureWave14StudyCurrent();
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': wave 13 predecessor fixture may not change');
    const live = wave14StudySourceBefore(file, read(file));
    assert.equal(live.length, row.afterBytes, file + ': complete live wave 13 successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live wave 13 successor, including every unlisted byte');
    assertOnlyColourAndWhitespaceChanges(before, live, row.moved, file);
  }
  lastSuccessfulSignature = signature;
}

export function wave13ThemeOwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live wave 13 successor → its exact WebP-layer predecessor; any other bytes pass through. */
export function wave13ThemeSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureWave13ThemeCurrent();
  supplied = wave14StudySourceBefore(file, supplied);
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
