import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Wave 25 (w25-03): the service worker's install step also precaches the lazy (next/dynamic) JS and CSS
// chunks the precached pages request after hydration, so Home, /farmer and the rest can open offline from
// a cold cache. The older layers pin app/sw.js/route.ts byte-exact; this layer keeps the exact wave 24 bytes
// as a fixture (older owners still see their predecessor through it) and pins the live file itself.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
type Row = { beforePath: string; beforeSha256: string; afterSha256: string; afterBytes: number; gone: string[]; arrived: string[] };
const files: Record<string, Row> = {
  'app/sw.js/route.ts': {
    beforePath: 'tests/fixtures/sw-route-before-w25-offline.ts.txt',
    beforeSha256: 'd6962bbda0e2568256d611060c4b421a70294a96993f7222900f0e6497eae781',
    afterSha256: '7e817605f2143a2769109e584797ac8bc63ebb2a2600cb7d09254e7859f705e5',
    afterBytes: 136749,
    // Present in the wave 24 file, absent from the wave 25 one.
    gone: ["if (!response.ok) throw new Error('Startup asset unavailable: ' + url);"],
    // Absent from the wave 24 file, present in the wave 25 one.
    arrived: ['async function cacheLazyChunks(cache, assets) {', 'if (withLazy) await cacheLazyChunks(cache, assets)', 'response.body.cancel()'],
  },
};
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(files)) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved wave 25 predecessor');
  beforeFiles.set(file, before);
}

let lastSuccessfulSignature = '';
export function ensureWave25Current(): void {
  const signature = Object.entries(files).flatMap(([file, row]) => [file, row.beforePath]).map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  for (const [file, row] of Object.entries(files)) {
    const before = read(row.beforePath);
    assert.equal(sha(before), row.beforeSha256, file + ': wave 25 predecessor fixture may not change');
    const live = read(file);
    assert.equal(live.length, row.afterBytes, file + ': complete live wave 25 successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live wave 25 successor, including every unlisted byte');
    const a = before.toString(), b = live.toString();
    for (const marker of row.gone) {
      assert.ok(a.includes(marker), file + ': wave 25 removed something the predecessor had: ' + marker);
      assert.ok(!b.includes(marker), file + ': wave 25 successor still carries: ' + marker);
    }
    for (const marker of row.arrived) {
      assert.ok(!a.includes(marker), file + ': wave 25 marker is new, not inherited: ' + marker);
      assert.ok(b.includes(marker), file + ': wave 25 successor carries: ' + marker);
    }
  }
  lastSuccessfulSignature = signature;
}

export function wave25OwnsSource(file: string): boolean {
  return Object.hasOwn(files, file);
}

/** Exact live wave 25 successor → its exact wave 24 predecessor; any other bytes pass through. */
export function wave25SourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = files[file];
  if (!row) return supplied;
  ensureWave25Current();
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
