import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyABCProjectToAB, ensureStudyBACCompositionCurrent } from './study-b-a-c-source-composition-history-checks.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = (value: string) => resolve(root, value);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const proofPath = 'docs/study-translation-reviews/study-b-a-integration-2026-10-08/composition-proof.json';
const proofBytes = readFileSync(path(proofPath));
assert.equal(sha(proofBytes), '9def43557e73b2bcf892359c0d74c094d15540ed54076333155b443b05cb4ddd', 'B+A full source-composition proof is immutable');
const proof = JSON.parse(proofBytes.toString());
const bMediaBytes = readFileSync(path('docs/study-translation-reviews/vegetables-two-ordinary-residual-2026-10-08/media-proof.json'));
assert.equal(sha(bMediaBytes), proof.sourceOwners.BMediaProofSha256, 'B media owner proof remains immutable');
const bMedia = JSON.parse(bMediaBytes.toString());
const aCompositionBytes = readFileSync(path('docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/main-985-composition/composition-proof.json'));
assert.equal(sha(aCompositionBytes), proof.sourceOwners.ACompositionProofSha256, 'A/main985 source composition owner remains immutable');
const aComposition = JSON.parse(aCompositionBytes.toString());
const aManifestBytes = readFileSync(path('docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/assets/manifest-proof.json'));
assert.equal(sha(aManifestBytes), proof.sourceOwners.AManifestProofSha256, 'A four-card measured manifest owner remains immutable');
const aManifest = JSON.parse(aManifestBytes.toString());

const fileRow = (file: string) => proof.files.find((row: any) => row.path === file);
const snapshot = (row: any, phase: string) => {
  const record = row.snapshots[phase];
  const bytes = readFileSync(path(record.path));
  assert.equal(bytes.byteLength, record.bytes, `${row.path}/${phase}: full source snapshot size`);
  assert.equal(sha(bytes), record.sha256, `${row.path}/${phase}: full source snapshot digest`);
  return bytes;
};

