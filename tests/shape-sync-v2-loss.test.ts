import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeShapeServer, ids, makeDevice, square } from './shape-sync-v2-fakes.ts';

// THE v2 COUNTERPART of tests/shape-sync-loss.test.ts (which stays, unchanged and `todo`, as the
// OLD-SOURCE red control against lib/user-sync.ts pushShapes). Same ordering, same expectation
// ['a', 'b', 'base'] — but driven through the prototype controller + a deterministic optimistic
// transport. Passing here is NOT proof the production defect is fixed: see GATES.md G1–G7 for what
// must be integrated and verified before the original TODO test may be re-pointed and un-todo'd.

test('v2: a shape drawn before another browser receives its listener update is not discarded', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const B = makeDevice(server, { name: 'B' });

  // Both browsers have the existing drawing.
  A.controller.create(square('base', 30, -29), 'reticle-create');
  await A.controller.flush();
  B.controller.receiveRemote(server.doc);
  assert.deepEqual(ids(B.controller.view()), ['base']);

  // A draws "a" and it reaches the server; B's listener has NOT delivered it yet.
  A.controller.create(square('a', 30.01, -29), 'reticle-create');
  await A.controller.flush();
  assert.deepEqual(ids(B.controller.view()), ['base'], 'B is genuinely stale');

  // B draws "b" from its stale view and flushes.
  B.controller.create(square('b', 30.02, -29), 'reticle-create');
  await B.controller.flush();

  const stored = JSON.parse((server.doc as { stateJson: string }).stateJson);
  const live = Object.values(stored.records as Record<string, { id: string; live: boolean }>).filter((r) => r.live).map((r) => r.id).sort();
  assert.deepEqual(live, ['a', 'b', 'base']);
  assert.deepEqual(ids(B.controller.view()), ['a', 'b', 'base'], 'B adopted the committed union immediately');
  A.controller.receiveRemote(server.doc);
  assert.deepEqual(ids(A.controller.view()), ['a', 'b', 'base']);
});

test('v2: the same ordering when B\'s read happens BEFORE A\'s commit (true race) still keeps both', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const B = makeDevice(server, { name: 'B' });
  A.controller.create(square('base', 30, -29), 'reticle-create');
  await A.controller.flush();
  B.controller.receiveRemote(server.doc);

  A.controller.create(square('a', 30.01, -29), 'reticle-create');
  B.controller.create(square('b', 30.02, -29), 'reticle-create');
  // B's step reads the doc, then A commits before B does: B's commit must fail and its step re-run
  // on the newer state — re-applying B's OP, not re-asserting B's stale view.
  server.beforeCommit = async () => { await A.controller.flush(); };
  await B.controller.flush();

  const bReceipts = server.receipts.slice(-2);
  assert.deepEqual(bReceipts.map((r) => r.committed), [false, true], 'first attempt rejected by the version check, retry committed');
  B.controller.receiveRemote(server.doc);
  A.controller.receiveRemote(server.doc);
  assert.deepEqual(ids(A.controller.view()), ['a', 'b', 'base']);
  assert.deepEqual(ids(B.controller.view()), ['a', 'b', 'base']);
});
