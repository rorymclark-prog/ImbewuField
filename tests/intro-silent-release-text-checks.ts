import { tsSharedSourceBeforeNativeOrdinary } from './native-ordinary-final-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { introFullCanonicalBefore, introFullNativeAfter, introFullNativeBefore,
  introFullFixture, readCurrentIntroNative, type IntroLanguage } from './intro-full-ordinary-native-checks.ts';
import { validateAndRewindIntroFullNative } from './intro-full-ordinary-native-checks.ts';

const releaseFolder = 'docs/study-translation-reviews/st-intro-silent-completion-2026-10-06/';
const appliedPath = releaseFolder + 'applied-proof.json';
const candidatePath = releaseFolder + 'repaired-candidates.json';
const appliedSHA256 = '356243b0a456b820208971c4349b893011a018d97e3e45943171152de9bd8d45';
const candidateSHA256 = '81546481b8660b57c0a35ec90484ff4ea50fcb8abe17d4ec1cab26d54d3c0715';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(appliedPath);
assert.equal(sha(proofBytes), appliedSHA256, 'the accepted silent release proof remains immutable');
const proof = JSON.parse(proofBytes.toString());
const candidateBytes = readFileSync(candidatePath);
assert.equal(sha(candidateBytes), candidateSHA256, 'the root-reviewed source-bound candidate packet remains immutable');
const candidates = JSON.parse(candidateBytes.toString());
assert.equal(candidates.counts.actualDeltaCount, 60);

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const nativeTargetKey = (language: IntroLanguage) => language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
const nativeRoot = (native: Record<IntroLanguage, any>, language: IntroLanguage) => native[language];
const getPath = (root: any, path: string) => path.split('/').reduce((value, key) => value[key], root);
type Inputs = {
  native?: Record<IntroLanguage, any>;
  paired?: Record<string, any>;
  silentSesotho?: any;
};

export function readCurrentIntroSilentTextInputs(): Required<Inputs> {
  return {
    native: readCurrentIntroNative(),
    paired: Object.fromEntries(['ve', 'ts', 'st'].map(language => [language,
      readJson(`docs/narration/intro-permaculture.${language}.paired-draft.json`)])),
    silentSesotho: readJson('docs/narration/intro-permaculture.st.silent-draft.json'),
  };
}

function sourceForPairedSlot(slide: any, slot: string) {
  const body = slot.match(/^body\[(\d+)\]$/);
  if (body) return { source: slide.english.body[Number(body[1])], target: slide.target.body[Number(body[1])] };
  assert.equal(slot, 'heading');
  return { source: slide.english.heading, target: slide.target.heading };
}

function pairedAddress(row: any) {
  const match = row.fieldLocator.match(/^pairedSlides\/(ve|ts|st)\/slides\[n=(\d+)\]\/target\/(heading|body\[\d+\])$/);
  assert.ok(match, `${row.fieldLocator}: accepted release row has a bounded slide target locator`);
  return { language: match[1], slideNumber: Number(match[2]), slot: match[3] };
}

function visiblePairedTarget(pair: any, source: string): string {
  if (typeof pair === 'string') return pair;
  if (pair.status === 'english-hold') return source;
  if (pair.status === 'draft') return pair.text;
  assert.equal(pair.status, 'mixed');
  return pair.segments.map((segment: any) => segment.status === 'english-hold' ? segment.sourceEnglish : segment.text).join('');
}

function assertPairedTarget(pair: any, row: any, targetText: string, status: string, label: string) {
  assert.equal(visiblePairedTarget(pair.target, pair.source), targetText, `${label}: complete visible target text`);
  assert.equal(pair.target.status, status, `${label}: target review status`);
  if (pair.target.status === 'mixed') {
    assert.equal(pair.target.segments.map((segment: any) => segment.sourceEnglish).join(''), pair.source,
      `${label}: source segments retain exact order and full coverage`);
    for (const segment of pair.target.segments) {
      if (segment.status === 'english-hold') assert.equal(segment.text, undefined, `${label}: held source English has no translated text`);
      else {
        assert.equal(segment.status, 'draft');
        assert.equal(typeof segment.text, 'string');
      }
    }
  }
}