function removeWorkerMigration(source: string, owner: 'A' | 'B'): string {
  const marker = owner === 'B'
    ? '// These two newly reviewed text spans change their paired stills.'
    : '// The 8 October Reading title and Vegetables lightest-action cards refresh four';
  const name = proof.workerMigrations[owner].function;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${owner} worker migration marker is present`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `${owner} worker migration marker is unique`);
  const functionStart = source.indexOf(`async function ${name}() {`, start);
  assert.ok(functionStart > start, `${owner} function follows its unique marker`);
  const match = source.slice(functionStart).match(new RegExp(`async function ${name}\\(\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${owner} migration function is complete`);
  const prefix = source.slice(0, start);
  assert.ok(prefix.endsWith('\n\n'), `${owner} migration has its exact preceding separator`);
  let projected = prefix.slice(0, -2) + source.slice(functionStart + match[0].length);
  const call = proof.workerMigrations[owner].activationCall;
  assert.equal(projected.split(call).length - 1, 1, `${owner} activation call is unique before projection`);
  projected = projected.replace(call, '');
  return projected;
}

function replaceManifestLayer(source: string, owner: 'A' | 'B'): string {
  const rows = owner === 'A' ? aManifest.rows : bMedia.assets;
  let projected = source;
  for (const item of rows) {
    const from = owner === 'A' ? item.afterBytes : item.afterBytes;
    const to = item.beforeBytes;
    const current = `'${item.url}': ${from}`;
    const previous = `'${item.url}': ${to}`;
    assert.equal(projected.split(current).length - 1, 1, `${owner} ${item.url}: exact measured current row is unique`);
    projected = projected.replace(current, previous);
  }
  const entries = [...projected.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, match) => sum + Number(match[1]), 0);
  const summary = `// ${entries.length} files, ${(total / 1024 / 1024).toFixed(1)} MB total.`;
  assert.equal((projected.match(/^\/\/ \d+ files, [\d.]+ MB total\.$/gm) ?? []).length, 1,
    'one deterministic complete-manifest aggregate remains');
  return projected.replace(/^\/\/ \d+ files, [\d.]+ MB total\.$/m, summary);
}

function project(file: string, bytes: string | Uint8Array, target: 'A' | 'B'): string | Uint8Array {
  const row = fileRow(file);
  if (!row) return bytes;
  ensureStudyBACompositionCurrent();
  const raw = Buffer.from(bytes);
  const currentLive = readFileSync(path(file));
  const supplied = sha(raw) === sha(currentLive)
    ? Buffer.from(studyABCProjectToAB(file, raw))
    : raw;
  const integrated = row.snapshots.integrated;
  const expectedTarget = row.snapshots[target === 'A' ? 'afterA' : 'afterB'];
  if (sha(supplied) === expectedTarget.sha256) return bytes;
  if (sha(supplied) !== integrated.sha256) return bytes;
  let restored = supplied.toString();
  restored = file === 'app/sw.js/route.ts'
    ? removeWorkerMigration(restored, target === 'A' ? 'B' : 'A')
    : replaceManifestLayer(restored, target === 'A' ? 'B' : 'A');
  assert.equal(Buffer.byteLength(restored), expectedTarget.bytes, `${file}: projected ${target} source size`);
  assert.equal(sha(restored), expectedTarget.sha256, `${file}: only the opposite reviewed layer projects away to exact ${target} full source`);
  return typeof bytes === 'string' ? restored : Buffer.from(restored);
}

export function studyBAProjectToA(file: string, bytes: string | Uint8Array): string | Uint8Array {
  return project(file, bytes, 'A');
}

export function studyBAProjectToB(file: string, bytes: string | Uint8Array): string | Uint8Array {
  return project(file, bytes, 'B');
}

export function assertStudyBAComposedBytes(file: string, bytes: string | Uint8Array): void {
  const row = fileRow(file);
  assert.ok(row, `${file}: source is owned by the B+A composition proof`);
  const expected = row.snapshots.integrated;
  const projected = Buffer.from(studyABCProjectToAB(file, bytes));
  assert.equal(projected.byteLength, expected.bytes, `${file}: validated current source projects to the complete B+A owner size`);
  assert.equal(sha(projected), expected.sha256, `${file}: complete B+A owner and all unlisted bytes match the immutable proof`);
}

export function ensureStudyBACompositionCurrent(): void {
  assert.equal(proof.status, 'prepared-unreviewed-final-B-A-source-history-proof');
  ensureStudyBACCompositionCurrent();
  for (const row of proof.files) {
    const main = snapshot(row, 'main69');
    const afterB = snapshot(row, 'afterB');
    const afterA = snapshot(row, 'afterA');
    const integrated = snapshot(row, 'integrated');
    const liveAtAB = Buffer.from(studyABCProjectToAB(row.path, readFileSync(path(row.path))));
    assert.equal(sha(liveAtAB), row.snapshots.integrated.sha256, `${row.path}: complete B+A live layer projected from the validated B+A+C source`);
    assertStudyBAComposedBytes(row.path, integrated);
    if (row.path === 'app/sw.js/route.ts') {
      assert.equal(sha(main), aComposition.files[row.path].main837AfterSha256, 'main69 is the exact shared main837/PR985-after worker state');
      const withoutA = removeWorkerMigration(integrated.toString(), 'A');
      assert.equal(sha(withoutA), sha(afterB), 'removing only A from integrated worker exactly restores complete B worker');
      const withoutB = removeWorkerMigration(integrated.toString(), 'B');
      assert.equal(sha(withoutB), sha(afterA), 'removing only B from integrated worker exactly restores complete A worker');
      const names = [...integrated.toString().slice(integrated.toString().indexOf("self.addEventListener('activate'")).matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
      for (const owner of ['A', 'B'] as const) assert.equal(names.filter(name => name === proof.workerMigrations[owner].function).length, 1, `${owner} worker migration runs once`);
      assert.ok(names.indexOf('migrateStIntroRuntimeResidualStills') < names.indexOf('migrateReadingTitleLightestFourStills'), 'PR985 migration stays ahead of A title refresh');
    } else {
      assert.equal(sha(main), aComposition.files[row.path].main837AfterSha256, 'main69 is the exact shared main837/PR985-after manifest');
      const withoutA = replaceManifestLayer(integrated.toString(), 'A');
      assert.equal(sha(withoutA), sha(afterB), 'reversing only A measured rows/aggregate restores complete B manifest');
      const withoutB = replaceManifestLayer(integrated.toString(), 'B');
      assert.equal(sha(withoutB), sha(afterA), 'reversing only B measured rows/aggregate restores complete A manifest');
      const count = [...integrated.toString().matchAll(/^  '[^']+': (\d+),$/gm)].length;
      assert.ok(count > 0, 'integrated generated manifest retains its complete size rows');
    }
  }
}
