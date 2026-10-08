import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = (value: string) => resolve(root, value);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const proofPath = 'docs/study-translation-reviews/study-b-a-c-integration-2026-10-08/composition-proof.json';
const proofBytes = readFileSync(path(proofPath));
assert.equal(sha(proofBytes), '2cb8894994c3b3bdec5d501372525005595362c5d78d0f6ae913cdeb39ea0c62', 'B+A+C full source proof is immutable');
const proof = JSON.parse(proofBytes.toString());
const baBytes = readFileSync(path('docs/study-translation-reviews/study-b-a-integration-2026-10-08/composition-proof.json'));
const cBytes = readFileSync(path('docs/study-translation-reviews/zulu-silent-safety-next-2026-10-08/source-layer-proof.json'));
const bBytes = readFileSync(path('docs/study-translation-reviews/vegetables-two-ordinary-residual-2026-10-08/media-proof.json'));
const aBytes = readFileSync(path('docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/assets/manifest-proof.json'));
assert.equal(sha(baBytes), proof.owners.BAProofSha256, 'original B+A proof is retained exactly');
assert.equal(sha(cBytes), proof.owners.CProofSha256, 'original C proof is retained exactly');
assert.equal(sha(bBytes), proof.owners.BMediaProofSha256, 'B measured-media proof is retained exactly');
assert.equal(sha(aBytes), proof.owners.AManifestProofSha256, 'A measured-media proof is retained exactly');
const ba = JSON.parse(baBytes.toString());
const c = JSON.parse(cBytes.toString());
const b = JSON.parse(bBytes.toString());
const a = JSON.parse(aBytes.toString());

const rowFor = (file: string) => proof.files.find((item: any) => item.path === file);
function snapshot(file: string, phase: string): Buffer {
  const record = rowFor(file)?.snapshots?.[phase];
  assert.ok(record, `${file}/${phase}: full layer snapshot is declared`);
  const bytes = readFileSync(path(record.path));
  assert.equal(bytes.byteLength, record.bytes, `${file}/${phase}: full snapshot size`);
  assert.equal(sha(bytes), record.sha256, `${file}/${phase}: full snapshot digest`);
  return bytes;
}
function removeWorkerOwner(source: string, owner: 'A' | 'B' | 'C'): string {
  const record = proof.workerMigrations[owner];
  const start = source.indexOf(record.marker);
  assert.ok(start >= 0, `${owner}: unique worker migration marker exists`);
  assert.equal(source.indexOf(record.marker, start + record.marker.length), -1, `${owner}: worker marker is unique`);
  const functionStart = source.indexOf(`async function ${record.function}() {`, start);
  assert.ok(functionStart > start, `${owner}: migration follows its marker`);
  const match = source.slice(functionStart).match(new RegExp(`async function ${record.function}\\(\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${owner}: complete migration function is bounded`);
  const prefix = source.slice(0, start);
  assert.ok(prefix.endsWith('\n\n'), `${owner}: exact migration separator is retained`);
  let projected = prefix.slice(0, -2) + source.slice(functionStart + match[0].length);
  assert.equal(projected.split(record.activationCall).length - 1, 1, `${owner}: activation call is unique`);
  projected = projected.replace(record.activationCall, '');
  return projected;
}
function reverseManifestOwners(source: string, retained: Set<'A' | 'B' | 'C'>): string {
  let projected = source;
  for (const owner of ['A', 'B'] as const) {
    if (retained.has(owner)) continue;
    const rows = owner === 'A' ? a.rows : b.assets;
    for (const item of rows) {
      const from = `  '${item.url}': ${item.afterBytes},`;
      const to = `  '${item.url}': ${item.beforeBytes},`;
      assert.equal(projected.split(from).length - 1, 1, `${owner}/${item.url}: measured current row appears once`);
      projected = projected.replace(from, to);
    }
  }
  if (!retained.has('C')) {
    for (const [url, bytes] of Object.entries(c.manifestDelta.added) as [string, number][]) {
      const line = `  '${url}': ${bytes},\n`;
      assert.equal(projected.split(line).length - 1, 1, `C/${url}: only new still row appears once`);
      projected = projected.replace(line, '');
    }
  }
  const entries = [...projected.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, match) => sum + Number(match[1]), 0);
  const summary = `// ${entries.length} files, ${(total / 1024 / 1024).toFixed(1)} MB total.`;
  assert.equal((projected.match(/^\/\/ \d+ files, [\d.]+ MB total\.$/gm) ?? []).length, 1,
    'exactly one deterministic manifest aggregate remains');
  return projected.replace(/^\/\/ \d+ files, [\d.]+ MB total\.$/m, summary);
}

