import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// This is deliberately an in-memory transport, not a Firestore behavioural mock. The failure is
// about the payload `pushShapes` supplies to setDoc: a browser can legitimately build it from the
// last listener snapshot while a newer snapshot is still queued for delivery.
type StoredDoc = Record<string, unknown>;
const state = { docs: new Map<string, StoredDoc>() };

const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

const fakeFirestoreModule = moduleUrl(`
const state = globalThis.__imbewuShapeSyncLossState;
export const doc = (_db, ...parts) => parts.join('/');
export const setDoc = async (ref, data) => state.docs.set(ref, structuredClone(data));
export const serverTimestamp = () => 'SERVER_TIMESTAMP';
export const getDoc = async () => { throw new Error('not used by pushShapes'); };
export const onSnapshot = () => () => {};
export const runTransaction = async () => { throw new Error('not used by pushShapes'); };
`);

const fakeFirebaseInitModule = moduleUrl(`
export const getFirebase = () => ({ db: {}, auth: { currentUser: { uid: 'farmer' } } });
`);

Object.assign(globalThis, { __imbewuShapeSyncLossState: state });

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromUserSync = context.parentURL?.includes('/lib/user-sync.ts') ?? false;
    if (fromUserSync && specifier === 'firebase/firestore') {
      return { url: fakeFirestoreModule, shortCircuit: true };
    }
    if (fromUserSync && specifier === './firebase/init') {
      return { url: fakeFirebaseInitModule, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { pushShapes } = await import('../lib/user-sync.ts');
hooks.deregister();

type Feature = { id: string };
const collection = (...features: Feature[]) => ({ type: 'FeatureCollection', features });
const shapeIds = (doc: StoredDoc | undefined): string[] => {
  const json = doc?.shapesJson;
  if (typeof json !== 'string') return [];
  const parsed = JSON.parse(json) as { features?: Feature[] };
  return (parsed.features ?? []).map(({ id }) => id);
};

// MARKED todo, NOT SKIPPED, AND NOT DELETED. It states the behaviour we want and does not have,
// so it runs on every CI pass and reports as a known outstanding defect rather than failing the
// build. A permanently red test on main trains everyone to ignore red, and a deleted one loses the
// only executable proof that this race is real. When shapes get stable identities, drop the todo
// flag and this becomes the regression test for the fix.
test('a shape drawn before another browser receives its listener update is not discarded', { todo: 'pushShapes writes the whole collection unconditionally; see docs/SHAPE-SYNC-ANALYSIS-2026-08-10.md' }, async () => {
  state.docs.clear();
  const ref = 'user_map_data/farmer/data/shapes';

  // Both browsers have received the existing drawing. Browser A then draws "a" and its write
  // reaches Firestore, but the realtime event for that write is still in browser B's delivery
  // queue. This is normal asynchronous listener behaviour, not an invented offline API state.
  const deliveredToBoth = collection({ id: 'base' });
  const browserAAfterItsDraw = collection({ id: 'base' }, { id: 'a' });
  const browserBBeforeItsListenerRuns = collection({ id: 'base' }, { id: 'b' });
  state.docs.set(ref, { shapesJson: JSON.stringify(deliveredToBoth) });

  await pushShapes('farmer', browserAAfterItsDraw);
  await pushShapes('farmer', browserBBeforeItsListenerRuns);

  // A listener cannot retroactively add "a" to B's already-sent payload. The current
  // full-collection setDoc leaves only base + b, so this assertion is intentionally red until
  // shape writes have a concurrency-safe merge/conflict protocol.
  assert.deepEqual(shapeIds(state.docs.get(ref)).sort(), ['a', 'b', 'base']);
});
