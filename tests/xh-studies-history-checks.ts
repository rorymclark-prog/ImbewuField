import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// isiXhosa Studies (23 Oct 2026): the Studies page joins isiXhosa to the source-paired regional
// lesson path (Sesotho, Xitsonga, Tshivenda) — its draft badge, notices, module-card English
// source line and image-description label name isiXhosa, and its module cards announce the isiXhosa
// slide cards (lib/course-deck-release-bindings-xh-data.ts). The wave 17 layer pins the page
// byte-exact, so this layer keeps the exact wave 17 bytes as a fixture (the wave 17 layer and every
// older owner see their predecessor through it), pins the live file byte-exact itself and holds the
// named markers that distinguish the two.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-xh-studies.tsx.txt',
    beforeSha256: 'a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272',
    afterSha256: '7e5644602e64bf44427f3c94f9c5ea1c7aed40b61250f0c1885901504387df77',
    afterBytes: 89749,
    // Present in the wave 17 file, absent from the isiXhosa one.
    gone: ["const SOURCE_PAIRED_LANGUAGES = new Set(['st', 've', 'ts']);", "{regionalDraft && lang !== 've' && <div role=\"status\""],
    // Absent from the wave 17 file, present in the isiXhosa one.
    arrived: ["const SOURCE_PAIRED_LANGUAGES = new Set(['st', 've', 'ts', 'xh']);", 'Unreviewed isiXhosa AI draft.', "<span lang=\"xh\">{t('xhosaUiDraftNotice')}</span>", "lang === 'xh' ? 'isiXhosa AI draft · review pending'", "'Slides: isiXhosa AI draft + English source'", "inlineText(lang, 'Loading your account…')"],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved isiXhosa Studies predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureXhStudiesCurrent(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': isiXhosa Studies predecessor fixture may not change');
    const live = read(file);
    assert.equal(live.length, row.afterBytes, file + ': complete live isiXhosa Studies successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live isiXhosa Studies successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': isiXhosa Studies removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': isiXhosa Studies successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': isiXhosa Studies marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': isiXhosa Studies successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function xhStudiesOwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live isiXhosa Studies successor → its exact wave 17 predecessor; any other bytes pass through. */
export function xhStudiesSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureXhStudiesCurrent();
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
