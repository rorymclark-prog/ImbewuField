import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

// ── An org-scale audit found two shapes worth pinning so neither quietly comes back ──
//
// 1. N+1: app/mentor/page.tsx loaded a cohort by calling getCourseProgress()/getAssignments()
//    ONCE PER TRAINEE. At a 500-trainee org that is ~1,000 sequential-enough Firestore round
//    trips before the page finishes loading; at 5,000 it is enough to make the page functionally
//    unusable. getCourseProgressForProfiles()/getAssignmentsForProfiles() (lib/db/queries.ts)
//    replace that with a handful of `profile_id IN [...]` queries, chunked at
//    IN_QUERY_CHUNK — Firestore's own hard ceiling on how many values an `in` clause may carry.
//    The first test below proves the chunking arithmetic; the second drives the real functions
//    against a fake Firestore and counts the actual getDocs() calls, so a future edit that
//    "simplifies" the batching back into a per-id loop fails here before it ships.
//
// 2. A rules-shaped bug found while building the fix: getAssignments(profileId) queried
//    `profile_id == X` alone, with no org_id filter. firestore.rules' course_assignments read
//    rule is `owns(resource.data) || (isCourseStaff() && inMyOrg(resource.data))`, and
//    inMyOrg() reads resource.data.org_id — a field the query never constrained. For a mentor
//    reading a TRAINEE's assignments (never their own), Firestore's rule engine cannot prove
//    `inMyOrg()` for every possible result and refuses the whole list. Confirmed against the
//    rules emulator: the profile_id-only shape raises exactly `Property org_id is undefined on
//    object`; adding `where('org_id', '==', me.org_id)` — the same filter getCourseProgress
//    already carried — passes. app/mentor/page.tsx called this wrapped in `.catch(() => [])`,
//    so the failure was invisible: every mentor's assignment column silently read empty.
//
// Both fixes land in the same two functions, so both are pinned from the same file.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ── Fake Firestore: same technique as tests/shape-sync-loss.test.ts ─────────────────────────
 * Intercept the THREE modules lib/db/queries.ts imports that would otherwise touch a real
 * backend, and let everything else it imports (consent/course-enrollment/course-assignments/
 * course-gating/invoices — all pure TS) resolve normally. Everything queries.ts exports, pure
 * helpers like chunkIds included, comes from this one hooked import: Node's module cache is
 * keyed by resolved URL, so a later plain `import '../lib/db/queries.ts'` would just hand back
 * this same already-evaluated instance anyway. */

type FakeDoc = { path: string; data: Record<string, unknown> };
const state = {
  profile: { path: 'profiles/mentor-uid', data: { org_id: 'org-1', role: 'mentor' } } as FakeDoc,
  // collection name -> rows seeded in it
  collections: new Map<string, { id: string; data: Record<string, unknown> }[]>(),
  getDocsCalls: [] as { collectionPath: string; clauses: { field: string; op: string; value: unknown }[] }[],
};

const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

const fakeFirestoreModule = moduleUrl(`
const state = globalThis.__queryScaleProbeState;
export const collection = (_db, path) => ({ __t: 'collection', path });
export const doc = (_db, ...parts) => ({ __t: 'doc', path: parts.join('/') });
export const where = (field, op, value) => ({ __t: 'where', field, op, value });
export const orderBy = (field, dir) => ({ __t: 'orderBy', field, dir });
export const query = (base, ...clauses) => ({ __t: 'query', collectionPath: base.path, clauses });
export const serverTimestamp = () => 'SERVER_TIMESTAMP';
export const writeBatch = () => ({ delete(){}, set(){}, commit: async () => {} });
export const addDoc = async () => ({ id: 'fake-id' });
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const getCountFromServer = async () => ({ data: () => ({ count: 0 }) });
export const getDoc = async (ref) => {
  const found = ref.path === state.profile.path ? state.profile : null;
  return {
    exists: () => found !== null,
    id: found ? found.path.split('/').pop() : '',
    data: () => (found ? found.data : undefined),
  };
};
export const getDocs = async (q) => {
  state.getDocsCalls.push({ collectionPath: q.collectionPath, clauses: q.clauses });
  const rows = state.collections.get(q.collectionPath) ?? [];
  const matches = rows.filter((row) => q.clauses.every((c) => {
    if (c.op === '==') return row.data[c.field] === c.value;
    if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(row.data[c.field]);
    throw new Error('fake Firestore: unsupported operator ' + c.op);
  }));
  return { docs: matches.map((m) => ({ id: m.id, data: () => m.data })) };
};
`);

