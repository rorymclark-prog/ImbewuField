import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The dated source owner is exercised in a child with a virtual read view, so
// adverse bytes never touch shared sources, archived evidence or media. Newer
// owners' projection to this dated view remains covered by their release tests.
const child = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = process.cwd();
const absolute = file => resolve(root, file);
const helper = absolute('tests/study-b-a-c-source-composition-history-checks.ts');
const helperURL = pathToFileURL(helper).href;
const proof = JSON.parse(readFileSync(absolute('docs/study-translation-reviews/study-b-a-c-integration-2026-10-08/composition-proof.json'), 'utf8'));
const successorFolder = 'docs/study-translation-reviews/zulu-silent-sentence-repairs-2026-10-08/';
const successor = JSON.parse(readFileSync(absolute(successorFolder + 'successor-proof.json'), 'utf8'));
const overrides = new Map();
const live = new Map();
const reads = new Map();
const counters = { surgical: 0, snapshotChecks: 0, liveChecks: 0, outputChecks: 0 };

// These immutable successor snapshots are the exact dated live bytes that the
// imported history reader supplies after its newer source owners have passed.
for (const row of successor.files) {
  live.set(absolute(row.livePath), readFileSync(absolute(successorFolder + row.after.path)));
}
const supplied = file => Buffer.from(live.get(absolute(file)) ?? readFileSync(absolute(file)));
const state = {
  counters,
  read(file, options) {
    const full = absolute(file instanceof URL ? fileURLToPath(file) : file);
    reads.set(full, (reads.get(full) ?? 0) + 1);
    const bytes = Buffer.from(overrides.get(full) ?? live.get(full) ?? readFileSync(full));
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? bytes.toString(encoding) : bytes;
  },
};
globalThis.__imbewuReconstructionVirtualRead = state;
const virtualReader = 'imbewu-history-test:virtual-blind-reader';
const stub = [
  'const state = globalThis.__imbewuReconstructionVirtualRead;',
  'export const readBlindReviewedHistoryFile = (...args) => state.read(...args);',
  'export const withBlindReviewedCorrectionReadScope = callback => callback();',
  'export const blindReviewedSourceBefore = (file, bytes) => bytes;',
].join('\n');
const counter = name => 'globalThis.__imbewuReconstructionVirtualRead.counters.' + name + '++; ';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === helperURL && specifier === './blind-reviewed-study-corrections-history-checks.ts') {
      return { url: virtualReader, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === virtualReader) return { format: 'module', source: stub, shortCircuit: true };
    if (url !== helperURL) return nextLoad(url, context);
    let source = stripTypeScriptTypes(readFileSync(helper, 'utf8'));
    let surgicalTraces = 0;
    source = source.replace(/function (?:removeWorkerOwner|reverseManifestOwners)\([^)]*\)\s*\{/g, match => {
      surgicalTraces++;
      return match + counter('surgical');
    });
    assert.equal(surgicalTraces, 2, 'trace both actual surgical functions, without replacing their assertions');
    for (const [needle, name] of [
      ['assert.equal(sha(bytes), record.sha256,', 'snapshotChecks'],
      ['assert.deepEqual(live, readFileSync(', 'liveChecks'],
      ['assert.deepEqual(Buffer.from(projected),', 'outputChecks'],
    ]) {
      assert.equal(source.split(needle).length - 1, 1, 'trace a unique actual comparison: ' + name);
      source = source.replace(needle, counter(name) + needle);
    }
    return { format: 'module', source, shortCircuit: true };
  },
});
const history = await import(helperURL);
history.ensureStudyBACCompositionCurrent();
const cold = { ...counters };
assert.ok(cold.surgical > 0, 'the initial successful observation performs actual surgical reconstruction');
history.ensureStudyBACCompositionCurrent();
assert.equal(counters.surgical, cold.surgical, 'a warm observation shares surgical work');
assert.ok(counters.snapshotChecks > cold.snapshotChecks, 'warm reuse still compares freshly read snapshot digests');
assert.ok(counters.liveChecks > cold.liveChecks, 'warm reuse still compares current complete live source bytes');
assert.ok(counters.outputChecks > cold.outputChecks, 'warm reuse still compares complete reconstructed output');
const warmReadCount = [...reads.values()].reduce((sum, count) => sum + count, 0);
const phases = [
  ['main69', 'studyABCProjectToMain69'], ['afterB', 'studyABCProjectToB'],
  ['afterA', 'studyABCProjectToA'], ['afterC', 'studyABCProjectToC'],
  ['afterAB', 'studyABCProjectToAB'],
];
const changedByte = bytes => {
  const result = Buffer.from(bytes);
  result[Math.floor(result.length / 2)] ^= 1;
  assert.equal(result.length, bytes.length, 'the adverse observation preserves byte length');
  return result;
};

