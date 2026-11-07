import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

// This isolates the actual Water phase, not the complete live-history proof.
// Its source/target, frame, ordinary-plan and manifest guards execute unchanged.
// Later residual/media owners are explicit already-validated boundary DTOs;
// their expensive full-inventory verification stays in the existing Water test.
const root = fileURLToPath(new URL('../', import.meta.url));
const helperUrl = new URL('./water-reviewed-deck-history-checks.ts', import.meta.url);
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url));
const ordinaryBytes = read('docs/media/water-ordinary-completion-2026-10-06/frames.json');
assert.equal(hash(ordinaryBytes), 'd62255edf55283e614650a64005e4657b75dc32a3434d6f255a67449a0881ffe');
const ordinary = JSON.parse(ordinaryBytes.toString());
const baselineBytes = read('docs/study-translation-reviews/soil-water-residual-2026-10-06/baseline-before.json');
assert.equal(hash(baselineBytes), '691fa5d8108366d09df19875bc77e01575ca30979fc67cae21ed3dcc39c1cbe7');
const baseline = JSON.parse(baselineBytes.toString());
const soilProof = JSON.parse(read('docs/study-translation-reviews/soil-ordinary-deck-2026-10-06/applied-proof.json').toString());
assert.equal(soilProof.base, 'c5f1771eaa7bb014aefe9a19ba349d149b4b4a57');
const manifest = execFileSync('git', ['cat-file', 'blob', `${soilProof.base}:lib/course-asset-sizes.ts`], { cwd: root, maxBuffer: 1 << 20 }).toString();
assert.equal(hash(manifest), ordinary.integrity.manifestAfterSHA256, 'the stubbed predecessor is an existing immutable Git blob, not a generated fixture');
const legacySource = execFileSync('git', ['cat-file', 'blob', '4c5d1735a86f9e46ce48d0cfa068c80bc4747371:tests/water-reviewed-deck-history-checks.ts'], { cwd: root, maxBuffer: 1 << 20 }).toString();
assert.equal(hash(legacySource), '1d4f9ca9f12b5bcf72c7ccfb7c31c462118a2f1dc1c0289b4cbf534cf713c9e2');
type Language = 'st' | 've' | 'ts';
type Deck = { slides: any[]; [key: string]: any };
type Frame = { asset: string; language: Language; slide: number; old: { sha256: string; bytes: number }; new: { sha256: string; bytes: number } };
const languages: readonly Language[] = ['st', 've', 'ts'];
const frames = ordinary.frames as Frame[];
const byAsset = new Map(frames.map(frame => [frame.asset, frame]));
const deckPath = (language: Language) => `docs/narration/water-harvesting.${language}.paired-draft.json`;
const increment = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
type Probe = ReturnType<typeof probe>;
const probes = new Map<number, Probe>();
const priorGlobal = Object.getOwnPropertyDescriptor(globalThis, '__waterHistoryLanguagePhases');
Object.assign(globalThis, { __waterHistoryLanguagePhases: probes });
let nextId = 0;
function probe(source: string) {
  const deckReads = new Map<string, number>(), ordinaryReads = new Map<string, number>(), planReads = new Map<string, number>();
  const residualCalls = new Map<string, number>(), mediaReads = new Map<string, number>(), bindingVisits = new Map<string, number>();
  const state = {
    source, deckReads, ordinaryReads, planReads, residualCalls, mediaReads, bindingVisits,
    mutateDeck: undefined as undefined | ((deck: Deck, language: Language) => void),
    mutateBinding: undefined as undefined | ((deck: Deck, language: Language) => void),
    mutateBytes: undefined as undefined | ((bytes: Buffer, path: string) => void),
    mutateDescriptor: undefined as undefined | ((descriptor: { sha256: string; bytes: number }, path: string) => void),
    resetCounts() { for (const counts of [deckReads, ordinaryReads, planReads, residualCalls, mediaReads, bindingVisits]) counts.clear(); },
    readFile(path: string | URL, encoding?: BufferEncoding) {
      const file = path instanceof URL ? relative(root, fileURLToPath(path)) : path;
      let bytes: Buffer;
      const language = languages.find(language => file === deckPath(language));
      if (language) {
        increment(deckReads, language);
        const deck = structuredClone(baseline.pairedBefore[file]) as Deck;
        assert.ok(deck, 'the phase uses a real frozen post-ordinary/pre-residual deck');
        state.mutateDeck?.(deck, language); bytes = Buffer.from(JSON.stringify(deck));
      } else if (file === ordinary.integrity.manifestPath) bytes = Buffer.from(manifest);
      else {
        if (byAsset.has(file)) increment(mediaReads, file);
        for (const language of languages) if (file.endsWith(`/${language}-paired-before.json`)) increment(ordinaryReads, language);
        if (file.endsWith('root-reviewed-exact-reuse-plan.json')) increment(planReads, file);
        bytes = read(file);
        if (byAsset.has(file) && state.mutateBytes) { bytes = Buffer.from(bytes); state.mutateBytes(bytes, file); }
      }
      return encoding ? bytes.toString(encoding) : bytes;
    },
    residualPair(deck: Deck, file: string) {
      const language = languages.find(language => file === deckPath(language)); assert.ok(language);
      increment(residualCalls, language);
      const projected = structuredClone(deck);
      // The phase's first result supplies frame bindings; the second call is
      // the unchanged complete ordinary guard's own residual boundary.
      if (residualCalls.get(language)! % 2 === 1) {
        state.mutateBinding?.(projected, language);
        projected.slides = new Proxy(projected.slides, { get(slides, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key)) increment(bindingVisits, `${language}:${Number(key) + 1}`);
          return Reflect.get(slides, key, receiver);
        } });
      }
      return projected;
    },
    residualMedia(path: string) {
      const frame = byAsset.get(path); if (!frame) return null;
      const descriptor = { sha256: frame.new.sha256, bytes: frame.new.bytes };
      state.mutateDescriptor?.(descriptor, path); return descriptor;
    },
    soilManifest(current: string) { assert.equal(current, manifest); return current; },
  };
  return state;
}
const data = (source: string) => ({ shortCircuit: true as const, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (!context.parentURL?.startsWith(helperUrl.href + '?')) return next(specifier, context);
    const id = Number(new URL(context.parentURL).searchParams.get('phase'));
    const prefix = `const p=globalThis.__waterHistoryLanguagePhases.get(${id});`;
    if (specifier === './blind-reviewed-study-corrections-history-checks.ts') return data(prefix + `
      export const withBlindReviewedCorrectionReadScope=fn=>fn();
      export const readBlindReviewedHistoryFile=(...args)=>p.readFile(...args);`);
    if (specifier === './soil-water-residual-history-checks.ts') return data(prefix + `
      export const soilWaterResidualPairedBefore=(...args)=>p.residualPair(...args);
      export const soilWaterResidualMediaBefore=(...args)=>p.residualMedia(...args);`);
    if (specifier === './soil-reviewed-ordinary-history-checks.ts') return data(prefix + `
      export const soilAssetSizesBeforeOrdinary=(...args)=>p.soilManifest(...args);
      export const soilMediaSHAForEarlierProof=()=>{throw Error('outside isolated Water phase');};`);
    if (specifier === './intro-ordinary-media-history-checks.ts') return data(prefix + 'export const introMediaBeforeEarlierProof=()=>{throw Error("outside isolated Water phase");};');
    if (specifier === './vegetables-pest-precision-media-history-checks.ts') return data(prefix + 'export const vegetablesPestPrecisionMediaBeforeEarlierProof=()=>{throw Error("outside isolated Water phase");};');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith(helperUrl.href + '?')) return next(url, context);
    const id = Number(new URL(url).searchParams.get('phase'));
    return { ...next(url, context), source: probes.get(id)!.source };
  },
});
after(() => {
  hooks.deregister(); probes.clear();
  if (priorGlobal) Object.defineProperty(globalThis, '__waterHistoryLanguagePhases', priorGlobal); else Reflect.deleteProperty(globalThis, '__waterHistoryLanguagePhases');
});
async function phase(source = readFileSync(helperUrl, 'utf8')) {
  const id = ++nextId, state = probe(source); probes.set(id, state);
  const url = new URL(helperUrl); url.searchParams.set('phase', String(id));
  const helper = await import(url.href) as { waterMediaBeforeOrdinary: (path: string) => { sha256: string; byteLength: number } };
  return { state, run: () => helper.waterMediaBeforeOrdinary(frames[0].asset) };
}
const countsByLanguage = (counts: Map<string, number>) => Object.fromEntries(languages.map(language => [language, counts.get(language) ?? 0]));
function assertCompletePhase(state: Probe) {
  assert.deepEqual(countsByLanguage(state.deckReads), { st: 1, ve: 1, ts: 1 }, 'read each effective language input once per validation phase');
  assert.deepEqual(countsByLanguage(state.ordinaryReads), { st: 1, ve: 1, ts: 1 }, 'the actual complete ordinary guard still executes for every language');
  assert.equal([...state.planReads.values()].reduce((sum, count) => sum + count, 0), 3);
  assert.deepEqual(countsByLanguage(state.residualCalls), { st: 2, ve: 2, ts: 2 }, 'retain both existing residual guard calls for each language');
  assert.deepEqual([...state.bindingVisits.entries()].sort(), frames.map(frame => [`${frame.language}:${frame.slide}`, 1]).sort(), 'all 27 frame-specific bindings still execute');
  for (const frame of frames) assert.equal(state.mediaReads.get(frame.asset), frame.asset === frames[0].asset ? 2 : 1, 'every actual frame is read; the requested descriptor reads its own bytes again');
}