const fakeFirebaseInitModule = moduleUrl(`
export const getFirebase = () => ({ db: {}, auth: { currentUser: { uid: 'mentor-uid' } } });
`);

const fakeSampleModeModule = moduleUrl(`
export const isSampleMode = () => false;
export const getSandboxProfile = () => null;
export const setSandboxProfile = () => {};
export const getSandboxProduction = () => [];
export const addSandboxProduction = () => {};
export const deleteSandboxProduction = () => {};
export const getSandboxSales = () => [];
export const addSandboxSale = () => {};
export const updateSandboxSale = () => {};
export const deleteSandboxSale = () => {};
export const getSandboxExpenses = () => [];
export const addSandboxExpense = () => {};
export const updateSandboxExpense = () => {};
export const deleteSandboxExpense = () => {};
// isSampleMode() is always false above, so none of these three ever actually run in this test —
// they exist only so lib/db/queries.ts's static import of them (added by PR #383's consent-sandbox
// fix) has something to bind to. A missing export here is a SyntaxError at module load, not a test
// failure, so this list has to track queries.ts's @/lib/sample-mode import line, not just what this
// file's own tests exercise.
export const getSandboxConsent = () => ({});
export const setSandboxConsentScope = () => ({});
export const revokeAllSandboxConsent = () => ({});
`);

