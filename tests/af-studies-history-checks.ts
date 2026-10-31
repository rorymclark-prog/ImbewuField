import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Afrikaans Studies (31 Oct 2026): the Studies page joins Afrikaans to the source-paired regional
// lesson path beside isiXhosa — its draft badge, lesson notice, module-card English source line,
// audio label and image-description label name Afrikaans, and the page carries an Afrikaans
// machine-draft note. The isiXhosa Studies layer pins the page byte-exact, so this layer keeps the
// exact isiXhosa bytes as a fixture (the isiXhosa layer and every older owner see their predecessor
// through it), pins the live file byte-exact itself and holds the named markers that distinguish the two.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-af-studies.tsx.txt',
    beforeSha256: 'd5cdf42e6773cb7d95ed2549a061987ba79a5d59bb4867bd12ef8c9adaf040bf',
    afterSha256: 'c52d56aad09ec88535cbaa6040f8fb37503a1aa217a5ab9dcd579ae8e7d3b558',
    afterBytes: 90939,
    // Present in the isiXhosa file, absent from the Afrikaans one.
    gone: ["const SOURCE_PAIRED_LANGUAGES = new Set(['st', 've', 'ts', 'xh']);", "{regionalDraft && lang !== 've' && lang !== 'xh' && <div"],
    // Absent from the isiXhosa file, present in the Afrikaans one.
    arrived: ["const SOURCE_PAIRED_LANGUAGES = new Set(['st', 've', 'ts', 'xh', 'af']);", "'Unreviewed Afrikaans AI draft.", "<span lang=\"af\">{inlineText(lang, 'Unreviewed Afrikaans machine draft.')}</span>", "lang === 'af' ? 'Afrikaans AI draft · review pending'"],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved Afrikaans Studies predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureAfStudiesCurrent(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': Afrikaans Studies predecessor fixture may not change');
    const live = read(file);
    assert.equal(live.length, row.afterBytes, file + ': complete live Afrikaans Studies successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live Afrikaans Studies successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': Afrikaans Studies removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': Afrikaans Studies successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': Afrikaans Studies marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': Afrikaans Studies successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function afStudiesOwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live Afrikaans Studies successor → its exact isiXhosa Studies predecessor; any other bytes pass through. */
export function afStudiesSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureAfStudiesCurrent();
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