export function ensureStudyBACCompositionCurrent(): void {
  assert.equal(proof.status, 'prepared-unreviewed-B-A-C-full-source-history-proof');
  for (const file of ['app/sw.js/route.ts', 'lib/course-asset-sizes.ts']) {
    const integrated = snapshot(file, 'integrated');
    assert.deepEqual(readFileSync(path(file)), integrated, `${file}: complete integrated live source and every unlisted byte`);
    const phases = ['main69', 'afterB', 'afterA', 'afterC', 'afterAB'];
    for (const phase of phases) snapshot(file, phase);
    const worker = file === 'app/sw.js/route.ts';
    for (const phase of phases) {
      let projected = integrated.toString();
      const retained: Set<'A' | 'B' | 'C'> = phase === 'afterA' ? new Set(['A'])
        : phase === 'afterB' ? new Set(['B'])
        : phase === 'afterC' ? new Set(['C'])
        : phase === 'afterAB' ? new Set(['A', 'B']) : new Set();
      if (worker) {
        for (const owner of ['C', 'A', 'B'] as const) if (!retained.has(owner)) projected = removeWorkerOwner(projected, owner);
      } else projected = reverseManifestOwners(projected, retained);
      assert.deepEqual(Buffer.from(projected), snapshot(file, phase), `${file}: surgical ${phase} projection restores the exact immutable full-file snapshot`);
    }
    if (worker) {
      const activation = integrated.toString().slice(integrated.toString().indexOf("self.addEventListener('activate'"));
      const calls = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
      for (const owner of ['A', 'B', 'C'] as const) assert.equal(calls.filter(name => name === proof.workerMigrations[owner].function).length, 1, `${owner}: one cache migration activation`);
      assert.ok(calls.indexOf(proof.workerMigrations.B.function) < calls.indexOf(proof.workerMigrations.A.function));
      assert.ok(calls.indexOf(proof.workerMigrations.A.function) < calls.indexOf(proof.workerMigrations.C.function));
    } else {
      const entries = [...integrated.toString().matchAll(/^  '([^']+)': (\d+),$/gm)];
      assert.equal(entries.length, proof.manifest.integratedEntryCount, 'all new and existing measured manifest rows remain present');
      assert.equal(new Set(entries.map(match => match[1])).size, entries.length, 'integrated manifest paths are unique');
    }
  }
  // Canonical/source and recorded media owners are outside these source projections.
  assert.equal(sha(readFileSync(path('lib/course-modules.ts'))), 'abfc288afe6715ec7345ec9d35d48faa54580fb73b4cb50ebaa1cf9105a7b397', 'canonical module text and indices remain byte-identical to the shared main source');
}

function project(file: string, bytes: string | Uint8Array, phase: 'afterAB' | 'afterA' | 'afterB' | 'afterC' | 'main69'): string | Uint8Array {
  ensureStudyBACCompositionCurrent();
  const integrated = snapshot(file, 'integrated');
  const expected = snapshot(file, phase);
  const supplied = Buffer.from(bytes);
  if (sha(supplied) === sha(expected)) return bytes;
  assert.equal(sha(supplied), sha(integrated), `${file}: only a byte-exact integrated source may be projected; unknown or corrupted owners are rejected`);
  let restored = supplied.toString();
  const retained: Set<'A' | 'B' | 'C'> = phase === 'afterA' ? new Set(['A'])
    : phase === 'afterB' ? new Set(['B'])
    : phase === 'afterC' ? new Set(['C'])
    : phase === 'afterAB' ? new Set(['A', 'B']) : new Set();
  if (file === 'app/sw.js/route.ts') {
    for (const owner of ['C', 'A', 'B'] as const) if (!retained.has(owner)) restored = removeWorkerOwner(restored, owner);
  } else restored = reverseManifestOwners(restored, retained);
  assert.equal(Buffer.byteLength(restored), expected.byteLength, `${file}: exact ${phase} projected byte size`);
  assert.equal(sha(restored), sha(expected), `${file}: exact ${phase} full-file projected digest`);
  return typeof bytes === 'string' ? restored : Buffer.from(restored);
}

export const studyABCProjectToAB = (file: string, bytes: string | Uint8Array) => project(file, bytes, 'afterAB');
export const studyABCProjectToA = (file: string, bytes: string | Uint8Array) => project(file, bytes, 'afterA');
export const studyABCProjectToB = (file: string, bytes: string | Uint8Array) => project(file, bytes, 'afterB');
export const studyABCProjectToC = (file: string, bytes: string | Uint8Array) => project(file, bytes, 'afterC');
export const studyABCProjectToMain69 = (file: string, bytes: string | Uint8Array) => project(file, bytes, 'main69');