for (const row of proof.files) {
  for (const [phase, name] of phases) {
    const input = supplied(row.path);
    const expected = readFileSync(absolute(row.snapshots[phase].path));
    const first = history[name](row.path, input);
    assert.deepEqual(first, expected, row.path + '/' + phase + ': exact predecessor bytes');
    assert.equal(counters.surgical, cold.surgical, 'projector and validator share the same authenticated reconstruction');
    first.fill(0);
    assert.deepEqual(history[name](row.path, input), expected, 'mutating a returned buffer cannot poison later output');
    assert.equal(history[name](row.path, input.toString()), expected.toString(), 'string callers keep their output type');
    const prior = Buffer.from(expected);
    assert.strictEqual(history[name](row.path, prior), prior, 'an exact already-historical caller keeps its original value');
  }
  assert.throws(() => history.studyABCProjectToAB(row.path, changedByte(supplied(row.path))),
    /only a byte-exact integrated source may be projected; unknown or corrupted owners are rejected/,
    row.path + ': warm output never replaces unknown caller bytes');
}

let adverseReads = 0;
function rejectChangedRead(file, message) {
  const full = absolute(file);
  const baseline = supplied(file);
  overrides.set(full, changedByte(baseline));
  try {
    assert.throws(() => history.ensureStudyBACCompositionCurrent(), message,
      file + ': a warm cache must reject changed freshly read bytes');
    adverseReads++;
  } finally {
    overrides.delete(full);
  }
  history.ensureStudyBACCompositionCurrent();
  assert.equal(counters.surgical, cold.surgical, 'restoring valid bytes succeeds without caching any failed observation');
}
for (const row of proof.files) {
  rejectChangedRead(row.path, /the live source equals the exact two-card successor snapshot/);
  rejectChangedRead(row.snapshots.integrated.path, /full snapshot digest/);
  for (const [phase] of phases) rejectChangedRead(row.snapshots[phase].path, /full snapshot digest/);
}
// This helper owns worker/manifest only. Other sentence-repair files belong to
// different history readers, so this test must not claim it validates them.
const ownedSuccessors = successor.files.filter(row => proof.files.some(owner => owner.path === row.livePath));
assert.deepEqual(new Set(ownedSuccessors.map(row => row.livePath)), new Set(proof.files.map(row => row.path)),
  'every source owned here has its successor before/after observations exercised');
for (const row of ownedSuccessors) {
  rejectChangedRead(successorFolder + row.before.path, /complete successor predecessor digest/);
  rejectChangedRead(successorFolder + row.after.path, /the live source equals the exact two-card successor snapshot/);
}
assert.ok([...reads.values()].reduce((sum, count) => sum + count, 0) > warmReadCount,
  'source and snapshot reads remain active throughout warm adverse calls');
assert.ok(adverseReads > 0, 'the negative read observations actually ran');
process.stdout.write(JSON.stringify({ cold, after: counters, adverseReads }));
`;

test('warm historical reconstruction shares surgery while changed live, caller and archived bytes still fail', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', child], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1 << 20,
  });
  const observation = JSON.parse(output);
  assert.equal(observation.after.surgical, observation.cold.surgical);
  assert.ok(observation.after.snapshotChecks > observation.cold.snapshotChecks);
  assert.ok(observation.after.liveChecks > observation.cold.liveChecks);
  assert.ok(observation.after.outputChecks > observation.cold.outputChecks);
  assert.ok(observation.adverseReads > 0);
});
