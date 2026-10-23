import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { xhStudiesSourceBefore } from './xh-studies-history-checks.ts';

// Wave 17 (23 Oct 2026, dark-forest-2 track w17-01): text on a var(--color-forest-800) fill on the
// Studies page uses --on-forest-800 (cream in light, dark ink in dark) instead of plain --on-forest,
// which stays cream on the leaf fill earth dark paints there (1.83:1). The wave 16 layer pins the page
// byte-exact, so this layer keeps the exact wave 16 bytes as a fixture (the wave 16 layer and every
// older owner see their predecessor through it), pins the live file byte-exact itself and holds the
// named markers that distinguish the two. The isiXhosa Studies layer now sits on this one, so the
// live file is read through tests/xh-studies-history-checks.ts and this layer sees its own successor.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-wave-17.tsx.txt',
    beforeSha256: '409bbf272668a9fca892fc7b1970324aa505c41e83210244b4c022bd734b60aa',
    afterSha256: 'a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272',
    afterBytes: 88053,
    // Present in the wave 16 file, absent from the wave 17 one.
    gone: ["color: 'var(--on-forest)'", "color: done ? 'var(--color-forest-800)' : 'var(--on-forest)',"],
    // Absent from the wave 16 file, present in the wave 17 one.
    arrived: ["style={{ background: 'var(--color-forest-800)', color: 'var(--on-forest-800)' }}", "color: done ? 'var(--color-forest-800)' : 'var(--on-forest-800)',", "color: 'var(--on-forest-800)', textDecoration: 'none'"],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved wave 17 predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureWave17Current(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': wave 17 predecessor fixture may not change');
    const live = xhStudiesSourceBefore(file, read(file));
    assert.equal(live.length, row.afterBytes, file + ': complete live wave 17 successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live wave 17 successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': wave 17 removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': wave 17 successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': wave 17 marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': wave 17 successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function wave17OwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live wave 17 successor → its exact wave 16 predecessor; any other bytes pass through. */
export function wave17SourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureWave17Current();
  supplied = xhStudiesSourceBefore(file, supplied);
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
