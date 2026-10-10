import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const folder = 'docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/main-985-composition/';
const proofBytes = readFileSync(folder + 'composition-proof.json');
const proofSha256 = '4b47e7cf177282f87acbd65e6e7310efc135cb6267e77fb9e6508a7b08505e38';
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
assert.equal(sha(proofBytes), proofSha256, 'immutable exact main837/A composition proof');
const proof = JSON.parse(proofBytes.toString());
const pr985Bytes = readFileSync('docs/study-translation-reviews/st-intro-runtime-residual-2026-10-08/runtime-layer-proof.json');
assert.equal(sha(pr985Bytes), proof.owners.pr985RuntimeLayerProofSha256, 'PR985 owner proof remains exact');
const pr985 = JSON.parse(pr985Bytes.toString());
const lightestManifestBytes = readFileSync('docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/assets/manifest-proof.json');
assert.equal(sha(lightestManifestBytes), '020f98dde5da03597239b56242a1526d3d767147901085877f7f56c0e0292c96', 'four-card manifest source proof remains exact');
const lightestManifest = JSON.parse(lightestManifestBytes.toString());
const watched = new Set(['app/sw.js/route.ts', 'lib/course-asset-sizes.ts']);
const readSnapshot = (path: string) => readFileSync(path);
function validateComposition() {
  const current = new Map<string, Buffer>();
  for (const file of watched) {
    const row = proof.files[file];
    assert.ok(row, `${file}: complete merged source proof exists`);
    const before = readSnapshot(row.beforePath);
    const after = readSnapshot(row.afterPath);
    assert.equal(before.length, row.beforeBytes, `${file}: exact main837 before size`);
    assert.equal(sha(before), row.beforeSha256, `${file}: exact main837 before snapshot`);
    assert.equal(sha(before), row.main837AfterSha256, `${file}: main837 is exactly PR985's full after state`);
    assert.equal(before.length, row.main837AfterBytes, `${file}: main837/PR985 after size`);
    assert.equal(sha(before), pr985[file.startsWith('app/') ? 'worker' : 'manifest'].afterSha256, `${file}: cross-owner exact post985 digest`);
    assert.equal(after.length, row.afterBytes, `${file}: merged current full-file size`);
    assert.equal(sha(after), row.afterSha256, `${file}: immutable merged current full-file digest`);
    const live = readSnapshot(file);
    assert.equal(live.length, row.afterBytes, `${file}: live complete current size`);
    assert.equal(sha(live), row.afterSha256, `${file}: live complete current digest`);
    assert.deepEqual(live, after, `${file}: live whole file retains all source, migration and unlisted bytes`);
    current.set(file, live);
    const older = readSnapshot(row.pr985BeforePath);
    assert.equal(older.length, row.pr985BeforeBytes, `${file}: exact pre-PR985 size`);
    assert.equal(sha(older), row.pr985BeforeSha256, `${file}: immutable pre-PR985 snapshot`);
    assert.equal(sha(older), pr985[file.startsWith('app/') ? 'worker' : 'manifest'].beforeSha256, `${file}: cross-owner exact pre-PR985 digest`);
  }

  const bindingsPath = 'lib/course-deck-release-bindings-data.ts';
  const binding = proof.unchangedMainInputs[bindingsPath];
  const bindings = readSnapshot(bindingsPath);
  assert.equal(bindings.length, binding.bytes, 'complete release-binding registry size');
  assert.equal(sha(bindings), binding.sha256, 'complete release-binding registry equals main837; no target-binding edits');

  const worker = current.get('app/sw.js/route.ts')!.toString();
  const activation = worker.slice(worker.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(migrations.filter(name => name === 'migrateStIntroRuntimeResidualStills').length, 1, 'PR985 migration runs once');
  assert.equal(migrations.filter(name => name === 'migrateReadingTitleLightestFourStills').length, 1, 'A migration runs once');
  assert.ok(migrations.indexOf('migrateStIntroRuntimeResidualStills') < migrations.indexOf('migrateReadingTitleLightestFourStills'), 'migration order follows main837 then A');
  assert.ok(activation.indexOf('migrateReadingTitleLightestFourStills') < activation.indexOf('self.clients.claim()'));
  assert.doesNotMatch(worker.match(/async function migrateReadingTitleLightestFourStills\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '', /\bfetch\s*\(/, 'selective four-card migration never fetches');

  // Reapply only the four independently measured A manifest leaves to the complete
  // main837 snapshot. Every other row and the aggregate must match the composed file.
  const manifestBefore = readSnapshot(proof.files['lib/course-asset-sizes.ts'].beforePath).toString();
  const manifestAfter = current.get('lib/course-asset-sizes.ts')!.toString();
  let expected = manifestBefore;
  assert.equal(lightestManifest.rows.length, 4, 'exactly four measured A manifest rows');
  for (const row of lightestManifest.rows) {
    const oldEntry = `  '${row.url}': ${row.beforeBytes},`;
    const newEntry = `  '${row.url}': ${row.afterBytes},`;
    assert.equal(expected.split(oldEntry).length, 2, `${row.url}: exact main837 predecessor row`);
    expected = expected.replace(oldEntry, newEntry);
  }
  const total = [...expected.matchAll(/^  '[^']+': (\d+),$/gm)].reduce((sum, row) => sum + Number(row[1]), 0);
  expected = expected.replace(/^\/\/ \d+ files, [\d.]+ MB total\.$/m, match => {
    const count = (match.match(/\d+ files/)?.[0] ?? '').split(' ')[0];
    return `// ${count} files, ${(total / 1024 / 1024).toFixed(1)} MB total.`;
  });
  assert.equal(expected, manifestAfter, 'only four A rows and the deterministic aggregate follow exact main837 manifest');
  assert.equal(sha(manifestAfter), proof.files['lib/course-asset-sizes.ts'].afterSha256);

  // The silent pair is a main-owned exact source/target layer, untouched by A.
  const pairPath = 'docs/narration/intro-permaculture.st.silent-draft.json';
  const pair = readSnapshot(pairPath);
  const pairInput = proof.unchangedMainInputs[pairPath];
  assert.equal(pair.length, pairInput.bytes);
  assert.equal(sha(pair), pairInput.sha256);
}

export function readingTitleLightestMain985PostLayerBefore(file: string, supplied: Uint8Array | string): Uint8Array | string {
  if (!watched.has(file)) return supplied;
  validateComposition();
  const row = proof.files[file];
  const before = readSnapshot(row.beforePath);
  const prior = readSnapshot(row.pr985BeforePath);
  const text = Buffer.from(supplied).toString();
  const live = readSnapshot(file).toString();
  if (text === live || text === before.toString()) return typeof supplied === 'string' ? before.toString() : before;
  if (text === prior.toString()) return supplied;
  // Older dated owners pass their own frozen snapshots through this projection.
  // They compare those complete bytes to their immutable claims after this full
  // live-layer validation; do not rewrite or bless those caller values here.
  return supplied;
}

/** Project newest A to exact main837/PR985-after bytes, then PR985 to its immutable older input. */
export function readingTitleLightestThroughMain985Before(file: string, supplied: Uint8Array | string): Uint8Array | string {
  const post985 = readingTitleLightestMain985PostLayerBefore(file, supplied);
  if (!watched.has(file)) return post985;
  validateComposition();
  const row = proof.files[file];
  const post985Text = Buffer.from(post985).toString();
  if (sha(post985Text) !== row.main837AfterSha256 || Buffer.byteLength(post985Text) !== row.main837AfterBytes) return supplied;
  const prior = readSnapshot(row.pr985BeforePath);
  assert.equal(sha(prior), row.pr985BeforeSha256, `${file}: exact pre-PR985 snapshot before older owners`);
  return typeof supplied === 'string' ? prior.toString() : prior;
}
