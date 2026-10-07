import { finalLanguageNextPairedBytesBefore, finalLanguageNextDeckBefore } from './final-language-next-checks.ts';
import { fairSharingNativeBefore } from './intro-fair-sharing-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const dir = 'docs/study-translation-reviews/st-intro-silent-completion-2026-10-06';
const read = (p: string) => readFileSync(p);
const json = (p: string) => JSON.parse(read(p).toString());
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const proof = json(`${dir}/applied-proof.json`);
const packet = json(`${dir}/repaired-candidates.json`);
const rows = packet.actualDeltas as any[];
const liveNative: Record<string, any> = { ve: TSHIVENDA_INTRO_PERMACULTURE_DRAFT, ts: XITSONGA_INTRO_PERMACULTURE_DRAFT };
function nativeBefore(language: string) {
  const code = read(`${dir}/implementation-before/native-before-${language}.ts.txt`).toString();
  const exports = {} as any;
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports[language === 've' ? 'TSHIVENDA_INTRO_PERMACULTURE_DRAFT' : 'XITSONGA_INTRO_PERMACULTURE_DRAFT'];
}
const get = (o: any, path: string) => path.split('/').reduce((v, k) => v[k], o);
const joinTarget = (f: any, source?: string): string => f.status === 'mixed' ? f.segments.map((s: any) => joinTarget(s)).join('') : f.status === 'english-hold' ? f.sourceEnglish ?? f.english ?? source! : f.text;
function validate(native: Record<string, any>, pairs: Record<string, any>) {
  // The later fairness repair must pass its complete-source guard before this dated release is reconstructed.
  native = { ...native, ts: fairSharingNativeBefore(native.ts) };
  // 6 October: full latest39 paired validation precedes this dated60-field release.
  pairs = Object.fromEntries(Object.entries(pairs).map(([language, pair]) => [language, finalLanguageNextDeckBefore(language === 'st' ? proof.outputs.newSilentST.path : proof.outputs.existingPaired[language].path, pair)]));
  assert.equal(sha(read(`${dir}/applied-proof.json`)), '356243b0a456b820208971c4349b893011a018d97e3e45943171152de9bd8d45');
  assert.equal(rows.length, 60);
  assert.equal(new Set(rows.map(r => `${r.language}/${r.fieldLocator}`)).size, 60);
  // 2026-10-06: validate the entire accepted current layer before exposing any archived pair.
  for (const language of ['ve', 'ts']) {
    const before = nativeBefore(language);
    const expected = structuredClone(before);
    for (const row of rows.filter(r => r.language === language && r.fieldLocator.startsWith('lessons/'))) {
      const original = get(before, row.fieldLocator);
      assert.equal(original.sourceEnglish, row.sourceEnglish);
      assert.equal(original[language === 've' ? 'tshivendaDraft' : 'xitsongaDraft'], row.currentTarget);
      const cell = get(expected, row.fieldLocator);
      cell[language === 've' ? 'tshivendaDraft' : 'xitsongaDraft'] = row.fullProposedTarget;
      cell.reviewStatus = 'machine-draft';
    }
    assert.deepEqual(native[language], expected, 'whole native source/status/index/unlisted preservation');
  }
  for (const language of ['st', 've', 'ts']) {
    // Joined prose cannot authorize altered listed status, segmentation or reviewer provenance.
    // These immutable root-accepted file digests bind the complete applied objects first.
    const approved = language === 'st' ? proof.outputs.newSilentST : proof.outputs.existingPaired[language];
    const bytes = Buffer.from(finalLanguageNextPairedBytesBefore(approved.path, read(approved.path)));
    assert.equal(sha(bytes), approved.sha256, 'entire accepted paired output is byte-bound');
    assert.deepEqual(pairs[language], JSON.parse(bytes.toString()), 'listed paired metadata must equal the immutable approved output');
    const before = json(`${dir}/implementation-before/paired-before-${language}.json`);
    const restored = structuredClone(pairs[language]);
    for (const row of rows.filter(r => r.language === language && r.fieldLocator.startsWith('pairedSlides/'))) {
      const m = row.fieldLocator.match(/slides\[n=(\d+)\]\/target\/(heading|body\[(\d+)\])/)!;
      assert.ok(m, 'explicit source position');
      const index = Number(m[1]) - 1;
      const path = m[2] === 'heading' ? `slides/${index}/target/heading` : `slides/${index}/target/body/${m[3]}`;
      const original = get(before, path), actual = get(restored, path);
      const sourcePath = m[2] === 'heading' ? `slides/${index}/english/heading` : `slides/${index}/english/body/${m[3]}`;
      assert.equal(get(before, sourcePath), row.sourceEnglish);
      assert.equal(joinTarget(original, row.sourceEnglish), row.currentTarget);
      assert.equal(get(restored, sourcePath), row.sourceEnglish);
      if (actual.english !== undefined) assert.equal(actual.english, row.sourceEnglish);
      assert.equal(joinTarget(actual), row.fullProposedTarget);
      assert.notEqual(actual.status, 'english-hold');
      assert.notEqual(joinTarget(actual), row.sourceEnglish, 'source identity cannot be a translated draft');
      const keys = path.split('/'); const last = keys.pop()!;
      get(restored, keys.join('/'))[last] = original;
    }
    assert.deepEqual(restored, before, 'all unlisted objects, exact sources, slide order and review status remain frozen');
  }
}
const livePairs = () => Object.fromEntries(['st', 've', 'ts'].map(l => [l, json(`docs/narration/intro-permaculture.${l}.${l === 'st' ? 'silent' : 'paired'}-draft.json`)]));