function validateCurrentFileHashes() {
  const outputs = proof.outputs;
  for (const row of Object.values(outputs.native) as any[]) {
    // The later Reading change shares TS's file; validate its full layer and
    // rewind its one literal before preserving the entire Intro968 file digest.
    const actual = readFileSync(row.path, 'utf8');
    const historical = row.path === 'lib/course-translation-drafts-ts.ts'
      ? tsSharedSourceBeforeNativeOrdinary(actual) : actual;
    assert.equal(sha(historical), row.sha256, `${row.path}: exact accepted native release bytes`);
  }
  for (const row of Object.values(outputs.existingPaired) as any[]) {
    assert.equal(sha(readFileSync(row.path)), row.sha256, `${row.path}: exact accepted paired release bytes`);
  }
  assert.equal(sha(readFileSync(outputs.newSilentST.path)), outputs.newSilentST.sha256,
    'new silent Sesotho paired deck matches the accepted release bytes');
  assert.equal(sha(readFileSync(outputs.unchangedOldST.path)), outputs.unchangedOldST.sha256,
    'the archived Sesotho paired deck remains byte-identical');
}

// Validate the entire 60-field current Intro text overlay before showing any
// older source-bound snapshots to historical assertion code. Current release
// rows cover 5 native pairs and 55 paired slide targets; absent/unlisted rows
// must match the corresponding frozen prior full object byte for byte.
export function validateAndRewindIntroSilentTextLayer(input: Inputs = {}) {
  validateCurrentFileHashes();
  const canonicalBytes = readFileSync('lib/course-modules.ts');
  const canonicalBefore = readFileSync(releaseFolder + 'implementation-before/canonical-before.ts.txt', 'utf8');
  assert.equal(sha(canonicalBefore), proof.beforeSnapshots['canonical-before.ts.txt'].sha256,
    'the canonical Introduction snapshot remains exact');
  assert.equal(sha(canonicalBytes), proof.beforeSnapshots['canonical-before.ts.txt'].sha256,
    'canonical English is unchanged by silent regional text');
  assert.deepEqual(COURSE_MODULES.find(module => module.id === 'intro-permaculture'), introFullCanonicalBefore,
    'all canonical English fields and all 21 correct answers stay exact');

  const current = input.native ?? readCurrentIntroNative();
  const nativeBeforeSilent: Record<IntroLanguage, any> = { ve: undefined, ts: undefined };
  const expectedNative: Record<IntroLanguage, any> = { ve: undefined, ts: undefined };
  const nativeRows = proof.scope.changedRows.filter((row: any) => row.fieldLocator.startsWith('lessons/'));
  assert.equal(nativeRows.length, 5);
  assert.equal(nativeRows.filter((row: any) => row.language === 've').length, 3);
  assert.equal(nativeRows.filter((row: any) => row.language === 'ts').length, 2);

  for (const language of ['ve', 'ts'] as const) {
    const key = nativeTargetKey(language);
    const expected = structuredClone(introFullNativeAfter[language]);
    const rows = nativeRows.filter((row: any) => row.language === language);
    for (const row of rows) {
      const pair = getPath(expected, row.fieldLocator);
      assert.equal(pair.sourceEnglish, row.sourceEnglish, `${row.fieldLocator}: source binding`);
      assert.equal(pair[key], row.before, `${row.fieldLocator}: exact pre-release target`);
      assert.equal(pair.reviewStatus, row.beforeStatus, `${row.fieldLocator}: pre-release status`);
      pair[key] = row.after;
      pair.reviewStatus = row.afterStatus;
    }
    assert.deepEqual(nativeRoot(current, language), expected,
      `${language}: complete native object equals the 5-field accepted current layer; every unlisted pair/status/answer remains exact`);
    expectedNative[language] = expected;
    const previous = structuredClone(expected);
    for (const row of rows) {
      const pair = getPath(previous, row.fieldLocator);
      pair[key] = row.before;
      pair.reviewStatus = row.beforeStatus;
    }
    assert.deepEqual(previous, introFullNativeAfter[language], `${language}: exact pre-release native full object reconstructed`);
    nativeBeforeSilent[language] = previous;
  }

  const pairedInput = input.paired ?? readCurrentIntroSilentTextInputs().paired;
  const currentSilentST = input.silentSesotho ?? readCurrentIntroSilentTextInputs().silentSesotho;
  // Bind caller-provided objects to the exact accepted files as well as the
  // row-by-row reconstruction below. This catches extra shadow properties on
  // mixed targets, which can leave their visible text unchanged.
  for (const language of ['ve', 'ts'] as const) {
    assert.deepEqual(pairedInput[language], readJson(proof.outputs.existingPaired[language].path),
      `${language}: supplied paired object is byte-source-equivalent to the accepted current registry`);
  }
  assert.deepEqual(pairedInput.st, readJson(proof.outputs.unchangedOldST.path),
    'supplied archived Sesotho paired object is the exact accepted archived registry');
  assert.deepEqual(currentSilentST, readJson(proof.outputs.newSilentST.path),
    'supplied silent Sesotho object is the exact accepted current registry');
  const pairedRows = proof.scope.changedRows.filter((row: any) => row.fieldLocator.startsWith('pairedSlides/'));
  assert.equal(pairedRows.length, 55);
  for (const [language, count] of [['ve', 1], ['ts', 2], ['st', 52]] as const) {
    assert.equal(pairedRows.filter((row: any) => row.language === language).length, count);
  }
  const pairedBeforeSilent: Record<string, any> = {};
  const expectedPaired: Record<string, any> = {};
  for (const language of ['ve', 'ts'] as const) {
    const snapshot = `implementation-before/paired-before-${language}.json`;
    const before = readJson(releaseFolder + snapshot);
    assert.equal(sha(readFileSync(releaseFolder + snapshot)), proof.beforeSnapshots[`paired-before-${language}.json`].sha256,
      `${language}: immutable paired state before the later silent text release`);
    const expected = structuredClone(before);
    for (const row of pairedRows.filter((item: any) => item.language === language)) {
      const address = pairedAddress(row);
      const beforeSlide = before.slides[address.slideNumber - 1];
      const beforePair = sourceForPairedSlot(beforeSlide, address.slot);
      const currentSlide = pairedInput[language].slides[address.slideNumber - 1];
      assert.ok(beforeSlide && currentSlide, `${row.fieldLocator}: listed slide exists`);
      assert.equal(beforeSlide.n, address.slideNumber, `${row.fieldLocator}: baseline slide order`);
      assert.equal(currentSlide.n, address.slideNumber, `${row.fieldLocator}: current slide order`);
      assert.equal(beforePair.source, row.sourceEnglish, `${row.fieldLocator}: exact prior source`);
      assert.equal(beforePair.target.status, row.beforeStatus, `${row.fieldLocator}: exact before status`);
      assert.equal(visiblePairedTarget(beforePair.target, beforePair.source), row.before,
        `${row.fieldLocator}: exact complete prior visible target`);
      const currentPair = sourceForPairedSlot(currentSlide, address.slot);
      assert.equal(currentPair.source, row.sourceEnglish, `${row.fieldLocator}: exact current source`);
      assertPairedTarget(currentPair, row, row.after, row.afterStatus, row.fieldLocator);
      if (address.slot === 'heading') expected.slides[address.slideNumber - 1].target.heading = structuredClone(currentPair.target);
      else expected.slides[address.slideNumber - 1].target.body[Number(address.slot.match(/^body\[(\d+)\]$/)![1])] = structuredClone(currentPair.target);
    }
    assert.deepEqual(pairedInput[language], expected,
      `${language}: whole source/target/status/order object equals only the accepted current text rows`);
    expectedPaired[language] = expected;
    pairedBeforeSilent[language] = structuredClone(before);
  }

  const oldSTBeforePath = releaseFolder + 'implementation-before/paired-before-st.json';
  const oldSTBefore = readJson(oldSTBeforePath);
  assert.equal(sha(readFileSync(oldSTBeforePath),), proof.beforeSnapshots['paired-before-st.json'].sha256,
    'old Sesotho paired baseline fixture digest');
  assert.deepEqual(pairedInput.st, oldSTBefore,
    'archived Sesotho paired registry remains the exact original object; new text is held in its separate silent file');
  pairedBeforeSilent.st = structuredClone(oldSTBefore);

  const silentSTBefore = structuredClone(oldSTBefore);
  for (const row of pairedRows.filter((item: any) => item.language === 'st')) {
    const address = pairedAddress(row);
    const beforeSlide = oldSTBefore.slides[address.slideNumber - 1];
    const beforePair = sourceForPairedSlot(beforeSlide, address.slot);
    assert.equal(beforePair.source, row.sourceEnglish, `${row.fieldLocator}: exact original source pair`);
    assert.equal(beforePair.target.status, row.beforeStatus, `${row.fieldLocator}: original target status`);
    assert.equal(visiblePairedTarget(beforePair.target, beforePair.source), row.before,
      `${row.fieldLocator}: exact original Sesotho target`);
    const currentPair = sourceForPairedSlot(currentSilentST.slides[address.slideNumber - 1], address.slot);
    assert.equal(currentPair.source, row.sourceEnglish, `${row.fieldLocator}: exact current source pair`);
    assertPairedTarget(currentPair, row, row.after, row.afterStatus, row.fieldLocator);
    if (address.slot === 'heading') silentSTBefore.slides[address.slideNumber - 1].target.heading = structuredClone(currentPair.target);
    else silentSTBefore.slides[address.slideNumber - 1].target.body[Number(address.slot.match(/^body\[(\d+)\]$/)![1])] = structuredClone(currentPair.target);
  }
  assert.deepEqual(currentSilentST, silentSTBefore,
    'full new silent Sesotho deck consists only of 52 exact accepted targets; every source, slide, status and unlisted cell remains exact');

  const markdownBytes = readFileSync('docs/narration/intro-permaculture.en.md');
  const englishSource = englishSlideRecords(markdownBytes.toString());
  for (const language of ['ve', 'ts'] as const) validatePairedDraft(pairedInput[language], englishSource, language);
  validatePairedDraft(currentSilentST, englishSource, 'st');
  for (const language of ['ve', 'ts'] as const) {
    assert.deepEqual(expectedPaired[language].slides.map((slide: any) => slide.n), Array.from({ length: 22 }, (_, i) => i + 1));
  }
  assert.equal(currentSilentST.slides.length, 22);

  const rewoundPaired = structuredClone(pairedInput);
  for (const language of ['ve', 'ts'] as const) rewoundPaired[language] = pairedBeforeSilent[language];
  rewoundPaired.st = pairedBeforeSilent.st;
  return { nativeBeforeSilent, pairedBeforeSilent: rewoundPaired, silentSesotho: structuredClone(currentSilentST),
    expectedNative, expectedPaired, expectedSilentSesotho: silentSTBefore };
}

