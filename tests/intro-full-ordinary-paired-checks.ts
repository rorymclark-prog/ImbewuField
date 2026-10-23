import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { introFullFixture, introFullDigest } from './intro-full-ordinary-native-checks.ts';
import { validateAndRewindIntroNativeHistory, validateAndRewindIntroSilentTextLayer } from './intro-silent-release-text-checks.ts';

export const introFullPairedPacket = introFullFixture('accepted-paired-objects.json');
export const readCurrentIntroFullDecks = (): Record<string, any> => Object.fromEntries(['ve', 'ts', 'st'].map(language => [language,
  JSON.parse(readFileSync(new URL(`../docs/narration/intro-permaculture.${language}.paired-draft.json`, import.meta.url), 'utf8'))]));
const resolve = (pair: any, source: string): string => pair.status === 'english-hold' ? source : pair.status === 'draft' ? pair.text :
  pair.segments.map((segment: any) => segment.status === 'english-hold' ? segment.sourceEnglish : segment.text).join('');

// 6 October 2026: the accepted72 objects supersede older paired clauses. Check
// the entire current native/deck layer first, then expose only its exact prior
// view; an old source/target claim must never hide a newer unlisted mutation.
export function validateAndRewindIntroFullPaired(decks = readCurrentIntroFullDecks()) {
  // The accepted 6 October silent release sits above this older paired fixture.
  // Validate all 60 latest source/target changes and unlisted cells first, then
  // rewind only the three VE/TS legacy-deck targets before applying this guard.
  decks = validateAndRewindIntroSilentTextLayer({ paired: decks }).pairedBeforeSilent;
  for (const language of ['ve', 'ts'] as const) validateAndRewindIntroNativeHistory(language);
  const hashes = introFullFixture('source-file-before-hashes.json');
  const sourceBytes = readFileSync(new URL('../docs/narration/intro-permaculture.en.md', import.meta.url));
  assert.equal(introFullDigest(sourceBytes), hashes['docs/narration/intro-permaculture.en.md']);
  const source = englishSlideRecords(sourceBytes.toString());
  const before: Record<string, any> = {};
  const expected: Record<string, any> = {};
  for (const language of ['ve', 'ts', 'st']) {
    before[language] = introFullFixture(`${language}-paired-before.json`);
    expected[language] = structuredClone(before[language]);
    validatePairedDraft(decks[language], source, language);
  }
  assert.equal(introFullPairedPacket.objects.length, 72);
  assert.equal(new Set(introFullPairedPacket.objects.map((row: any) => row.id)).size, 72);
  let sourceFields = 0;
  for (const language of ['ve', 'ts']) sourceFields += before[language].slides.reduce((sum: number, slide: any) => sum + 1 + slide.english.body.length, 0);
  assert.equal(sourceFields, 220);
  for (const row of introFullPairedPacket.objects) {
    const language = row.path.includes('.ve.') ? 've' : 'ts';
    const slide = expected[language].slides[row.slide - 1];
    const at = row.targetSlot.match(/^body\[(\d+)\]$/)?.[1];
    const old = at === undefined ? slide.target.heading : slide.target.body[Number(at)];
    const english = at === undefined ? slide.english.heading : slide.english.body[Number(at)];
    assert.deepEqual(old, row.before, `${row.id}: genuine complete before pair/status/provenance`);
    assert.equal(english, row.originalSource);
    const pair = row.proposedObject;
    assert.equal(resolve(pair, english), row.acceptedFinalTarget, `${row.id}: exact final recommended target`);
    const segments = pair.status === 'mixed' ? pair.segments : [{ ...pair, sourceEnglish: english }];
    assert.equal(segments.map((segment: any) => segment.sourceEnglish).join(''), english);
    for (const segment of segments) {
      if (segment.status === 'english-hold') assert.equal(segment.text, undefined, 'retained source English has no target text');
      else {
        assert.equal(segment.status, 'draft');
        assert.notEqual(segment.text.trim(), segment.sourceEnglish.trim(), 'literal source-copy spans never masquerade as translations');
      }
    }
    for (const exception of row.EnglishPrecisionExceptions) assert.equal(exception.claimsEnglishTermTranslated, false,
      'noun order/case English precision exceptions are not represented as translated terms');
    if (at === undefined) slide.target.heading = structuredClone(pair);
    else slide.target.body[Number(at)] = structuredClone(pair);
  }
  for (const language of ['ve', 'ts', 'st']) {
    assert.deepEqual(expected[language], introFullFixture(`${language}-paired-after.json`), 'whole after independently composes only72 authorized objects');
    assert.deepEqual(decks[language], expected[language], 'all actual source/order/unlisted target/status/provenance match the approved layer');
  }
  const restored = structuredClone(decks);
  for (const row of introFullPairedPacket.objects) {
    const language = row.path.includes('.ve.') ? 've' : 'ts';
    const slide = restored[language].slides[row.slide - 1];
    const at = row.targetSlot.match(/^body\[(\d+)\]$/)?.[1];
    if (at === undefined) slide.target.heading = structuredClone(row.before);
    else slide.target.body[Number(at)] = structuredClone(row.before);
  }
  assert.deepEqual(restored, before, 'exact72-slot rewind preserves all148 unlisted full pairs and entire ST deck');
  return restored;
}

export function verifyProtectedIntroAsset(row: { path: string; sha256: string; bytes: number }, bytes: Buffer) {
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(introFullDigest(bytes), row.sha256, row.path);
}
export function validateProtectedSTIntro() {
  const rows = introFullFixture('protected-st-intro.json');
  assert.equal(rows.length, 45, 'all22 ST stills and23 audio files, including full narration, remain');
  for (const row of rows) verifyProtectedIntroAsset(row, readFileSync(new URL(`../${row.path}`, import.meta.url)));
  const hashes = introFullFixture('source-file-before-hashes.json');
  assert.equal(introFullDigest(readFileSync(new URL('../lib/course-modules.ts', import.meta.url))),
    hashes['lib/course-modules.ts'], 'canonical lesson source and answer authority remain byte-identical');
  const runtimeProofBytes = readFileSync(new URL(
    '../docs/study-translation-reviews/st-intro-silent-completion-2026-10-06/runtime-binding/applied-runtime-proof.json', import.meta.url));
  assert.equal(introFullDigest(runtimeProofBytes), '15dde91f532cd4b1fffdd06e7beced8bc6cf96953d3e3359a4c03ece704e9157',
    'current release-binding proof is the root-accepted runtime authority');
  const runtimeProof = JSON.parse(runtimeProofBytes.toString());
  const currentAudioAuthority = readFileSync(new URL('../lib/course-audio.ts', import.meta.url));
  assert.equal(introFullDigest(currentAudioAuthority), runtimeProof.fileSHA256['lib/course-audio.ts'],
    'current recording exposure is bound to the compatible release registry; archived Sesotho recordings remain verified above');
}
