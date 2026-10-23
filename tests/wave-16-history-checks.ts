import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Wave 16 (22 Oct 2026, study-dark track w16-03): category text on the Studies page follows the theme.
// The page imports CATEGORY_TEXT_COLORS from the new lib/category-text-colors.ts (seven
// --cat-<name>-text tokens declared in every theme column of app/globals.css) instead of the light-only
// map in lib/course-modules.ts, which stays byte-identical, and paints its category icons with that
// text-safe colour. Older layers pin the page byte-exact, so this layer keeps the exact wave 15 bytes
// as a fixture (older owners still see their predecessor through it), pins the live file byte-exact
// itself and holds the named markers that distinguish the two.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-wave-16.tsx.txt',
    beforeSha256: '988a64e10c0dc03e82e736b7b1f7f376c8138b86af8b227594c81993c279d190',
    afterSha256: '409bbf272668a9fca892fc7b1970324aa505c41e83210244b4c022bd734b60aa',
    afterBytes: 88037,
    // Present in the wave 15 file, absent from the wave 16 one.
    gone: ['<BookOpen size={24} style={{ color, flexShrink: 0 }} />', '<PlayCircle size={18} style={{ color, flexShrink: 0 }} />', '<ClipboardList size={13} style={{ color, flexShrink: 0 }} />'],
    // Absent from the wave 15 file, present in the wave 16 one.
    arrived: ["import { CATEGORY_TEXT_COLORS } from '@/lib/category-text-colors';", '<BookOpen size={24} style={{ color: textColor, flexShrink: 0 }} />', '<PlayCircle size={18} style={{ color: textColor, flexShrink: 0 }} />', '<ClipboardList size={13} style={{ color: textColor, flexShrink: 0 }} />', '<CheckCircle size={13} style={{ color: textColor, flexShrink: 0 }} />'],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved wave 16 predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureWave16Current(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': wave 16 predecessor fixture may not change');
    const live = read(file);
    assert.equal(live.length, row.afterBytes, file + ': complete live wave 16 successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live wave 16 successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': wave 16 removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': wave 16 successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': wave 16 marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': wave 16 successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function wave16OwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live wave 16 successor → its exact wave 15 predecessor; any other bytes pass through. */
export function wave16SourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureWave16Current();
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