test('the silent Introduction refresh retires only three replaced stills once, preserving recorded and newly saved media', async () => {
  const source = read('app/sw.js/route.ts').toString();
  const body = source.match(/async function migrateIntroSilentReleaseStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  assert.equal([...activation.matchAll(/\.then\(migrateIntroSilentReleaseStills\)/g)].length, 1);
  assert.ok(activation.indexOf('migrateIntroSilentReleaseStills') < activation.indexOf('self.clients.claim()'));
  const changed = ['/course-decks/intro-permaculture/ve/slide-11.webp', '/course-decks/intro-permaculture/ts/slide-07.webp', '/course-decks/intro-permaculture/ts/slide-12.webp'];
  const retired = changed.flatMap(p => [p, `${p}?saved=old`]);
  const protectedPaths = [
    ...Array.from({ length: 22 }, (_, i) => `/course-decks/intro-permaculture/st-silent/slide-${String(i + 1).padStart(2, '0')}.webp`),
    '/course-audio/intro-permaculture/st/slide-01.mp3',
    '/course-decks/intro-permaculture/st/slide-01.webp',
    '/course-animations/intro-permaculture/example.mp4',
    '/course-decks/intro-permaculture/ts/slide-07.webp.bak',
    '/course-decks/soil-health/ts/slide-04.webp',
  ];
  const origin = 'https://field.test';
  const url = (p: string) => new URL(p, origin).href;
  const rows = new Map([...retired, ...protectedPaths].map(p => [url(p), new Response(p)]));
  let deletes = 0;
  const cache = {
    match: async (p: string) => rows.get(url(p)),
    keys: async () => [...rows.keys()].map(p => new Request(p)),
    delete: async (request: Request) => { deletes++; return rows.delete(request.url); },
    put: async (p: string, response: Response) => { rows.set(url(p), response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'Request', 'URL', 'fetch', `return (async () => { ${body} })()`);
  const args = [{ open: async () => cache }, 'course', Response, Request, URL, () => { throw new Error('migration must not fetch'); }];
  await run(...args);
  assert.equal(deletes, 6);
  for (const p of retired) assert.equal(rows.has(url(p)), false);
  for (const p of protectedPaths) assert.equal(await rows.get(url(p))!.clone().text(), p);
  rows.set(url(changed[0]), new Response('newly downloaded replacement'));
  await run(...args);
  assert.equal(deletes, 6);
  assert.equal(await rows.get(url(changed[0]))!.text(), 'newly downloaded replacement');
});

test('all sixty accepted source-bound fields preserve every unlisted native and paired value and archived ST bytes', () => {
  assert.equal(sha(read(`${dir}/repaired-candidates.json`)), '81546481b8660b57c0a35ec90484ff4ea50fcb8abe17d4ec1cab26d54d3c0715');
  for (const [file, snapshot] of Object.entries(proof.beforeSnapshots) as [string, any][]) {
    assert.equal(sha(read(`${dir}/implementation-before/${file}`)), snapshot.sha256);
  }
  assert.equal(sha(read('lib/course-modules.ts')), proof.beforeSnapshots['canonical-before.ts.txt'].sha256);
  validate(liveNative, livePairs());
  assert.equal(proof.verification.oldSTProtectedByteInventory.length, 48);
  for (const entry of proof.verification.oldSTProtectedByteInventory) {
    const bytes = read(entry.path); assert.equal(bytes.length, entry.bytes); assert.equal(sha(bytes), entry.sha256);
  }
});

test('source, approved target, status, answer index, unlisted field and pair-order mutations cannot pass the full layer guard', () => {
  for (const mutate of [
    (n: any) => { n.ve.lessons[0].keyPoints[1].sourceEnglish += '!'; },
    (n: any) => { n.ve.lessons[0].keyPoints[1].tshivendaDraft += '!'; },
    (n: any) => { n.ve.lessons[0].keyPoints[1].reviewStatus = 'hold'; },
    (n: any) => { n.ts.lessons[0].quiz[0].sourceCorrectIndex = 99; },
    (n: any) => { n.ve.lessons[0].body.tshivendaDraft += '!'; },
  ]) { const native = structuredClone(liveNative); mutate(native); assert.throws(() => validate(native, livePairs())); }
  const pair = livePairs(); pair.st.slides.reverse(); assert.throws(() => validate(liveNative, pair));
  for (const mutate of [
    (p: any) => { p.st.slides[3].target.body[2].status = 'machine-draft'; },
    (p: any) => { p.ve.slides[10].target.body[2].provenance = 'unapproved reviewer provenance'; },
    (p: any) => { p.ts.slides[6].target.body[1].segments[0].provenance = 'unapproved segment provenance'; },
  ]) {
    const pairs = livePairs(); mutate(pairs);
    // TS provenance drift is now caught by the newer complete-deck fairness guard first.
    assert.throws(() => validate(liveNative, pairs), /listed paired metadata|complete accepted latest paired layer|complete TS paired deck matches the three reviewed fairness cells without source or neighbour drift/);
  }
});

test('changed current lesson source withdraws ordinary drafts instead of presenting a stale accepted target', () => {
  const module = COURSE_MODULES.find(m => m.id === 'intro-permaculture')!;
  for (const language of ['ve', 'ts']) for (const lesson of module.lessons) {
    assert.equal(resolveLearnerLessonPresentation(lesson, language).status, 'draft');
    assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body}!` }, language).status, 'english-fallback');
    const quiz = structuredClone(lesson.quiz); quiz[0].q += '!';
    assert.equal(resolveLearnerLessonPresentation({ ...lesson, quiz }, language).status, 'english-fallback');
  }
});