Object.assign(globalThis, { __queryScaleProbeState: state });

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromQueries = context.parentURL?.includes('/lib/db/queries.ts') ?? false;
    if (fromQueries && specifier === 'firebase/firestore') {
      return { url: fakeFirestoreModule, shortCircuit: true };
    }
    if (fromQueries && specifier === '@/lib/firebase/init') {
      return { url: fakeFirebaseInitModule, shortCircuit: true };
    }
    if (fromQueries && specifier === '@/lib/sample-mode') {
      return { url: fakeSampleModeModule, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { chunkIds, IN_QUERY_CHUNK, getCourseProgressForProfiles, getAssignmentsForProfiles } =
  await import('../lib/db/queries.ts');
hooks.deregister();

/* ── chunkIds: the arithmetic behind the `in`-query batching ─────────────────────────────── */

test('IN_QUERY_CHUNK matches Firestore\'s documented `in`-clause ceiling', () => {
  // Not "some reasonable batch size" — this exact number is a server-enforced maximum. Raise it
  // and a real 31st-plus id in one chunk throws INVALID_ARGUMENT in production, not in a test.
  assert.equal(IN_QUERY_CHUNK, 30);
});

test('chunkIds never puts more than IN_QUERY_CHUNK ids in one chunk', () => {
  assert.deepEqual(chunkIds([]), []);
  assert.deepEqual(chunkIds(['a']), [['a']]);
  const exactly30 = Array.from({ length: 30 }, (_, i) => `id-${i}`);
  assert.deepEqual(chunkIds(exactly30), [exactly30]);
  const thirtyOne = Array.from({ length: 31 }, (_, i) => `id-${i}`);
  const chunked = chunkIds(thirtyOne);
  assert.equal(chunked.length, 2);
  assert.equal(chunked[0].length, 30);
  assert.equal(chunked[1].length, 1);
  // A 500-farmer org (the scale this audit targets) chunks to ceil(500/30) = 17 queries, not 500.
  const fiveHundred = Array.from({ length: 500 }, (_, i) => `farmer-${i}`);
  assert.equal(chunkIds(fiveHundred).length, 17);
  // Every id is preserved, in order, across chunks — batching must never drop or reorder one.
  assert.deepEqual(chunkIds(fiveHundred).flat(), fiveHundred);
});

/* ── Behavioural: the real functions against a fake Firestore ────────────────────────────── */

function seedProgress(ids: string[]) {
  state.collections.set(
    'course_progress',
    ids.map((id) => ({ id: `p-${id}`, data: { profile_id: id, org_id: 'org-1', module: 'water', done: true } })),
  );
}

test('getCourseProgressForProfiles chunks a 65-trainee cohort into 3 queries, not 65', async () => {
  state.getDocsCalls.length = 0;
  const ids = Array.from({ length: 65 }, (_, i) => `trainee-${i}`);
  // Only every third trainee actually has a progress row — proves absent trainees are
  // simply missing from the result (matching the old per-trainee `?? []` default) rather
  // than the batch silently dropping everyone once one id has no match.
  seedProgress(ids.filter((_, i) => i % 3 === 0));

  const result = await getCourseProgressForProfiles(ids);

  assert.equal(state.getDocsCalls.length, 3, 'ceil(65/30) queries, not one per trainee');
  for (const call of state.getDocsCalls) {
    const inClause = call.clauses.find((c) => c.op === 'in');
    assert.ok(inClause, 'each batched query must carry an `in` clause');
    assert.ok((inClause!.value as unknown[]).length <= 30, 'no chunk may exceed Firestore\'s `in` ceiling');
    // The org_id filter is what makes this shape provable under firestore.rules — see the
    // getAssignments source-shape test below for the same requirement caught failing without it.
    assert.ok(
      call.clauses.some((c) => c.field === 'org_id' && c.op === '==' && c.value === 'org-1'),
      'every chunk must still carry the org_id filter the rules require',
    );
  }
  assert.equal(result['trainee-0']?.[0]?.module, 'water');
  assert.equal(result['trainee-1'], undefined, 'a trainee with no progress rows is absent, not []');
  assert.equal(Object.keys(result).length, Math.ceil(65 / 3));
});

test('getAssignmentsForProfiles queries course_assignments with the same org_id + in shape', async () => {
  state.getDocsCalls.length = 0;
  state.collections.set('course_assignments', []);
  await getAssignmentsForProfiles(['trainee-a', 'trainee-b']);
  assert.equal(state.getDocsCalls.length, 1);
  assert.equal(state.getDocsCalls[0].collectionPath, 'course_assignments');
  assert.ok(state.getDocsCalls[0].clauses.some((c) => c.field === 'org_id' && c.op === '=='));
  assert.ok(state.getDocsCalls[0].clauses.some((c) => c.field === 'profile_id' && c.op === 'in'));
});

/* ── Source-shape: the bug fix, and the call sites that must use the batched form ─────────── */

test('getAssignments (single-profile) still carries the org_id filter its rule requires', () => {
  const src = read('../lib/db/queries.ts');
  const fn = src.slice(src.indexOf('export async function getAssignments('), src.indexOf('export async function getAssignmentsForProfiles('));
  assert.match(fn, /where\('org_id',\s*'==',\s*me\.org_id\)/, 'without this, a mentor reading a trainee\'s assignments is denied by firestore.rules, not merely slow');
});

test('the mentor cohort loader calls the batched functions, not one getCourseProgress()/getAssignments() per trainee', () => {
  const src = read('../app/mentor/page.tsx');
  assert.match(src, /getCourseProgressForProfiles\(/);
  assert.match(src, /getAssignmentsForProfiles\(/);
  assert.doesNotMatch(src, /getCourseProgress\(t\.id\)/, 'the per-trainee N+1 call must not come back');
  assert.doesNotMatch(src, /getAssignments\(t\.id\)/, 'the per-trainee N+1 call must not come back');
});

test('the survey response badge counts server-side instead of fetching every response to read .length', () => {
  const src = read('../app/surveys/page.tsx');
  assert.match(src, /countSurveyResponses\(/);
  assert.doesNotMatch(
    src,
    /listSurveyResponses\(survey\.id\)\.then\(\(rs\) => setResponseCount\(rs\.length\)\)/,
    'a response count must not cost one full document read (free-text answers included) per farmer',
  );
});

test('countSurveyResponses uses an aggregation query, not getDocs(...).length', () => {
  const src = read('../lib/db/queries.ts');
  const fn = src.slice(src.indexOf('export async function countSurveyResponses('), src.indexOf('export async function myRespondedSurveyIds('));
  assert.match(fn, /getCountFromServer\(/);
  assert.doesNotMatch(fn, /getDocs\(/, 'countSurveyResponses must not fall back to fetching full documents');
});
