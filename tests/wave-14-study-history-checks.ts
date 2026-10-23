import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureWave16Current, wave16SourceBefore } from './wave-16-history-checks.ts';

// Wave 14 (17 Oct 2026, study track: code-11 / ux-01 / desk-06 / zu-04 / code-20 + the integrator's
// adoption of the shared language note): the Studies page swaps its three hand-built headers for the
// shared <AppHeader>, hides the tab bar at desktop, renders the one shared <LanguageDraftNote> plus
// the course-specific line instead of a three-sentence note, draws the completed-module tick with the
// Lucide icon instead of a "✓" glyph, gives the guide thumbnails fixed boxes, lifts the 10px English
// source line to 12px, drops font-mono and gives Teach the Teachers isiZulu draft copy. The wave 13
// theme layer below pins this file byte-exact, so this layer keeps that exact successor as a fixture
// (older owners still see their predecessor through it), pins the live file byte-exact itself and
// holds the named markers that distinguish the two.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/student/page.tsx': {
    beforePath: 'tests/fixtures/student-page-before-wave-14.tsx.txt',
    beforeSha256: 'f45c2f30b7d00cff3159a6da1792a591f55cfdc5fca38608ae5bedfdcf817ecd',
    afterSha256: '988a64e10c0dc03e82e736b7b1f7f376c8138b86af8b227594c81993c279d190',
    afterBytes: 87926,
    // Present in the wave 13 successor, absent from the wave 14 one.
    gone: ['APP_HEADER_STYLE', '<MenuButton />', '<SettingsButton />', 'font-mono', 'text-[10px]', '`✓ ${t(\'studentComplete\')}`', '<TabBar />'],
    // Absent from the wave 13 successor, present in the wave 14 one.
    arrived: ['<AppHeader title={t(\'studentMyStudies\')}', '<LanguageDraftNote lang={lang} scope="student" />', '<TabBar hideAtDesktop />', '<Check size={12} aria-hidden />', 'width={160} height={107}', '<DesignDraftCopy en="Teach the Teachers'],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved wave 14 predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureWave14StudyCurrent(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  // The newer wave 16 layer sits on this one: its owned sources are checked and projected to
  // their exact wave 15 bytes before this layer's byte-exact pins run.
  ensureWave16Current();
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': wave 14 predecessor fixture may not change');
    const live = wave16SourceBefore(file, read(file));
    assert.equal(live.length, row.afterBytes, file + ': complete live wave 14 successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live wave 14 successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': wave 14 removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': wave 14 successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': wave 14 marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': wave 14 successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function wave14StudyOwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live wave 14 successor → its exact wave 13 successor; any other bytes pass through. */
export function wave14StudySourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureWave14StudyCurrent();
  supplied = wave16SourceBefore(file, supplied);
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