test('one actual phase validates three complete language decks and all 27 independent frame bindings', async () => {
  const current = await phase(), result = current.run(); assertCompletePhase(current.state);
  assert.equal(result.sha256, frames[0].old.sha256); assert.equal(result.byteLength, frames[0].old.bytes);
});

test('the exact unhoisted predecessor fails the same three-language work contract while retaining every frame binding', async () => {
  const prior = await phase(legacySource); prior.run();
  assert.deepEqual(countsByLanguage(prior.state.deckReads), { st: 8, ve: 9, ts: 10 });
  assert.deepEqual(countsByLanguage(prior.state.residualCalls), { st: 16, ve: 18, ts: 20 });
  assert.equal([...prior.state.bindingVisits.values()].reduce((sum, count) => sum + count, 0), 27);
  assert.throws(() => assertCompletePhase(prior.state), /read each effective language input once/);
});

test('a shared cache key cannot substitute one language for another without failing the actual frame bindings', async () => {
  const source = readFileSync(helperUrl, 'utf8');
  const mutant = source.replace('checkedDecks.get(row.language)', "checkedDecks.get('st')").replace('checkedDecks.set(row.language, beforeResidual)', "checkedDecks.set('st', beforeResidual)");
  assert.notEqual(mutant, source, 'the control must execute a changed cache-key implementation');
  const current = await phase(mutant); assert.throws(() => current.run(), assert.AssertionError);
});