export function validateAndRewindIntroNativeHistory(language: IntroLanguage, current = readCurrentIntroNative()[language]) {
  const native = { ve: readCurrentIntroNative().ve, ts: readCurrentIntroNative().ts };
  native[language] = current;
  const validated = validateAndRewindIntroSilentTextLayer({ native });
  return validateAndRewindIntroFullNative(language, validated.nativeBeforeSilent[language]);
}

export function introPresentationBeforeSilentRelease(lesson: Lesson, language: string,
  presentation: import('../lib/course-localization.ts').LearnerLessonPresentation) {
  if (!lesson.id.startsWith('intro-permaculture-') || (language !== 've' && language !== 'ts')) return presentation;
  validateAndRewindIntroSilentTextLayer();
  if (presentation.status !== 'draft') return presentation;
  const historical = introFullNativeBefore[language].lessons.find((item: any) => item.id === lesson.id);
  assert.ok(historical);
  const key = nativeTargetKey(language);
  const text = (pair: any) => pair.reviewStatus === 'hold' ? pair.sourceEnglish : pair[key];
  return { ...presentation, content: {
    title: text(historical.title), body: text(historical.body), infographicAlt: text(historical.infographicAlt),
    keyPoints: historical.keyPoints.map(text),
    quiz: historical.quiz.map((quiz: any) => ({ q: text(quiz.question), options: quiz.options.map(text),
      correct: quiz.sourceCorrectIndex, rationale: text(quiz.rationale) })),
  } };
}
