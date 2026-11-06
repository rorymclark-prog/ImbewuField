import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The provider's seven old-device cases used to disappear from normal CI when
// a machine-specific checkout was absent. Keep its tests and historical writer
// intact, while making their frozen source dependency portable and hash-bound.
const baseline = '5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = fileURLToPath(new URL('./fixtures/shape-sync-old-client-5c/', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const historicalPaths = ['lib/user-sync.ts', 'lib/account-local-storage.ts', 'lib/local-tombstones.ts',
  'lib/sample-mode.ts', 'lib/international/site-context.ts', 'lib/international/place-context-merge.ts', 'lib/site-id.ts'];
assert.equal(manifest.version, 1);
assert.equal(manifest.baseline, baseline);
assert.deepEqual(Object.keys(manifest.files).sort(), [...historicalPaths].sort());
assert.deepEqual(manifest.currentDependencyEdges, { 'lib/sample-mode.ts': ['./demo-farm', './consent'] });

const originalTree = process.env.OLD_CLIENT_TREE;
const explicitTree = typeof originalTree === 'string' && originalTree.length > 0;
const oldRoot = explicitTree ? path.resolve(originalTree) : fixtureRoot;
const virtualUrl = rel => pathToFileURL(path.join(oldRoot, rel)).href;
const oldUrls = new Map(historicalPaths.map(rel => [virtualUrl(rel), rel]));
const payloads = new Map();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const rel of historicalPaths) {
  const pin = manifest.files[rel];
  assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0, `Missing historical byte pin: ${rel}`);
  assert.match(pin.sha256, /^[a-f0-9]{64}$/);
  assert.equal(pin.payload, rel === 'lib/user-sync.ts' ? 'user-sync.ts.txt' : 'verified-current-core');
  // Verify the committed historical payload even when an explicit checkout is
  // requested. An override must itself contain all seven authentic old files.
  const committed = rel === 'lib/user-sync.ts'
    ? readFileSync(path.join(fixtureRoot, 'user-sync.ts.txt'))
    : readFileSync(path.join(repositoryRoot, rel));
  assert.equal(committed.byteLength, pin.bytes, `Historical source size drift: ${rel}`);
  assert.equal(digest(committed), pin.sha256, `Historical source hash drift: ${rel}`);
  const bytes = explicitTree ? readFileSync(path.join(oldRoot, rel)) : committed;
  assert.equal(bytes.byteLength, pin.bytes, `OLD_CLIENT_TREE source size drift: ${rel}`);
  assert.equal(digest(bytes), pin.sha256, `OLD_CLIENT_TREE source hash drift: ${rel}`);
  payloads.set(virtualUrl(rel), bytes.toString('utf8'));
}

const relativeEdges = {
  'lib/user-sync.ts': {
    './sample-mode': 'lib/sample-mode.ts',
    './local-tombstones': 'lib/local-tombstones.ts',
    './account-local-storage': 'lib/account-local-storage.ts',
    './international/site-context': 'lib/international/site-context.ts',
    './international/place-context-merge': 'lib/international/place-context-merge.ts',
  },
  'lib/account-local-storage.ts': {},
  'lib/local-tombstones.ts': {},
  'lib/sample-mode.ts': {},
  'lib/international/site-context.ts': { '../site-id': 'lib/site-id.ts' },
  'lib/international/place-context-merge.ts': { './site-context': 'lib/international/site-context.ts' },
  'lib/site-id.ts': {},
};
const currentEdges = {
  'lib/sample-mode.ts': { './demo-farm': 'lib/demo-farm.ts', './consent': 'lib/consent.ts' },
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    // The unchanged provider registers its own fake SDK/init hook AFTER this
    // one, so it gets first refusal. Reaching here must never call a backend.
    const from = oldUrls.get(context.parentURL);
    if (from) {
      if (specifier === 'firebase/firestore' || specifier === './firebase/init') {
        throw new Error(`Historical test boundary did not intercept ${specifier}`);
      }
      const historical = relativeEdges[from][specifier];
      if (historical) return { url: virtualUrl(historical), shortCircuit: true };
      const current = currentEdges[from]?.[specifier];
      if (current) return { url: pathToFileURL(path.join(repositoryRoot, current)).href, shortCircuit: true };
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        throw new Error(`Unreviewed historical dependency: ${from} -> ${specifier}`);
      }
    }
    if (oldUrls.has(specifier)) return { url: specifier, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (payloads.has(url)) return { format: 'module-typescript', source: payloads.get(url), shortCircuit: true };
    return nextLoad(url, context);
  },
});

// Only this Node test process acquires the default. Keep the loader alive until
// its imported tests finish; runtime imports must not fall through after setup.
process.env.OLD_CLIENT_TREE = oldRoot;
after(() => {
  hooks.deregister();
  if (originalTree === undefined) delete process.env.OLD_CLIENT_TREE;
  else process.env.OLD_CLIENT_TREE = originalTree;
});
await import('./shape-sync-v2-old-client.test.ts');