for (const field of ['english', 'target', 'unlisted'] as const) for (const language of languages) {
  test(`${language} ${field} drift still fails the complete ordinary-deck guard`, async () => {
    const current = await phase();
    current.state.mutateDeck = (deck, owner) => {
      if (owner !== language) return;
      if (field === 'english') deck.slides[0].english.heading += ' source control';
      if (field === 'target') deck.slides[0].target.heading.text += ' target control';
      if (field === 'unlisted') deck.unlistedControl = 'must remain absent';
    };
    assert.throws(() => current.run(), /all current accepted ST\/VE35 and TS19/);
  });
}

for (const field of ['english', 'target'] as const) for (const language of languages) {
  test(`${language} last-frame ${field} binding remains checked after its deck has been reused`, async () => {
    const last = frames.filter(frame => frame.language === language).at(-1)!;
    const current = await phase();
    current.state.mutateBinding = (deck, owner) => {
      if (owner !== language) return;
      if (field === 'english') deck.slides[last.slide - 1].english.heading += ' frame control';
      else deck.slides[last.slide - 1].target.heading.text += ' frame control';
    };
    assert.throws(() => current.run(), assert.AssertionError);
    assert.equal(current.state.bindingVisits.get(`${language}:${last.slide}`), 1, 'the adverse check reaches the last frame-specific binding');
  });
}

for (const marker of ['RIFF', 'WEBP'] as const) test(`a bad ${marker} header still fails the actual frame container assertion`, async () => {
  const current = await phase(), last = frames.at(-1)!;
  current.state.mutateBytes = (bytes, path) => { if (path === last.asset) bytes.write('FAIL', marker === 'RIFF' ? 0 : 8, 'ascii'); };
  assert.throws(() => current.run(), assert.AssertionError);
  assert.equal(current.state.mediaReads.get(last.asset), 1);
});

test('an incorrect residual frame descriptor still fails the recorded byte/hash assertion', async () => {
  const current = await phase(); current.state.mutateDescriptor = descriptor => { descriptor.bytes++; };
  assert.throws(() => current.run(), /residual layer must reconstruct this accepted Water size/);
});

test('a failed phase discards its language snapshots and rereads a changed effective source on retry in the same module', async () => {
  const current = await phase(), firstLanguage = frames[0].language;
  const second = frames.find(frame => frame.language !== firstLanguage)!;
  current.state.mutateBytes = (bytes, path) => { if (path === second.asset) bytes.write('FAIL', 0, 'ascii'); };
  assert.throws(() => current.run(), assert.AssertionError);
  assert.equal(current.state.deckReads.get(firstLanguage), 1, 'the failed invocation already validated and stored its first language');
  current.state.resetCounts(); current.state.mutateBytes = undefined;
  current.state.mutateDeck = (deck, language) => { if (language === firstLanguage) deck.slides[0].english.heading += ' changed effective reader'; };
  assert.throws(() => current.run(), /all current accepted ST\/VE35 and TS19/);
  assert.equal(current.state.deckReads.get(firstLanguage), 1, 'a previous failed invocation cannot hide reader changes behind its old snapshot');
  current.state.resetCounts(); current.state.mutateDeck = undefined;
  current.run(); assertCompletePhase(current.state);
});
