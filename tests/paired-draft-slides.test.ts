import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishSlideRecords, pairedDraftLanguageLabel, pairedSlideSelection, pairedTargetHasEnglishHolds, selectPairedSlides, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { XITSONGA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ts-food-forest.ts';
import { SESOTHO_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-st-plant-guilds.ts';
import { TSHIVENDA_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-ve-plant-guilds.ts';
import { XITSONGA_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-ts-plant-guilds.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { defaultOfflinePackVariant, offlinePack } from '../lib/offline-pack.ts';
import {
  FOREST_GUILD_FORBIDDEN_WORDS, FOREST_GUILD_KEPT_TERMS, FOREST_GUILD_NAMES, assertKeeps, assertKeepsTerms, checkAnimalNames,
  checkCompleteSlideDrafts, checkConsistentDrafts, checkCreatureWords, checkGlossedWords, checkKeptTerms, checkNamesVerbatim,
  checkRepeatedSentences, checkSouthAfricanSesotho, checkSupportPlantTerms, checkThinningKept, sourceDraftPairs,
} from './regional-full-draft-checks.ts';

const source = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
const marketSource = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
const completeHold = (language = 'st') => ({
  language, sourceLanguage: 'en', reviewStatus: 'unreviewed',
  slides: source.map((english) => ({
    n: english.n, english: structuredClone(english),
    target: { heading: { status: 'english-hold' }, body: english.body.map(() => ({ status: 'english-hold' })) },
  })),
});
const studyOutcomesProof = JSON.parse(readFileSync(
  'docs/study-translation-reviews/STUDY-OUTCOMES-RESIDUAL-PAIRED-FIELDS-2026-10-05.json', 'utf8'));
const firstObservationImplementationProof = JSON.parse(readFileSync(
  'docs/study-translation-reviews/READING-FIRST-OBSERVATIONS-IMPLEMENTATION-2026-10-05.json', 'utf8'));
const firstObservationFields = firstObservationImplementationProof.pairedFieldsApplied;
const firstObservationField = (language: string, slide: number, bodyIndex: number) =>
  firstObservationFields.find((field: any) => field.language === language && field.slide === slide && field.index === bodyIndex);
const assertCurrentFirstObservation = (target: any, field: any, label: string) => {
  assert.ok(field, `${label}: the later first-observations batch records this exact field`);
  assert.equal(target.status, 'mixed', `${label}: ordinary prose and retained English anchors remain visibly mixed`);
  assert.deepEqual(target.segments, field.segments, `${label}: retain the independently checked source segmentation`);
  assert.equal(targetVisibleText(target), field.target, `${label}: keep the approved composition visible`);
  assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
    `${label}: segments stay bound to the exact canonical field`);
};
const studyOutcomeFields = studyOutcomesProof.changedFiles.flatMap((file: any) => file.changedBodyFields);
const approvedStudyOutcome = (moduleId: string, language: string, slide: number, bodyIndex: number) =>
  studyOutcomeFields.find((field: any) => field.moduleId === moduleId && field.language === language
    && field.slide === slide && field.bodyIndexZeroBased === bodyIndex);
const readingFullDeckProof = JSON.parse(readFileSync(
  'docs/study-translation-reviews/READING-FULL-DECK-APPLIED-CANDIDATES-2026-10-05.json', 'utf8'));
const readingFullDeckRecords = readingFullDeckProof.records;
const restorePreFullReadingDeck = (packet: any, language: string) => {
  assert.equal(readingFullDeckProof.reviewStatus, 'unreviewed');
  assert.equal(readingFullDeckProof.canonicalEnglishUnchanged, true,
    'the full-deck change leaves canonical English untouched');
  const fields = readingFullDeckRecords.filter((record: any) => record.identity.language === language);
  assert.equal(fields.length, language === 'st' ? 19 : language === 've' ? 30 : 27,
    `${language}: restore every field recorded by the full-deck application`);
  for (const record of fields) {
    const { slide, field, index } = record.identity;
    const row = packet.slides[slide - 1];
    const source = field === 'heading' ? row.english.heading : row.english.body[index];
    assert.equal(source, record.sourceEnglish,
      `${language}:${slide}:${field}:${index ?? ''}: the applied field still names its exact English source`);
    const live = field === 'heading' ? row.target.heading : row.target.body[index];
    assert.deepEqual(live, record.after,
      `${language}:${slide}:${field}:${index ?? ''}: current target must match the recorded applied field before historical reconstruction`);
    if (field === 'heading') row.target.heading = record.before;
    else row.target.body[index] = record.before;
  }
  return fields;
};
const assertCurrentStudyOutcome = (target: any, field: any, label: string) => {
  assert.ok(field, `${label}: later approved source-bound field is recorded`);
  assert.equal(target.status, field.targetStatus, `${label}: retain approved visible status`);
  const visibleText = target.status === 'mixed'
    ? target.segments.map((segment: any) => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('')
    : target.text;
  assert.equal(visibleText, field.targetText, `${label}: retain the final approved composition`);
  if (target.status === 'mixed') {
    assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
      `${label}: segments still cover the exact source in order`);
    assert.deepEqual(target.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish), field.retainedEnglishSourceSegments,
    `${label}: every retained clause remains an exact English source segment`);
  }
};

test('the Sesotho pilot pairs all 22 actual English introduction slides in authored order', () => {
  assert.equal(source.length, 22);
  assert.equal(source[0].heading, 'Introduction to Permaculture');
  assert.equal(source[0].body[0], 'Before you dig anything, it helps to know how the decisions get made.');
  assert.equal(source[0].body.length, 4);
  assert.ok(source.every((slide) => slide.body.every((paragraph: string) => paragraph !== '---' && !paragraph.includes('[pause]'))));
  assert.equal(validatePairedDraft(completeHold(), source).length, 22);
});

test('Market record slides reuse L1 wording and keep quantity and destination anchors beside drafts', () => {
  const batches = [
    { language: 'st' },
    { language: 've' },
    { language: 'ts' },
  ];
  const l1English = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons
    .find(({ id }) => id === 'market-community-l1')!.body.sourceEnglish.split('\n\n');
  const l1ByLanguage = new Map([
    ['st', SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(({ id }) => id === 'market-community-l1')!.body.sesothoDraft.split('\n\n')],
    ['ve', TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(({ id }) => id === 'market-community-l1')!.body.tshivendaDraft.split('\n\n')],
    ['ts', XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(({ id }) => id === 'market-community-l1')!.body.xitsongaDraft.split('\n\n')],
  ]);
  const translated = [
    { slide: 2, body: 0, lesson: 0 },
    { slide: 2, body: 1, lesson: 1 },
    { slide: 5, body: 0, lesson: 3 },
    { slide: 5, body: 3, lesson: 6 },
  ];
  const newlyDrafted = [
    { slide: 2, body: 2, source: 'Use that information to protect household food and make better business decisions.', anchors: { st: ['kgwebo'], ve: ['bindu'], ts: ['bindzu'] } },
    { slide: 5, body: 1, source: 'Record kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.', anchors: ['kilograms', 'dozens', 'bundles'] },
    { slide: 5, body: 2, source: 'Use the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.', anchors: ['compost'] },
  ];

  assert.equal(marketSource.length, 20);
  for (const { language } of batches) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, marketSource, language);
    const lessonParagraphs = l1ByLanguage.get(language)!;
    assert.equal(packet.reviewStatus, 'unreviewed');
    for (const item of translated) {
      const slide = slides[item.slide - 1];
      assert.equal(slide.english.body[item.body], l1English[item.lesson], `${language} slide ${item.slide}: retain the exact L1 English clause`);
      assert.equal(slide.target.body[item.body].status, 'draft');
      assert.equal(slide.target.body[item.body].text, lessonParagraphs[item.lesson],
        `${language} slide ${item.slide}: reuse the existing L1 machine candidate verbatim`);
    }
    for (const item of newlyDrafted) {
      const slide = slides[item.slide - 1];
      const part = slide.target.body[item.body];
      assert.equal(slide.english.body[item.body], item.source, `${language} slide ${item.slide}: keep the exact source pairing`);
      assert.equal(part.status, 'draft', `${language} slide ${item.slide}: expose the source-bound unreviewed draft`);
      assert.ok(part.text && part.text !== item.source);
      assert.ok(part.provenance?.includes('unreviewed'));
      for (const anchor of (item.anchors as Record<string, string[]>)[language] ?? item.anchors as string[]) {
        assert.ok(part.text.includes(anchor), `${language} keeps the ${anchor} meaning anchor`);
      }
    }
    assert.ok(slides[1].target.body.every((part: any) => part.status === 'draft'),
      `${language} pairs each ordinary harvest-use explanation with its exact English source`);
    assert.ok(slides[4].target.body.every((part: any) => part.status === 'draft'),
      `${language} records every harvest while retaining quantity and destination wording`);
  }
});

test('Market L1 paired-deck repairs bind complete approved clauses and preserve other slide scopes', () => {
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/MARKET-COMMUNITY-L1-PAIRED-DECK-APPLIED-2026-10-05.json', 'utf8'));
  const module = COURSE_MODULES.find(({ id }) => id === 'market-community')!;
  const lesson = module.lessons.find(({ id }) => id === 'market-community-l1')!;
  const canonical = lesson.body.split('\n\n');
  const expectedChangedFrames = {
    st: [1, 2, 5, 7, 8],
    ve: [2, 5, 6, 7, 8],
    ts: [1, 2, 5, 6, 7, 8],
  } as const;
  const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const sha256File = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  const assetProof = JSON.parse(readFileSync(
    'docs/media/market-community/l1-completion-20261005/assets-proof.json', 'utf8'));

  for (const language of ['st', 've', 'ts'] as const) {
    const languageProof = proof.languages[language];
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, marketSource, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(languageProof.bodyFields.length, 17);
    assert.deepEqual(languageProof.changedFrames, expectedChangedFrames[language]);

    const seen = new Set<number>();
    for (const field of languageProof.bodyFields) {
      const slide = slides[field.slide - 1];
      assert.equal(field.canonicalBodySource, canonical[field.paragraphIndex]);
      assert.equal(field.sourceEnglish, canonical[field.paragraphIndex],
        `${language} L1 paragraph ${field.paragraphIndex}: approved target remains bound to its complete canonical source`);
      assert.equal(slide.english.body[field.slideBodyIndex], canonical[field.paragraphIndex]);
      assert.equal(slide.target.body[field.slideBodyIndex].status, field.afterTarget.status);
      assert.equal(slide.target.body[field.slideBodyIndex].text, field.afterTarget.text);
      assert.ok(slide.target.body[field.slideBodyIndex].text !== field.sourceEnglish,
        `${language} L1 paragraph ${field.paragraphIndex}: localized draft does not silently remain English`);
      seen.add(field.paragraphIndex);
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), canonical.map((_, i) => i),
      `${language}: each complete L1 body paragraph is bound once`);

    const numericExample = languageProof.bodyFields.find((field: any) => field.paragraphIndex === 12)!;
    assert.equal(numericExample.beforeTarget.status, 'english-hold');
    assert.equal(numericExample.afterTarget.status, 'draft');
    assert.match(numericExample.afterTarget.provenance, /unreviewed.*exact English source paired.*no fluent approval/i);
    assert.match(numericExample.afterTarget.text, /R18/);
    assert.match(numericExample.afterTarget.text, /R15/);

    const title = slides[0];
    assert.equal(title.english.heading, module.title);
    assert.equal(title.target.heading.text, languageProof.cardTitle.afterTarget.text);
    assert.equal(title.target.heading.status, languageProof.cardTitle.afterTarget.status);
    assert.notEqual(title.english.body[1], module.description,
      `${language}: slide-1 description paraphrase is not an exact module-description source field`);
    assert.deepEqual(title.target.body[1], languageProof.cardDescription.target,
      `${language}: preserve the nonmatching slide-1 description field`);

    const preserved = languageProof.preservedOutOfScopeFrames
      .map((number: number) => ({ slide: number, target: packet.slides[number - 1].target }));
    assert.equal(sha256(preserved), languageProof.preservedOutOfScopeTargetSha256,
      `${language}: composite/out-of-scope targets remain byte-stable across this L1 application`);
    assert.ok(languageProof.preservedOutOfScopeFrames.includes(3));
    assert.ok(languageProof.preservedOutOfScopeFrames.includes(4));
    assert.ok(languageProof.preservedOutOfScopeFrames.includes(9));
    assert.ok(languageProof.preservedOutOfScopeFrames.includes(14));
    assert.ok(languageProof.preservedOutOfScopeFrames.includes(19));

    const languageAssetProof = assetProof.languages[language];
    const manifest = JSON.parse(readFileSync(languageAssetProof.manifestPath, 'utf8'));
    assert.equal(manifest.pairedSourceSha256, sha256File(`docs/narration/market-community.${language}.paired-draft.json`),
      `${language}: rendered-asset manifest is bound to the applied paired source`);
    assert.deepEqual(languageAssetProof.expectedChangedFrames, expectedChangedFrames[language]);
    assert.equal(languageAssetProof.assets.length, expectedChangedFrames[language].length);
    for (const rendered of languageAssetProof.assets) {
      const asset = readFileSync(rendered.path);
      const manifestEntry = manifest.slides.find((entry: any) => entry.slide === rendered.slide);
      assert.equal(manifestEntry.sha256, sha256File(rendered.path),
        `${language} slide ${rendered.slide}: manifest checksum matches the installed WebP`);
      assert.equal(manifestEntry.bytes, asset.byteLength);
      assert.equal(manifestEntry.pixels, '1440x5400');
    }
    assert.match(manifest.note, /L1 teaching-price example is now a source-bound machine draft/);
    assert.match(manifest.note, /L3 protected-variety permission passage remains an exact English hold/);
    assert.equal(manifest.humanLanguageReview, false);
    assert.equal(manifest.localFarmingReview, false);
    if (Object.hasOwn(manifest, 'draftPassageCount')) {
      assert.equal(manifest.draftPassageCount,
        slides.reduce((count: number, slide: any) => count + slide.target.body.filter((part: any) => part.status === 'draft').length, 0),
        `${language}: the draft-passage count includes the now-translated teaching example`);
    }
  }
});

test('Water Harvesting source-paired decks expose only exact-source resolver drafts and bounded candidates', () => {
  const waterSource = englishSlideRecords(readFileSync('docs/narration/water-harvesting.en.md', 'utf8'));
  const safeHeadings = {
    st: { 2: 'Liphetho tsa ho ithuta', 23: 'Mosebetsi oa tšimong' },
    ve: { 2: 'Zwine na ḓo guda', 23: 'Mushumo wa tsimuni' },
    ts: { 2: 'Leswi u nga ta swi dyondza', 23: 'Ntirho wa le nsinini' },
  };
  const waterModule = COURSE_MODULES.find(({ id }) => id === 'water-harvesting')!;
  const exactLessonParagraphs = new Map<string, Array<{ status: string; text: string }>>();
  for (const language of ['st', 've', 'ts'] as const) {
    for (const lesson of waterModule.lessons) {
      const resolved = resolveLearnerLessonPresentation(lesson, language);
      const sourceParagraphs = lesson.body.split('\n\n');
      const resolvedParagraphs = resolved.content.body.split('\n\n');
      assert.equal(resolvedParagraphs.length, sourceParagraphs.length,
        `${language} ${lesson.id}: learner resolver keeps paragraph boundaries`);
      sourceParagraphs.forEach((sourceParagraph, index) => {
        const key = `${language}\0${sourceParagraph}`;
        exactLessonParagraphs.set(key, [
          ...(exactLessonParagraphs.get(key) ?? []),
          { status: resolved.status, text: resolvedParagraphs[index] },
        ]);
      });
    }
  }

  const criticalEnglishHolds: Array<[number, number[]]> = [
    [2, [0, 1, 2, 3]], // learning outcomes on swale design, spillway, tank safety and greywater separation
    [3, [0, 1]],       // contour, grade, outlet, site conditions and adviser before digging
    [4, [0, 1]],       // concept-only geometry and site-specific depth/overflow
    [5, [0, 1]],       // downhill placement and conditional soil-moisture benefit
    [7, [0, 1]],       // assessed overflow route and receiving capacity
    [12, [0, 1]],      // catastrophic overtopping and professional assessment
    [16, [0, 1]],      // first-flush sizing and safety check
    [19, [0, 1]],      // used-water source and contamination guidance
    [20, [0, 1]],      // required local sanitation advice and no-reuse condition
    [21, [0, 1]],      // unapproved design and advice before any reuse
    [22, [0]],         // contact, plumbing, spraying, pooling and runoff restrictions
  ];

  const reusedParagraphRows: string[] = [];
  const exactEnglishResolverRows: string[] = [];
  const machineDraftRows: string[] = [];
  const existingHeadingRows: string[] = [];
  const statusCounts: Record<string, number> = {};
  assert.equal(waterSource.length, 24);
  for (const language of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/water-harvesting.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, waterSource, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 24);
    for (const slide of slides) {
      const genericHeading = safeHeadings[language as keyof typeof safeHeadings][slide.n as 2 | 23];
      if (slide.n === 2 || slide.n === 23) {
        assert.equal(slide.target.heading.status, 'draft', `${language} slide ${slide.n}: preserve existing heading draft`);
        assert.equal(slide.target.heading.text, genericHeading);
        assert.match(slide.target.heading.provenance, /unreviewed.*exact English source paired/);
      }
      statusCounts[slide.target.heading.status] = (statusCounts[slide.target.heading.status] ?? 0) + 1;
      if (slide.target.heading.status === 'draft') {
        assert.ok(slide.target.heading.text && slide.target.heading.text !== slide.english.heading,
          `${language} slide ${slide.n}: heading draft is not a copied English source`);
        assert.match(slide.target.heading.provenance, /unreviewed|machine draft/i);
        if (slide.target.heading.provenance.startsWith('existing unreviewed course heading reused verbatim;')) {
          existingHeadingRows.push(`${language}:${slide.n}`);
        } else if (slide.target.heading.provenance.startsWith('Bounded deck-only machine draft')) {
          machineDraftRows.push(`${language}:${slide.n}:heading`);
        }
      }

      for (const [index, part] of slide.target.body.entries()) {
        statusCounts[part.status] = (statusCounts[part.status] ?? 0) + 1;
        const sourceParagraph = slide.english.body[index];
        const matches = exactLessonParagraphs.get(`${language}\0${sourceParagraph}`) ?? [];
        if (part.status === 'english-hold') {
          assert.equal(part.text, undefined);
          if (matches.length > 0) {
            assert.ok(matches.every(({ text }) => text === sourceParagraph),
              `${language} slide ${slide.n} body ${index}: an exact resolver English fallback stays held`);
            exactEnglishResolverRows.push(`${language}:${slide.n}:${index}`);
          }
          continue;
        }
        assert.ok(part.text && part.text !== sourceParagraph,
          `${language} slide ${slide.n} body ${index}: a draft must contain target text, not an English copy`);

        if (part.provenance?.startsWith('Complete byte-exact English source learner paragraph reused;')) {
          assert.ok(matches.length > 0, `${language} slide ${slide.n} body ${index}: reused paragraph has an exact canonical source match`);
          assert.ok(matches.every(({ text }) => text === part.text),
            `${language} slide ${slide.n} body ${index}: reuse equals the current resolver paragraph byte for byte`);
          assert.ok(matches.every(({ status }) => status === 'draft'),
            `${language} slide ${slide.n} body ${index}: reused resolver paragraph is a draft`);
          reusedParagraphRows.push(`${language}:${slide.n}:${index}`);
        } else if (part.provenance?.startsWith('Bounded deck-only machine draft')) {
          machineDraftRows.push(`${language}:${slide.n}:${index}`);
        } else if (matches.length > 0) {
          assert.ok(matches.every(({ text }) => text === sourceParagraph),
            `${language} slide ${slide.n} body ${index}: a localized exact source match must use the full resolver paragraph`);
          assert.fail(`${language} slide ${slide.n} body ${index}: source-matched learner text must be marked as a resolver reuse`);
        }
      }
    }

    for (const [slideNumber, indices] of criticalEnglishHolds) {
      const slide = slides[slideNumber - 1];
      for (const index of indices) {
        assert.equal(slide.target.body[index].status, 'english-hold',
          `${language} slide ${slideNumber} body ${index}: technical or sanitation guidance stays in exact English`);
        assert.equal(slide.target.body[index].text, undefined);
        assert.equal(slide.english.body[index], waterSource[slideNumber - 1].body[index]);
      }
    }
    assert.equal(pairedTargetHasEnglishHolds(slides[2].target), true,
      `${language}: technical holds remain visibly paired with their source`);

    const damDesign = slides[10].target.body;
    assert.match(damDesign[0].text, /suitably qualified|ditshwaneleho tse loketseng|suitable qualifications/i,
      `${language}: dam design remains assigned to a suitably qualified person`);
    assert.match(damDesign[0].text, /catchment runoff|sebaka sa pokellelo/i);
    assert.match(damDesign[0].text, /downstream risk|kotsi e ka tlase/i);
    assert.match(damDesign[0].text, /safe spillway|tsela e bolokehileng ya metsi a tletseng/i);
    assert.match(damDesign[1].text, /annual rainfall|pula ya selemo le selemo|mpfula ya lembe/i);
    assert.match(damDesign[1].text, /flood|morwallo|ndhambi/i);
    assert.match(damDesign[2].text, /erode|kgohola/i);
    assert.match(damDesign[2].text, /breach wall|pshatla lerako|breach the wall/i);
    assert.match(damDesign[2].text, /safe route|tsela e bolokehileng|ndlela leyi hlayisekeke/i);

    const assignment = slides[22];
    const build = assignment.target.body[0].text;
    assert.match(build, /A-frame level/);
    assert.match(build, language === 'ts' ? /ntambhu leyi nga ni ntiko/ : /weighted string/);
    assert.match(build, language === 'ts' ? /tinharhu/ : language === 've' ? /tharu/ : /tse tharo/,
      `${language}: the assignment retains exactly three poles`);
    const turnAround = slides[23].target.body[1];
    if (language === 'st' || language === 've') assert.match(turnAround.text, /it should read the same/);
    else assert.match(turnAround.text, /yi fanele yi hlaya leswi fanaka/);
    const points = slides[23].target.body[2].text;
    assert.match(points, /at least three points|bonyane dintlha tse tharo|three points/i);
    assert.match(points, /same height|bophahamong bo le bong|height yo fana/i);
    assert.match(points, /across my slope|ho parola letsoapong|across slope/i);
    const direction = slides[23].target.body[3];
    if (language === 've') {
      assert.equal(direction.status, 'english-hold');
      assert.equal(direction.text, undefined);
    } else {
      assert.equal(direction.status, 'draft');
      assert.match(direction.text, /not down|ha o ye tlase|a yi yi ehansi/i);
      assert.match(direction.text, /across|parola|tsemakanya/i);
    }
    assert.match(slides[23].target.body[4].text, /5/);
    assert.match(slides[23].target.body[4].text, /day|matsatsi|masiku/i);
  }

  assert.equal(reusedParagraphRows.length, 78,
    'all 78 target-language reuses are exact full paragraphs from current canonical learner resolution');
  assert.equal(exactEnglishResolverRows.length, 6,
    'the six exact-source resolver paragraphs that remain English are labeled holds, not translations');
  assert.equal(machineDraftRows.length, 49,
    'new deck-only prose remains a bounded, separately labeled unreviewed draft');
  assert.equal(existingHeadingRows.length, 6,
    'the two established generic headings per language remain unchanged');
  assert.deepEqual(statusCounts, { 'english-hold': 125, draft: 133 },
    'the three paired decks retain 125 exact-English holds and 133 clearly marked draft panels');
});

// Rewritten 2 October 2026: slides 12-16 and 18-20 were exact-English holds. Every heading and paragraph is
// now a back-translated draft beside its exact English source, with animal names checked on their own (an
// earlier draft confused ducks with frogs). The learner stills must still match the review frames byte for byte.
test('silent Small Livestock decks draft every slide passage, name each animal correctly and ship the reviewed still bytes', () => {
  const english = englishSlideRecords(readFileSync('docs/narration/small-livestock.en.md', 'utf8'));
  assert.equal(english.length, 20);
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/study-translation-reviews/small-livestock-regional/small-livestock.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, english, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 20);
    const pairs = checkCompleteSlideDrafts(slides, lang, `${lang} Small Livestock`);
    assert.ok(checkAnimalNames(pairs, lang, `${lang} Small Livestock slides`) >= 40);
    for (const slide of slides) {
      const englishText = [slide.english.heading, ...slide.english.body].join(' ');
      if (!/\bducks?\b/i.test(englishText)) continue;
      const shown = [slide.target.heading.text, ...slide.target.body.map((part: any) => part.text)].join(' ');
      assert.match(shown, /\(ducks?\)/, `${lang} slide ${slide.n}: the duck name keeps its English gloss on the slide`);
    }
    for (const slide of slides) {
      const name = `slide-${String(slide.n).padStart(2, '0')}.webp`;
      assert.deepEqual(
        readFileSync(`public/course-decks/small-livestock/${lang}/${name}`),
        readFileSync(`docs/media/small-livestock-regional/${lang}/${name}`),
        `${lang} ${name}: learner still must match the source-paired review frame`,
      );
    }
  }
});

test('Sesotho Introduction review slides keep uncertain field steps paired in English beside backchecked draft lines', () => {
  const packet = JSON.parse(readFileSync('docs/narration/intro-permaculture.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  const body = (n: number) => slides[n - 1].target.body;

  assert.equal(body(20)[1].status, 'draft');
  assert.equal(body(20)[1].text, 'Ebe o thala metsu e kenang ho tswa kantle bakeng sa letsatsi, moya, mollo le metsi.');
  assert.equal(body(20)[2].status, 'draft');
  assert.equal(body(20)[2].text, 'Leqephe leo la pampiri ke mokokotlo wa moralo wa hao. Ntho e nngwe le e nngwe khosong ena e itshetlehile hodima lona.');
  assert.equal(body(20)[0].status, 'english-hold', 'the rings instruction stays paired in exact English after the backcheck flagged ambiguous wording');

  assert.equal(body(21)[3].status, 'draft');
  assert.equal(body(21)[3].text, 'Nka senepe sa setshwantsho.');
  assert.ok(body(21).slice(0, 3).every((part: any) => part.status === 'english-hold'),
    'technical zone and energy directions stay exact English for facilitator review');

  assert.ok(body(22).every((part: any) => part.status === 'english-hold'),
    'ground checking, counting, crop relocation and wind direction stay exact English after semantic backcheck');
});

test('regional Introduction proposals preserve source-paired meaning beside technical English', () => {
  const ts = validatePairedDraft(
    JSON.parse(readFileSync('docs/narration/intro-permaculture.ts.paired-draft.json', 'utf8')),
    source, 'ts');
  const ve = validatePairedDraft(
    JSON.parse(readFileSync('docs/narration/intro-permaculture.ve.paired-draft.json', 'utf8')),
    source, 've');

  assert.equal(ts[2].target.body[1].status, 'draft', 'the three ethics remain a marked learning goal');
  assert.match(ts[2].target.body[1].text, /yinharhu/);
  assert.equal(ts[6].target.body[2].status, 'draft', 'help-seeking question is a marked Xitsonga draft');
  assert.match(ts[6].target.body[2].text, /milawu ni mphakelo wa mati/, 'question retains rules and water supply');
  assert.equal(ts[6].target.body[0].status, 'mixed',
    'the borehole example is visible as an unreviewed mixed-language draft');
  assert.match(targetVisibleText(ts[6].target.body[0]), /borehole/);
  assert.match(targetVisibleText(ts[6].target.body[0]), /vahakelani/i,
    'the neighbors’ water request remains in the paired sentence');
  assert.equal(ts[5].target.body[1].status, 'mixed',
    'the localized Fair Share opening remains source-paired');
  assert.match(targetVisibleText(ts[5].target.body[1]), /return the surplus to the system/,
    'the held technical clause stays exact English');
  assert.equal(ts[5].target.body[4].status, 'draft',
    'the reciprocal seasonal question is exposed as an unreviewed draft');
  assert.equal(ts[7].target.body[0].status, 'draft', 'ethics purpose is a marked Xitsonga orientation draft');
  assert.equal(ts[7].target.body[1].status, 'mixed');
  assert.match(targetVisibleText(ts[7].target.body[1]), /A neighbour asks to graze cattle after a drought/,
    'the exact scenario remains visible in the mixed draft');
  assert.equal(ts[7].target.body[2].status, 'mixed');
  assert.match(targetVisibleText(ts[7].target.body[2]), /ask permission where it is needed/,
    'the conditional permission instruction remains exact');
  assert.equal(ve[2].target.body[4].status, 'draft', 'the later-plan sketch metaphor is a marked Tshivenda draft');
  assert.equal(ve[2].target.body[2].status, 'mixed');
  assert.equal(ve[2].target.body[3].status, 'mixed');
  assert.match(targetVisibleText(ve[2].target.body[3]), /your zones and your sectors/,
    'technical labels and the one-sheet task stay visible');
});

test('regional Introduction proposals bind all 60 fields, keep every unlisted target, and preserve Sesotho audio', () => {
  const candidatePacket = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-VE-TS-ROOT-60-FINAL-CANDIDATES-2026-10-04.json', 'utf8'));
  const normalizedPacket = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-VE-TS-ROOT-65-NORMALIZED-CANDIDATES-2026-10-04.json', 'utf8'));
  const implementation = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-VE-TS-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  const airflowRepair = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-ROOT-TS19-AIRFLOW-REPAIR-2026-10-04.json', 'utf8'));
  const audioReport = JSON.parse(readFileSync(
    'docs/narration-reviews/INTRO-PERMACULTURE-ST-AUDIO-2026-09-28.json', 'utf8'));
  const exerciseImplementation = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-VE-TS-EXERCISE-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  const changed = new Set<string>();
  assert.equal(candidatePacket.candidateFields.length, 60);

  for (const lang of ['ve', 'ts'] as const) {
    const currentDeck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'));
    // Rebuild the earlier 60-field snapshot because the later approved exercise batch revises three of its
    // target cells; the historical checks still verify their original wording and all other prior coverage.
    const deck = structuredClone(currentDeck);
    for (const applied of implementation.changes[lang].appliedFields) {
      const override = implementation.finalOverrides?.find((item: any) =>
        item.scope.language === lang && item.scope.slide === applied.slide && item.scope.bodyIndex === applied.bodyIndex);
      const previous = override?.finalTarget ?? (applied.storedTargetStatus === 'mixed'
        ? { status: 'mixed', segments: applied.candidateSegments, provenance: applied.provenance }
        : { status: 'draft', text: applied.targetText, provenance: applied.provenance });
      deck.slides[applied.slide - 1].target.body[applied.bodyIndex] = previous;
    }
    const validated = validatePairedDraft(deck, source, lang);
    const records = candidatePacket.candidateFields.filter((field: any) => field.language === lang);
    assert.equal(records.length, lang === 've' ? 29 : 31);
    assert.deepEqual(records.reduce((counts: Record<string, number>, field: any) => {
      counts[field.candidateStatus] = (counts[field.candidateStatus] ?? 0) + 1;
      return counts;
    }, {}), lang === 've' ? { mixed: 23, draft: 6 } : { mixed: 25, draft: 6 },
    `${lang}: retain the packet's distinction between mixed and fully drafted fields`);
    const allowed = new Set(records.map((field: any) => `${field.slide}:${field.bodyIndex}`));

    for (const field of records) {
      const key = `${lang}:${field.slide}:${field.bodyIndex}`;
      changed.add(key);
      assert.equal(field.sourceBinding.exactSourceMatchesPairedRecord, true);
      assert.equal(field.sourceEnglish, source[field.slide - 1].body[field.bodyIndex],
        `${key}: candidate remains bound to canonical English`);
      const segments = field.candidateSegments.map((segment: any) =>
        segment.status === 'draft' ? segment.text : segment.sourceEnglish);
      assert.equal(segments.join(''), field.candidateText, `${key}: segments reconstruct the complete candidate`);
      for (const segment of field.candidateSegments) {
        if (segment.status === 'english-hold') {
          assert.ok(segment.sourceEnglish.trim());
          assert.ok(field.sourceEnglish.includes(segment.sourceEnglish.trim()),
            `${key}: retained English must be an exact source fragment`);
        }
      }
      assert.equal(field.currentTarget.status, 'english-hold', `${key}: source target was held before this batch`);
      const target = validated[field.slide - 1].target.body[field.bodyIndex];
      const finalOverride = implementation.finalOverrides?.find((item: any) =>
        item.scope.language === lang && item.scope.slide === field.slide && item.scope.bodyIndex === field.bodyIndex);
      assert.equal(target.status, finalOverride?.finalTarget.status ?? field.candidateStatus,
        `${key}: keep the candidate's draft or mixed state visible`);
      assert.match(target.provenance ?? '', /unreviewed/);
      if (finalOverride) {
        assert.deepEqual(target, finalOverride.finalTarget, `${key}: preserve the separately reviewed source-bound repair`);
        assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
          `${key}: the repair covers the exact source in order`);
      } else if (field.candidateStatus === 'mixed') {
        assert.deepEqual(target.segments, field.candidateSegments, `${key}: keep exact source-bound segment statuses and boundaries`);
        assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
          `${key}: the translated and exact-English segments cover the complete source in order`);
        for (const segment of target.segments) {
          if (segment.status === 'english-hold') {
            assert.equal(segment.text, undefined, `${key}: retained English has no competing target text`);
            assert.ok(field.sourceEnglish.includes(segment.sourceEnglish), `${key}: retained clause is exact English source`);
          } else {
            assert.ok(segment.text?.trim(), `${key}: each localized clause has visible target text`);
          }
        }
      } else {
        assert.deepEqual(target, {
          status: 'draft',
          text: field.candidateText,
          provenance: 'new-unreviewed-machine-draft; exact source paired; publish for facilitator feedback; fluent review remains open',
        }, `${key}: full draft remains visibly unreviewed`);
      }
    }

    const fields = implementation.changes[lang];
    const restoredBefore65 = structuredClone(deck);
    for (const field of normalizedPacket.candidateFields.filter((item: any) => item.language === lang)) {
      restoredBefore65.slides[field.slide - 1].target.body[field.bodyIndex] = field.currentTarget;
    }
    // Later exercise fields were outside the historical 65-row reconstruction. Restore their recorded
    // before-values as well, so the original digest still checks the exact pre-exercise snapshot.
    for (const field of exerciseImplementation.changedFields.filter((item: any) => item.language === lang)) {
      restoredBefore65.slides[field.slide - 1].target.body[field.bodyIndex] = field.before;
    }
    const preserved = [];
    for (let slideIndex = 0; slideIndex < restoredBefore65.slides.length; slideIndex += 1) {
      preserved.push({ slide: slideIndex + 1, heading: restoredBefore65.slides[slideIndex].target.heading });
      for (let bodyIndex = 0; bodyIndex < restoredBefore65.slides[slideIndex].target.body.length; bodyIndex += 1) {
        if (!allowed.has(`${slideIndex + 1}:${bodyIndex}`)) {
          preserved.push({ slide: slideIndex + 1, bodyIndex, field: restoredBefore65.slides[slideIndex].target.body[bodyIndex] });
        }
      }
    }
    // The fixture digest uses stable object-key order and records every unlisted target plus all headings.
    const stable = (value: any): any => Array.isArray(value) ? value.map(stable) :
      value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
    const stableDigest = createHash('sha256').update(JSON.stringify(stable(preserved)), 'utf8').digest('hex');
    assert.equal(stableDigest, fields.unlistedTargetAndHeadingBeforeSHA256,
      `${lang}: headings and every body field outside the 60 authorized locations stay unchanged`);
  }

  assert.equal(changed.size, 60, 'only the 60 exact source-bound body fields are changed');
  // The later four-field exercise batch is checked separately below; this assertion covers its predecessor's 60-field scope only.

  assert.equal(airflowRepair.scope.language, 'ts');
  assert.equal(airflowRepair.scope.slide, 19);
  assert.equal(airflowRepair.scope.bodyIndex, 2);
  const tsAirflow = JSON.parse(readFileSync('docs/narration/intro-permaculture.ts.paired-draft.json', 'utf8'))
    .slides[18].target.body[2];
  assert.deepEqual(tsAirflow, airflowRepair.finalTarget,
    'the doubtful “around its ends” airflow geometry is kept in exact English while through-flow stays drafted');
  assert.deepEqual(tsAirflow.segments.map((segment: any) => [segment.sourceEnglish, segment.status]), [
    ['Some air passes through the windbreak.', 'draft'],
    [' Other air moves over it or around its ends.', 'english-hold'],
  ]);
  assert.equal(tsAirflow.segments.map((segment: any) => segment.sourceEnglish).join(''),
    airflowRepair.sourceEnglish, 'the held ends clause remains exact and source-complete');
  assert.ok(!targetVisibleText(tsAirflow).includes('around its sides'),
    'the target no longer adds a sides interpretation to the airflow diagram');

  assert.equal(validatedDirection('ve'), true,
    'Tshivenda marks Zone 0 and 1 first, then moves outward');
  assert.equal(validatedDirection('ts'), true,
    'itsonga marks Zone 0 and 1 first, then moves outward');
  for (const lang of ['ve', 'ts'] as const) {
    const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'));
    const text = (slide: number, bodyIndex: number) => targetVisibleText(deck.slides[slide - 1].target.body[bodyIndex]);
    assert.ok(targetVisibleText(deck.slides[14].target.body[0]).includes('0') &&
      targetVisibleText(deck.slides[14].target.body[0]).includes('5'), `${lang}: zone range retains 0 and 5`);
    const inwardFactors = targetVisibleText(deck.slides[19].target.body[1]);
    const translatedFactors = lang === 've'
      ? ['ḓuvha', 'muya', 'mulilo', 'maḓi']
      : ['dyambu', 'moya', 'ndzilo', 'mati'];
    const factorPositions = translatedFactors.map((factor) => inwardFactors.indexOf(factor));
    assert.ok(factorPositions.every((position) => position >= 0), `${lang}: all four source energy objects remain visible`);
    assert.deepEqual(factorPositions, [...factorPositions].sort((a, b) => a - b),
      `${lang}: the translated sun, wind, fire and water labels retain source order`);
    const permission = deck.slides[7].target.body[2];
    assert.ok(permission.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish.includes('ask permission where it is needed')), `${lang}: permission condition remains exact`);
    const timing = deck.slides[9].target.body[0];
    assert.ok(timing.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish.includes('before you commit to major earthworks')),
    `${lang}: adviser timing/commitment condition remains exact`);
    assert.match(text(16, 1), /may be neglected|nga siyiwa/, `${lang}: possible neglect remains qualified`);
    const incoming = text(20, 1);
    assert.ok(lang === 've' ? /dzi tshi dzhena.*bva nnḓa/.test(incoming) : /nghenaka.*ehandle/.test(incoming),
      `${lang}: sector arrows come inward from outside`);
  }

  const stPath = 'docs/narration/intro-permaculture.st.paired-draft.json';
  const stDeck = JSON.parse(readFileSync(stPath, 'utf8'));
  assert.equal(createHash('sha256').update(readFileSync(stPath)).digest('hex'),
    audioReport.sourcePairSha256, 'the 22-slide Sesotho pair retains its recorded audio source hash');
  assert.equal(stDeck.slides.length, 22);
  for (const audioSlide of audioReport.slides) {
    const pairedSlide = stDeck.slides[audioSlide.slide - 1];
    const spoken = pairedSlide.target.body.map((field: any, index: number) =>
      field.status === 'draft' ? field.text : pairedSlide.english.body[index]).join('\n\n');
    assert.equal(spoken, audioSlide.spokenText, `Sesotho slide ${audioSlide.slide} audio stays bound to paired spoken text`);
  }

  const drifted = JSON.parse(JSON.stringify(JSON.parse(readFileSync('docs/narration/intro-permaculture.ve.paired-draft.json', 'utf8'))));
  drifted.slides[0].english.body[1] += ' Changed.';
  assert.throws(() => validatePairedDraft(drifted, source, 've'), /English body differs/,
    'source drift withdraws the entire paired regional draft');
});

test('Intro exercise drafts preserve ordered energy arrows, one-sheet source and site comparison', () => {
  const review = JSON.parse(readFileSync(
    'docs/study-translation-reviews/INTRO-PERMACULTURE-VE-TS-EXERCISE-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  assert.equal(review.changedTargetCount, 4);
  const byKey = new Map(review.changedFields.map((row: any) => [`${row.language}:${row.slide}:${row.bodyIndex}`, row]));
  for (const row of review.changedFields) {
    const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${row.language}.paired-draft.json`, 'utf8'));
    const validated = validatePairedDraft(deck, source, row.language);
    assert.equal(row.sourceEnglish, source[row.slide - 1].body[row.bodyIndex]);
    assert.deepEqual(validated[row.slide - 1].target.body[row.bodyIndex], row.after,
      `${row.language} slide ${row.slide} body ${row.bodyIndex}: keep the independently accepted target`);
    assert.match(row.after.provenance ?? '', /unreviewed/i);
  }

  const factorsByLanguage = {
    ve: ['ḓuvha', 'muya', 'mulilo', 'maḓi'],
    ts: ['dyambu', 'moya', 'ndzilo', 'mati'],
  } as const;
  for (const lang of ['ve', 'ts'] as const) {
    const row = byKey.get(`${lang}:20:1`) as any;
    const actual = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'))
      .slides[19].target.body[1];
    assert.equal(actual.status, 'draft');
    const text = targetVisibleText(actual);
    const positions = factorsByLanguage[lang].map((factor) => text.indexOf(factor));
    assert.ok(positions.every((position) => position >= 0), `${lang}: all four energy objects remain visible`);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${lang}: sun, wind, fire and water keep source order`);
    assert.ok(lang === 've' ? /dzhena.*nnḓa/.test(text) : /nghenaka.*ehandle/.test(text),
      `${lang}: arrows still enter from outside`);
    assert.equal(row.sourceEnglish, 'Then draw arrows in from outside for sun, wind, fire and water.');
  }

  const vePhoto = byKey.get('ve:21:3') as any;
  assert.equal(vePhoto.after.text, 'Dzhiani photo ya sketch.');
  assert.doesNotMatch(vePhoto.after.text, /yaṋu|your/i, 'the source does not assign ownership of the sketch');
  assert.equal(vePhoto.sourceEnglish, 'Photograph the sketch.');

  const tsCompare = byKey.get('ts:22:0') as any;
  assert.deepEqual(tsCompare.after.segments.map((segment: any) => [segment.sourceEnglish, segment.status]), [
    ['Walk out and ', 'draft'], ['check your sketch', 'draft'], [' against the ground.', 'english-hold'],
  ]);
  assert.equal(tsCompare.after.segments.map((segment: any) => segment.sourceEnglish).join(''), tsCompare.sourceEnglish,
    'the walk-out and sketch-to-ground relation remains bound to the complete English sentence');
  assert.equal(tsCompare.after.segments[2].text, undefined, 'the retained site-comparison clause has no competing target');

  for (const held of review.preservedHeldRows) {
    const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${held.language}.paired-draft.json`, 'utf8'));
    const actual = deck.slides[held.slide - 1].target.body[held.bodyIndex];
    const laterField = approvedStudyOutcome('intro-permaculture', held.language, held.slide, held.bodyIndex);
    if (laterField) {
      assert.equal(held.sourceEnglish, laterField.sourceEnglish,
        `${held.language} slide ${held.slide} body ${held.bodyIndex}: later accepted work stays on the same source`);
      assertCurrentStudyOutcome(actual, laterField, `${held.language} slide ${held.slide} body ${held.bodyIndex}`);
      continue;
    }
    assert.deepEqual(actual, held.target,
      `${held.language} slide ${held.slide} body ${held.bodyIndex}: uncertain possessive/direction wording stays held`);
    assert.equal(held.sourceEnglish, source[held.slide - 1].body[held.bodyIndex]);
    const visible = targetVisibleText(actual);
    if (held.sourceEnglish.includes('own zones and sectors')) {
      assert.ok(visible.includes('own zones and sectors'), `${held.language}: do not guess possessive concord before held labels`);
      assert.match(actual.segments.find((segment: any) => segment.status === 'english-hold')?.sourceEnglish ?? '',
        /own zones and sectors/);
    }
    if (held.sourceEnglish.includes('as far as your land goes')) {
      assert.ok(visible.includes('as far as your land goes'), 'full land extent remains explicit while its Tshivenda phrasing is held');
    }
    if (held.sourceEnglish.startsWith('Walk out and')) {
      assert.ok(visible.includes('check your sketch against the ground.'),
        'the existing Tshivenda field step stays paired until a verified replacement is available');
      assert.doesNotMatch(visible, /Fambani|kambelani/,
        'do not publish the rejected Xitsonga-looking verb forms as Tshivenda');
    }
  }

  const drifted = JSON.parse(JSON.stringify(JSON.parse(readFileSync('docs/narration/intro-permaculture.ve.paired-draft.json', 'utf8'))));
  drifted.slides[19].english.body[1] += ' Add a direction.';
  assert.throws(() => validatePairedDraft(drifted, source, 've'), /English body differs/,
    'changing the arrow source invalidates its paired language draft');
  const stPath = 'docs/narration/intro-permaculture.st.paired-draft.json';
  const audioReport = JSON.parse(readFileSync(
    'docs/narration-reviews/INTRO-PERMACULTURE-ST-AUDIO-2026-09-28.json', 'utf8'));
  assert.equal(createHash('sha256').update(readFileSync(stPath)).digest('hex'), audioReport.sourcePairSha256,
    'the excluded Sesotho pair remains byte-for-byte unchanged because its narration is hash-bound');
});

function validatedDirection(language: 've' | 'ts'): boolean {
  const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${language}.paired-draft.json`, 'utf8'));
  const marking = targetVisibleText(deck.slides[20].target.body[1]);
  const outward = targetVisibleText(deck.slides[20].target.body[1]);
  const firstZone = marking.indexOf('Zone 0');
  const secondZone = marking.indexOf('Zone 1');
  const ordered = firstZone >= 0 && secondZone > firstZone && /u thome|ku sungula/.test(outward);
  const proceedsOutward = language === 've' ? /ni bvele nga nnḓa/.test(outward) : /u ya ehandle/.test(outward);
  return ordered && proceedsOutward;
}

function targetVisibleText(part: any): string {
  if (part.status !== 'mixed') return part.text ?? '';
  return part.segments.map((segment: any) =>
    segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');
}

test('standard written Xitsonga uses the same exact source and paragraph pairing as Sesotho', () => {
  const draft = completeHold('ts');
  assert.equal(validatePairedDraft(draft, source, 'ts').length, source.length);
  const lastSlide = draft.slides.at(-1)!;
  const lastTargetParagraph = lastSlide.target.body.at(-1)!;
  lastTargetParagraph.status = 'draft';
  lastTargetParagraph.text = 'Draft copy';
  const validated = validatePairedDraft(draft, source, 'ts');
  assert.equal(validated.at(-1)!.target.body.at(-1)!.text, 'Draft copy');
  lastSlide.english.body[lastSlide.english.body.length - 1] += ' Changed.';
  assert.throws(() => validatePairedDraft(draft, source, 'ts'), /English body differs/);
  assert.throws(() => validatePairedDraft(completeHold('xh'), source, 'xh'), /language is unsupported/);
});

test('Tshivenda source pairing uses its native visible label and the same exact source checks', () => {
  const draft = completeHold('ve');
  assert.equal(pairedDraftLanguageLabel('st'), 'SESOTHO');
  assert.equal(pairedDraftLanguageLabel('ts'), 'XITSONGA');
  assert.equal(pairedDraftLanguageLabel('ve'), 'TSHIVENḒA');
  assert.equal(validatePairedDraft(draft, source, 've').length, source.length);
  draft.language = 'ts';
  assert.throws(() => validatePairedDraft(draft, source, 've'), /language must be ve/);
  assert.equal(pairedDraftLanguageLabel('xh'), null);
});

const forestGuildLessonDrafts = {
  'food-forest': { st: SESOTHO_FOOD_FOREST_DRAFT, ts: XITSONGA_FOOD_FOREST_DRAFT, ve: TSHIVENDA_FOOD_FOREST_DRAFT },
  'plant-guilds': { st: SESOTHO_PLANT_GUILDS_DRAFT, ts: XITSONGA_PLANT_GUILDS_DRAFT, ve: TSHIVENDA_PLANT_GUILDS_DRAFT },
};
/** Food Forest slides repeat lesson passages only whole (counted in `repeated`); Plant Guilds slides also repeat
 * 37 lesson sentences inside longer paragraphs (counted in `runs`). */
const forestGuildMinimums = {
  'food-forest': { slides: 20, names: 40, support: 4, thinning: 2, kept: 25, glossed: 0, repeated: 38, runs: 0 },
  'plant-guilds': { slides: 51, names: 22, support: 28, thinning: 4, kept: 71, glossed: 10, repeated: 26, runs: 37 },
};
/** Qualifications each draft keeps wherever the English carries them, in the lessons and on the slides. */
const forestGuildQualifiers: Record<'food-forest' | 'plant-guilds', Array<[string, Record<'st' | 'ts' | 've', string[]>]>> = {
  'food-forest': [
    ['may provide shelter and useful cut material where appropriate',
      { st: ['di ka fana', 'moo ho loketseng'], ts: ['swi nga nyika', 'laha swi faneleke'], ve: ['dzi nga ṋea', 'hune ha fanela'] }],
    ['Do not wait for a fixed year',
      { st: ['O se ke wa emela selemo'], ts: ['U nga rindzi lembe'], ve: ['Ni songo lindela ṅwaha'] }],
    ['Do not plant from a picture alone', { st: ['O se ke wa jala ka setshwantsho feela'],
      ts: ['U nga byali hi xifaniso ntsena'], ve: ['Ni songo ṱavha nga u sedza tshifanyiso fhedzi'] }],
  ],
  'plant-guilds': [
    ['Support plants can supply food', { st: ['di ka fana'], ts: ['swi nga nyika'], ve: ['dzi nga ṋea'] }],
    ['Flowers can supply resources, but their presence does not guarantee pest control',
      { st: ['di ka fana', 'ha ho tiise'], ts: ['swi nga nyika', 'a ku tiyisekisi'], ve: ['a nga ṋea', 'a si khwaṱhisedzo'] }],
    ['A flowering plant does not guarantee pest control',
      { st: ['ha se tiise'], ts: ['a xi tiyisekisi'], ve: ['a si khwaṱhisedzo'] }],
    ['Bocking 14 does not spread by viable seed', { st: ['Bocking 14 ha e phatlalale ka viable seed'],
      ts: ['Bocking 14 a yi hangalali hi viable seed'], ve: ['a i andi nga viable seed'] }],
    ['Do not promise that a ring of wild garlic',
      { st: ['O se ke wa tshepisa'], ts: ['U nga tshembisi'], ve: ['Ni songo fulufhedzisa'] }],
    ['thinning does not instantly stop root competition',
      { st: ['ha ho emise hang-hang'], ts: ['a yi herisi hi ku hatlisa-hatlisa'], ve: ['a i imisi', 'nga u ṱavhanya'] }],
  ],
};
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** A complete silent Food Forest or Plant Guilds deck. Every heading and paragraph is a labelled, back-translated
 * unreviewed draft beside its exact English. Species names, "support plant", "thinning", the other kept technical
 * terms and the insect/pest glosses survive, and a sentence the lessons repeat on a slide shows the lesson's own
 * draft. Each learner still is the frame rendered from this exact paired draft and English source, with no
 * language or farming review, regional narration or English hold claimed, and the deck saves offline as every
 * frame with no narration unless English narration is chosen. */
function checkForestGuildDeck(module: 'food-forest' | 'plant-guilds', lang: 'st' | 'ts' | 've') {
  const minimum = forestGuildMinimums[module];
  const englishPath = `docs/narration/${module}.en.md`;
  const pairedPath = `docs/narration/${module}.${lang}.paired-draft.json`;
  const packet = JSON.parse(readFileSync(pairedPath, 'utf8'));
  const slides = validatePairedDraft(packet, englishSlideRecords(readFileSync(englishPath, 'utf8')), lang);
  const path = `${lang} ${module} slides`;
  assert.equal(packet.reviewStatus, 'unreviewed');
  assert.equal(slides.length, minimum.slides);
  const pairs = checkCompleteSlideDrafts(slides, lang, path, FOREST_GUILD_FORBIDDEN_WORDS[lang]);
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, path) >= minimum.names, `${path}: every species mention checked`);
  assert.ok(checkSupportPlantTerms(pairs, path) >= minimum.support, `${path}: every support-plant mention checked`);
  assert.ok(checkThinningKept(pairs, path) >= minimum.thinning, `${path}: every thinning mention checked`);
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, path) >= minimum.kept, `${path}: every kept term checked`);
  assert.ok(checkGlossedWords(pairs, path) >= minimum.glossed, `${path}: every insect, pest, bacteria and pod checked`);
  if (lang === 'st') checkSouthAfricanSesotho(pairs, path);
  const lessonPairs = sourceDraftPairs(forestGuildLessonDrafts[module][lang], lang);
  assert.ok(checkConsistentDrafts([...lessonPairs, ...pairs], `${lang} ${module}`) >= minimum.repeated,
    `${lang} ${module}: every passage repeated between the lessons and slides checked`);
  assert.ok(checkRepeatedSentences(lessonPairs, pairs, path) >= minimum.runs,
    `${path}: every lesson passage repeated inside a slide paragraph checked`);
  checkCreatureWords([...lessonPairs, ...pairs], lang, `${lang} ${module}`);
  for (const [english, phrases] of forestGuildQualifiers[module]) {
    const found = [...lessonPairs, ...pairs].filter(([passage]) => passage.includes(english));
    assert.ok(found.length > 0, `${path}: "${english}" is still in the English`);
    for (const [, draft] of found) assertKeeps(draft, phrases[lang], `${path}: "${english}" keeps its qualification`);
  }

  const qa = module === 'food-forest' ? 'docs/media/food-forest/qa' : 'docs/media/plant-guilds-regional/qa';
  const report = JSON.parse(readFileSync(`${qa}/${lang}-paired-verification.json`, 'utf8'));
  assert.equal(report.pairedSourceSha256, sha256(pairedPath), `${path}: the stills were rendered from this paired draft`);
  assert.equal(report.englishSourceSha256, sha256(englishPath), `${path}: the stills were rendered against this English`);
  assert.deepEqual(
    [report.reviewStatus, report.humanLanguageReview, report.localFarmingReview, report.narration, report.englishHoldCount],
    ['unreviewed-machine-draft', false, false, null, 0],
    `${path}: no review or regional narration is claimed and no English hold remains`);
  assert.equal(report.slides.length, minimum.slides);
  for (const slide of slides) {
    const still = `public/course-decks/${module}/${lang}/slide-${String(slide.n).padStart(2, '0')}.webp`;
    assert.equal(report.slides[slide.n - 1].path, still);
    assert.equal(sha256(still), report.slides[slide.n - 1].sha256, `${still} is the rendered source-paired frame`);
  }
  const variant = defaultOfflinePackVariant([module], lang);
  const pack = offlinePack(module, lang, 'standard', variant);
  assert.equal(variant, 'slides', `${path}: the silent deck saves slides only unless English narration is chosen`);
  assert.deepEqual(pack.missing, [], `${path}: every slide-only offline file exists`);
  assert.equal(pack.entries.filter((entry) => entry.url.includes(`/course-decks/${module}/${lang}/`)).length, minimum.slides,
    `${path}: every frame is saved for offline use`);
  assert.ok(pack.entries.every((entry) => entry.kind === 'slide' || entry.kind === 'poster'),
    `${path}: the slide-only pack carries no narration or animation`);
  return slides;
}

// Rewritten 4 October 2026: the authorized VE/TS introduction batch replaces 60 exact held fields with visibly
// unreviewed, source-paired drafts. The implementation test below binds each field and hashes every untouched
// target and heading, so this test keeps only the independent deck validation and the pre-existing checked examples.
test('regional Introduction drafts remain paired to all current English slides', () => {
  for (const lang of ['ve', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 22);
    assert.ok(slides.every((slide: any) => slide.english.body.length === slide.target.body.length),
      `${lang}: every draft and hold remains paired to the complete source slide`);
    for (const slide of slides) {
      for (const [index, paragraph] of slide.target.body.entries()) {
        if (paragraph.status === 'draft') {
          assert.ok(paragraph.text?.trim(), `${lang} slide ${slide.n} paragraph ${index + 1} has visible draft text`);
        }
      }
    }
  }
});

// Rewritten 2 October 2026: with no English holds left, every Food Forest passage in all three languages is a
// draft, so the pairing check covers the whole deck: no draft repeats its English, and a changed English
// sentence anywhere, including the closing follow-up checks that used to stay in English, blocks the packet.
test('regional Food Forest media pairs every drafted sentence with its current English narration', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  for (const lang of ['st', 'ts', 've'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/food-forest.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const slide of slides) {
      for (const [index, paragraph] of slide.target.body.entries()) {
        assert.equal(paragraph.status, 'draft', `${lang} slide ${slide.n} paragraph ${index + 1} is drafted`);
        assert.notEqual(paragraph.text, slide.english.body[index],
          `${lang} slide ${slide.n} paragraph ${index + 1} must not disguise English as a translation`);
      }
    }
    for (const [slideIndex, paragraphIndex] of [[19, 2], [12, 2], [6, 2]]) {
      const changed = structuredClone(source);
      changed[slideIndex].body[paragraphIndex] += ' Water every day.';
      assert.throws(() => validatePairedDraft(packet, changed, lang),
        new RegExp(`slide ${slideIndex + 1}: English body differs`), `${lang}: a changed English sentence blocks the deck`);
    }
  }
});

// Rewritten 2 October 2026: the Sesotho deck no longer holds its canopy, competition, layer, approved-species,
// ecosystem and grassland guidance in English; all 20 slides are drafted in full. The forest-pattern sentences
// shared with lesson 1 must still show the lesson's own Sesotho draft, now alongside every other repeat.
test('Food Forest Sesotho slides draft every passage and reuse the lesson draft wherever a lesson sentence repeats', () => {
  const slides = checkForestGuildDeck('food-forest', 'st');
  const lessonBody = SESOTHO_FOOD_FOREST_DRAFT.lessons[0].body;
  const lessonEnglish = lessonBody.sourceEnglish.split('\n\n');
  const lessonSesotho = lessonBody.sesothoDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 1, 1], [3, 2, 2], [3, 3, 3], [7, 1, 11]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], lessonEnglish[lessonParagraph],
      `slide ${slideIndex + 1} must use the exact lesson source sentence`);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, lessonSesotho[lessonParagraph],
      `slide ${slideIndex + 1} must reuse the lesson's Sesotho draft sentence`);
  }
  assertKeepsTerms(slides[12].target.body[0].text, ['indigenous', 'habitat'], 'st slide 13: indigenous plants and habitat');
  assertKeepsTerms(slides[19].target.body[1].text, ['nursery plants'], 'st slide 20: prepare nursery plants');
});

// Rewritten 2 October 2026: the Tshivenda deck no longer keeps its field care, ecosystem and grassland guidance in
// English; all 20 slides are drafted in full beside exact English. Sentences shared with lesson 1 must still show
// the lesson's own Tshivenda draft.
test('Tshivenda Food Forest slides draft habitat, field-care and grassland guidance and reuse the lesson draft', () => {
  const slides = checkForestGuildDeck('food-forest', 've');
  const lesson = TSHIVENDA_FOOD_FOREST_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.tshivendaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 2, 2], [3, 3, 3], [5, 0, 4]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assertKeepsTerms(slides[12].target.body[1].text, ['ecosystem'], 've slide 13: choose for your ecosystem');
  assertKeepsTerms(slides[19].target.body[1].text, ['nursery plants'], 've slide 20: prepare nursery plants');
});

test('Vegetables paired drafts keep the one-crop limit and source-bound seasonal framing', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const sesothoPacket = JSON.parse(readFileSync('docs/narration/vegetables-staples.st.paired-draft.json', 'utf8'));
  const sesothoSlides = validatePairedDraft(sesothoPacket, source, 'st');
  const sesothoLesson = SESOTHO_VEGETABLES_STAPLES_DRAFT.lessons[2].body;
  const sesothoEnglish = sesothoLesson.sourceEnglish.split('\n\n');
  const sesothoDraft = sesothoLesson.sesothoDraft.split('\n\n');
  assert.equal(sesothoSlides[13].target.body[0].status, 'draft');
  assert.equal(sesothoSlides[13].english.body[0], sesothoEnglish[11]);
  assert.equal(sesothoSlides[13].target.body[0].text, sesothoDraft[11]);

  const packet = JSON.parse(readFileSync('docs/narration/vegetables-staples.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  assert.equal(slides[0].target.body[2].status, 'mixed');
  assert.equal(slides[0].target.body[2].segments.at(-1).status, 'english-hold',
    'the uncertain “what to do when pests arrive” agenda clause stays exact English');
  assert.equal(slides[1].english.body[1], source[1].body[1]);
  assert.equal(slides[1].target.body[1].status, 'draft',
    'the four-part sowing-gap example remains a visibly unreviewed draft beside its exact source');
  assert.equal(slides[1].english.body[3], source[1].body[3]);
  assert.equal(slides[1].target.body[3].status, 'draft',
    'the sowing, tending and harvesting overlap remains a draft tied to the correct seasonal sentence');
  const lesson = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.xitsongaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[12, 5, 10], [13, 0, 11], [13, 1, 12], [13, 2, 13], [13, 3, 14], [13, 4, 15]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assert.equal(slides[13].target.body[2].status, 'draft');
  assert.ok(slides[13].target.body[2].text.includes('point of failure'),
    'the source-matched draft keeps the one-crop point-of-failure claim explicit');
  assert.equal(slides[13].target.body[3].status, 'draft');
  assert.ok(slides[13].target.body[3].text.includes('Two or more staples'),
    'the source-matched next paragraph preserves the minimum of two staple crops');
  assert.ok(slides[13].target.body[3].text.includes('tindlela to tala ta ku ya mahlweni u dya'),
    'the Xitsonga wording keeps the continued-food benefit tied to multiple staples');
});

// 5 October 2026: the fuller L1 batch adds explicit English anchors inside some approved
// learner targets. A mixed row is reusable only when its visible composition equals the
// resolver text and its segments still cover the complete canonical paragraph in order.
test('Vegetables opening frames retain exact source holds and reuse complete L1 learner compositions', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const lesson = COURSE_MODULES.find(({ id }) => id === 'vegetables-staples')!.lessons
    .find(({ id }) => id === 'vegetables-staples-l1')!;
  const canonicalBody = lesson.body.split('\n\n');
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    const welcome = slides[0].target.body[0];
    assert.equal(welcome.status, 'mixed');
    assert.equal(welcome.segments.map((segment: any) => segment.sourceEnglish).join(''), source[0].body[0]);
    assert.ok(welcome.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish === 'Vegetables and Staple Crops.'),
    `${lang}: the official module title stays an exact, visibly held name`);
    for (const bodyIndex of [1, 2, 3, 4]) {
      const part = slides[2].target.body[bodyIndex];
      const accepted = approvedStudyOutcome('vegetables-staples', lang, 3, bodyIndex);
      if (accepted) {
        assertCurrentStudyOutcome(part, accepted, `${lang} Vegetables slide 3 body ${bodyIndex}`);
      } else {
        assert.equal(part.status, 'english-hold',
          `${lang} Vegetables slide 3 body ${bodyIndex} remains exact English until an approved paired draft exists`);
      }
    }
    const closing = slides[2].target.body[5];
    assert.equal(closing.status, 'mixed');
    assert.equal(closing.segments.map((segment: any) => segment.sourceEnglish).join(''), source[2].body[5]);
    assert.deepEqual(closing.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish), [
      'A well-shaped bed still fails if everything goes in on one day. ',
      'A diverse planting still struggles if you treat every yellow leaf as an insect problem.',
    ], `${lang}: only the connective sentence is newly drafted; the two source cautions remain exact English`);

    const learner = resolveLearnerLessonPresentation(lesson, lang);
    assert.equal(learner.status, 'draft');
    const learnerBody = learner.content.body.split('\n\n');
    for (let index = 0; index < 14; index++) {
      const slideNumber = index < 4 ? 4 : index < 11 ? 5 : 6;
      const bodyIndex = index < 4 ? index : index < 11 ? index - 4 : index - 11;
      const part = slides[slideNumber - 1].target.body[bodyIndex];
      assert.equal(slides[slideNumber - 1].english.body[bodyIndex], canonicalBody[index],
        `${lang} slide ${slideNumber}: the whole lesson passage is the exact reuse source`);
      assert.ok(part.status === 'draft' || part.status === 'mixed',
        `${lang} slide ${slideNumber} body ${bodyIndex}: source-matched learner wording stays visibly a draft`);
      if (part.status === 'mixed') {
        assert.equal(part.segments.map((segment: any) => segment.sourceEnglish).join(''), canonicalBody[index],
          `${lang} slide ${slideNumber} body ${bodyIndex}: mixed segments cover the complete canonical paragraph`);
      }
      assert.equal(targetVisibleText(part), learnerBody[index],
        `${lang} slide ${slideNumber}: reuse only the resolver's current source-bound learner passage`);
    }
  }
});

test('Vegetables middle slides reuse whole source-matched lesson paragraphs and keep treatment safeguards intact', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const module = COURSE_MODULES.find(({ id }) => id === 'vegetables-staples')!;
  // The final L2 coherence batch translates this complete row and the other
  // accepted exact-source candidates; no complete source match remains held here.
  const expectedHolds = new Set<string>();
  let sourceMatches = 0;
  let reusedDrafts = 0;
  const actualHolds = new Set<string>();

  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (let slideIndex = 6; slideIndex < 16; slideIndex++) {
      for (let bodyIndex = 0; bodyIndex < slides[slideIndex].english.body.length; bodyIndex++) {
        const exactSource = slides[slideIndex].english.body[bodyIndex];
        const bindings = module.lessons.flatMap((lesson) => lesson.body.split('\n\n')
          .flatMap((paragraph, paragraphIndex) => paragraph === exactSource
            ? [{ lesson, paragraph, paragraphIndex }]
            : []));
        if (bindings.length === 0) continue;

        sourceMatches++;
        assert.equal(bindings.length, 1, `${lang} slide ${slideIndex + 1}: source paragraph has one canonical lesson binding`);
        const [{ lesson, paragraph, paragraphIndex }] = bindings;
        assert.equal(paragraph, exactSource, `${lang} slide ${slideIndex + 1}: keep the entire English lesson paragraph byte-identical`);
        const learnerBody = resolveLearnerLessonPresentation(lesson, lang).content.body.split('\n\n');
        const part = slides[slideIndex].target.body[bodyIndex];
        const key = `${lang}:${slideIndex + 1}:${bodyIndex + 1}`;

        if (part.status === 'draft' || part.status === 'mixed') {
          reusedDrafts++;
          assert.notEqual(learnerBody[paragraphIndex], exactSource,
            `${key}: an unchanged English paragraph must remain an explicit hold`);
          assert.equal(targetVisibleText(part), learnerBody[paragraphIndex],
            `${key}: deck prose must exactly match the current learner resolver for its complete source paragraph`);
          if (part.status === 'mixed') {
            assert.equal(part.segments.map((segment: any) => segment.sourceEnglish).join(''), exactSource,
              `${key}: mixed draft segments must preserve complete canonical source coverage`);
            assert.ok(part.segments.some((segment: any) => segment.status === 'draft'),
              `${key}: mixed status includes actual localized learner prose`);
          }
        } else {
          assert.equal(part.status, 'english-hold', `${key}: a source match cannot be silently dropped or relabelled`);
          assert.equal('text' in part, false, `${key}: an English hold has no detached replacement copy`);
          actualHolds.add(key);
        }
      }
    }
  }

  assert.equal(sourceMatches, 171, 'slides 7–16 contain 171 complete source-matched paragraphs across the three languages');
  assert.deepEqual(actualHolds, expectedHolds,
    'every complete source-matched learner paragraph in these middle slides now uses its current draft; technical English remains inside the exact learner composition where needed');
  assert.equal(reusedDrafts, sourceMatches - expectedHolds.size,
    'every other whole source-matched lesson paragraph uses its current learner draft in the deck');

  const tsSlides = validatePairedDraft(
    JSON.parse(readFileSync('docs/narration/vegetables-staples.ts.paired-draft.json', 'utf8')),
    source,
    'ts',
  );
  const maizeLesson = module.lessons.find(({ id }) => id === 'vegetables-staples-l2')!;
  const maizeSource = 'Maize gives height and structure.';
  const maizeIndex = maizeLesson.body.split('\n\n').findIndex((paragraph) => paragraph === maizeSource);
  assert.notEqual(maizeIndex, -1, 'the maize signpost resolves to one complete canonical lesson paragraph');
  assert.equal(tsSlides[9].english.body[2], maizeSource);
  assert.deepEqual(tsSlides[9].target.body[2], {
    status: 'draft',
    text: resolveLearnerLessonPresentation(maizeLesson, 'ts').content.body.split('\n\n')[maizeIndex],
  }, 'reuse the current source-bound Xitsonga height draft while preserving the exact English structure anchor');

  const beansSource = 'Beans climb the maize, and store as protein.';
  const beansIndex = maizeLesson.body.split('\n\n').findIndex((paragraph) => paragraph === beansSource);
  assert.notEqual(beansIndex, -1, 'the Beans sentence remains a separately bound source paragraph');
  assert.equal(tsSlides[9].english.body[3], beansSource);
  const beansTarget = tsSlides[9].target.body[3];
  assert.equal(beansTarget.status, 'draft');
  assert.equal(beansTarget.text, resolveLearnerLessonPresentation(maizeLesson, 'ts').content.body.split('\n\n')[beansIndex]);
  assert.equal(beansTarget.text.match(/and store as protein/g)?.length, 1,
    'the protein-storage claim stays exact English within the source-bound draft');

  const treatmentSource = 'If a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.';
  for (const lang of ['st', 've', 'ts'] as const) {
    const slides = validatePairedDraft(
      JSON.parse(readFileSync(`docs/narration/vegetables-staples.${lang}.paired-draft.json`, 'utf8')),
      source,
      lang,
    );
    const treatment = slides[15].target.body[5];
    assert.equal(slides[15].english.body[5], treatmentSource, `${lang}: preserve the exact registered-product source`);
    assert.equal(treatment.status, 'mixed',
      `${lang}: the root-accepted full-field draft may translate ordinary wording around exact safety anchors`);
    assert.equal(treatment.segments.map((segment: any) => segment.sourceEnglish).join(''), treatmentSource,
      `${lang}: all treatment clauses remain in source order with complete coverage`);
    const safetyAnchors = [
      'product registered for that crop and pest', 'label', 'neem products.',
      'protection and harvest waiting instructions.', 'Do not improvise mixtures or stronger doses.',
    ];
    const heldSource = treatment.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish).join('');
    for (const anchor of safetyAnchors) assert.ok(heldSource.includes(anchor), `${lang}: exact English safety anchor remains held: ${anchor}`);
    const learnerLesson = module.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
    const learnerTreatment = resolveLearnerLessonPresentation(learnerLesson, lang).content.body.split('\n\n')[10];
    assert.equal(targetVisibleText(treatment), learnerTreatment,
      `${lang}: the mixed deck composition exactly matches the current source-bound learner field`);
  }
});

test('Vegetables Field Action pairs the week, ordered steps, observed comparison and advice with their exact sources', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const expected: Record<'st' | 've' | 'ts', Record<number, string>> = {
    st: {
      0: 'Bekeng ena, kenya bed e le nngwe tlhahisong.',
      1: 'Nngwe. Tshwaya bed le paths.',
      2: 'Pedi. Jala ka spacing ya hao le sowing rhythm ya hao.',
      3: 'Tharo. Kgutla ka mora matsatsi a leshome, o tshotse foto.',
      6: 'Sehla ka seng, serapa sa hao becomes less dependent on guesswork — mme haholo ka seo o hlileng o se boneng se etsahala on your own ground.',
      7: 'Sebedisa rekoto ya hao with reliable local advice ha o etsa qeto e latelang.',
    },
    ve: {
      0: 'Vhege ino, shumisani bed nthihi kha production.',
      1: 'Tshithihi. Swayani bed na paths.',
      2: 'Mbili. Ṱavhani, ni tshi tevhedza spacing yaṋu na sowing rhythm yaṋu.',
      3: 'Raru. Vhuyani nga murahu ha maḓuvha a fumi, ni na foto.',
      6: 'Khalaṅwaha iṅwe na iṅwe, your garden becomes less dependent on guesswork — and more on zwe na zwi vhona zwa vhukuma zwi tshi itea on your own ground.',
      7: 'Shumisani rekhodo yaṋu with reliable local advice musi ni tshi dzhia tsheo i tevhelaho.',
    },
    ts: {
      0: 'Vhiki leri, nghenisa bed yin’we eka production.',
      1: 'Xin’we. Maka bed na paths.',
      2: 'Mbirhi. Byala hi spacing ya wena ni sowing rhythm ya wena.',
      3: 'Nharhu. Vuya endzhaku ka masiku ya khume, u ri na foto.',
      6: 'Nguva yin’wana ni yin’wana, ntanga wa wena becomes less dependent on guesswork — naswona wu titshega ngopfu hi leswi u swi voneke swi humelela hakunene on your own ground.',
      7: 'Tirhisa rhekhodo ya wena with reliable local advice loko u endla xiboho lexi landzelaka.',
    },
  };
  const sources = [
    'This week, put one bed into production.',
    'One. Mark the bed and the paths.',
    'Two. Plant, with your spacing and your sowing rhythm.',
    'Three. Return after ten days, with a photo.',
    'Season by season, your garden becomes less dependent on guesswork — and more on what you\'ve actually seen happen on your own ground.',
    'Use your record with reliable local advice when making the next decision.',
  ];
  const indexes = [0, 1, 2, 3, 6, 7];
  const originalRecordFields = {
    st: { status: 'mixed', segments: [
      { sourceEnglish: 'Record the sowing date.', status: 'draft', text: 'Ngola letsatsi la sowing.' },
      { sourceEnglish: ' The rain.', status: 'draft', text: ' Pula.' },
      { sourceEnglish: ' What germinated.', status: 'english-hold' },
      { sourceEnglish: ' Pest pressure.', status: 'english-hold' },
      { sourceEnglish: ' What you harvested.', status: 'draft', text: ' Seo o se kotutseng.' },
    ], provenance: 'new-unreviewed-machine-draft; exact source paired; publish for facilitator feedback; fluent review remains open' },
    ve: { status: 'mixed', segments: [
      { sourceEnglish: 'Record the sowing date.', status: 'draft', text: 'Ṅwalani datumu ya sowing.' },
      { sourceEnglish: ' The rain.', status: 'draft', text: ' Mvula.' },
      { sourceEnglish: ' What germinated.', status: 'english-hold' },
      { sourceEnglish: ' Pest pressure.', status: 'english-hold' },
      { sourceEnglish: ' What you harvested.', status: 'english-hold' },
    ], provenance: 'new-unreviewed-machine-draft; exact source paired; publish for facilitator feedback; fluent review remains open' },
    ts: { status: 'mixed', segments: [
      { sourceEnglish: 'Record the sowing date.', status: 'draft', text: 'Tsala siku ra sowing.' },
      { sourceEnglish: ' The rain.', status: 'draft', text: ' Mpfula.' },
      { sourceEnglish: ' What germinated.', status: 'english-hold' },
      { sourceEnglish: ' Pest pressure.', status: 'english-hold' },
      { sourceEnglish: ' What you harvested.', status: 'draft', text: ' Leswi u tshoveleke.' },
    ], provenance: 'new-unreviewed-machine-draft; exact source paired; publish for facilitator feedback; fluent review remains open' },
  };

  for (const language of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, language);
    const field = slides[17];
    assert.equal(packet.reviewStatus, 'unreviewed');
    for (const [offset, bodyIndex] of indexes.entries()) {
      assert.equal(field.english.body[bodyIndex], sources[offset], `${language} body ${bodyIndex}: exact English source remains paired`);
      const target = field.target.body[bodyIndex];
      const actual = target.status === 'draft' ? target.text : target.segments.map((segment: any) =>
        segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');
      assert.equal(actual, expected[language][bodyIndex], `${language} body ${bodyIndex}: accepted unreviewed wording`);
      assert.ok(['draft', 'mixed'].includes(target.status));
    }

    assert.equal(field.target.body[4].text,
      language === 'st' ? 'Ebe o sheba. O fetole. Mme o ngole fatshe.' :
      language === 've' ? 'Nga murahu ni sedze. Ni lulamise. Ni ṅwale fhasi.' :
      'Kutani languta. Lulamisa. Tsala leswi ehansi.',
      `${language}: the unlisted observe/adjust/write action remains unchanged`);
    assert.deepEqual(field.target.body[5], originalRecordFields[language],
      `${language}: preserve every original record item, hold, and unreviewed provenance`);

    const week = field.target.body[0];
    assert.match(week.text, /bed/);
    assert.match(field.target.body[1].text, /bed.*paths/);
    assert.match(field.target.body[2].text, /spacing.*sowing rhythm/);
    assert.match(field.target.body[3].text, /(?:ten days|matsatsi a leshome|maḓuvha a fumi|masiku ya khume)/);
    assert.match(field.target.body[3].text, /photo|foto/);
    const comparison = field.target.body[6];
    assert.equal(comparison.status, 'mixed');
    assert.ok(comparison.segments.some((segment: any) => segment.status === 'english-hold' && segment.sourceEnglish === 'becomes less dependent on guesswork'));
    assert.ok(comparison.segments.some((segment: any) => segment.status === 'draft' && /actually seen|hlileng o se boneng|vhukuma|hakunene/.test(segment.text ?? '')),
      `${language}: the positive comparison stays tied to what was actually observed`);
    const advice = field.target.body[7];
    assert.equal(advice.status, 'mixed');
    assert.ok(advice.segments.some((segment: any) => segment.status === 'english-hold' && segment.sourceEnglish === 'with reliable local advice'));
    assert.equal(advice.segments.at(-1)?.sourceEnglish, ' when making the next decision.');
  }

  const stale = JSON.parse(readFileSync('docs/narration/vegetables-staples.ts.paired-draft.json', 'utf8'));
  stale.slides[17].english.body[2] = 'Two. Plant with any spacing you like.';
  assert.throws(() => validatePairedDraft(stale, source, 'ts'), /slide 18: English body differs/,
    'a deck cannot keep regional wording after its planting instruction changes');
});

test('Sesotho Market records slides retain six learner draft sentences as the deck grows', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/market-community.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  const map = [[2, 1, 0], [2, 2, 1], [5, 1, 3], [5, 4, 6], [6, 1, 7], [6, 4, 10]];
  const lesson = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.sesothoDraft.split('\n\n');
  for (const [n, p, i] of map) {
    assert.equal(slides[n - 1].target.body[p - 1].status, 'draft');
    assert.equal(slides[n - 1].english.body[p - 1], english[i]);
    assert.equal(slides[n - 1].target.body[p - 1].text, translated[i]);
  }
  const units = slides[4].target.body[1];
  assert.equal(units.status, 'draft', 'the record sentence is source-paired while its units remain explicit');
  assert.ok(['kilograms', 'dozens', 'bundles'].every((unit) => units.text.includes(unit)),
    'the draft preserves the stated harvest units instead of relabelling quantities');
});

test('Xitsonga Market media retains two established learner concepts beside exact English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/market-community.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  const map = [[2, 1, 'market-community-l1', 0], [18, 1, 'market-community-l3', 9]] as const;
  for (const [n, p, lessonId, paragraphIndex] of map) {
    assert.equal(slides[n - 1].target.body[p - 1].status, 'draft');
    const body = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === lessonId)!.body;
    assert.equal(slides[n - 1].english.body[p - 1], body.sourceEnglish.split('\n\n')[paragraphIndex]);
    assert.equal(slides[n - 1].target.body[p - 1].text, body.xitsongaDraft.split('\n\n')[paragraphIndex]);
  }
  const specialistAdvice = slides[17].target.body[2];
  assert.equal(specialistAdvice.status, 'draft');
  // The ordinary request now reuses the checked learner paragraph; specialist terms stay exact.
  assert.equal(specialistAdvice.text,
    XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === 'market-community-l3')!.body.xitsongaDraft.split('\n\n')[11]);
  assert.ok(specialistAdvice.text.startsWith('Lavani qualified advice eka unfamiliar disease or technical problems.'),
    'the request still seeks qualified advice for unfamiliar disease or technical problems');
  assert.equal(slides[17].english.body[2], source[17].body[2]);
});

test('Tshivenda staples media keeps unresolved crop terminology visible beside source-matched prose', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 've');
  assert.equal(slides[1].target.body[2].status, 'mixed',
    'the garden/no-food clause stays exact English where a reliable Tshivenda garden concord is unresolved');
  assert.equal(slides[1].target.body[2].segments.at(-1).sourceEnglish,
    "The garden is full of plants, but there's no food in it.");
  assert.equal(slides[1].target.body[3].status, 'draft');
  assert.equal(slides[1].target.body[4].status, 'draft');
  const stapleLesson = COURSE_MODULES.find(({ id }) => id === 'vegetables-staples')!.lessons
    .find(({ id }) => id === 'vegetables-staples-l3')!;
  const stapleParagraph = stapleLesson.body.split('\n\n').findIndex((paragraph) => paragraph === slides[11].english.body[0]);
  const stapleCandidate = resolveLearnerLessonPresentation(stapleLesson, 've').content.body.split('\n\n')[stapleParagraph];
  assert.equal(slides[11].target.body[0].status, 'draft',
    'the complete source-matched paragraph is reusable as a visibly unreviewed learner draft');
  assert.equal(slides[11].target.body[0].text, stapleCandidate,
    'reuse the current resolver wording instead of retaining an obsolete English-only status');
  assert.ok(stapleCandidate.includes('[staple]'),
    'keep the unresolved crop-category label visibly in English inside the draft');
  assert.equal(slides[13].english.body[1], TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.sourceEnglish);
  assert.equal(slides[13].target.body[1].text, TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.tshivendaDraft);
  const minimumCrops = stapleLesson.body.split('\n\n').findIndex((paragraph) => paragraph === slides[11].english.body[3]);
  assert.equal(slides[11].target.body[3].status, 'draft');
  assert.equal(slides[11].target.body[3].text,
    resolveLearnerLessonPresentation(stapleLesson, 've').content.body.split('\n\n')[minimumCrops]);
  assert.match(slides[11].target.body[3].text, /zwivhili kana zwo engaho/i,
    'the action minimum remains two or more crops after the English-only claim is drafted');
  const multiStaples = stapleLesson.body.split('\n\n').findIndex((paragraph) => paragraph === slides[13].english.body[3]);
  assert.equal(slides[13].target.body[3].status, 'draft');
  assert.equal(slides[13].target.body[3].text,
    resolveLearnerLessonPresentation(stapleLesson, 've').content.body.split('\n\n')[multiStaples]);
  assert.ok(slides[13].target.body[3].text.includes('u bvela phanḓa ni tshiḽa'),
    'the additional staple crops keep the stated benefit of more ways to continue eating');
});

test('Vegetables field assignment drafts keep measurements, paths, checkpoints and source conditions intact', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(slides[2].target.heading.status, 'draft');
    assert.equal(slides[2].english.heading, source[2].heading,
      `${lang} slide3 keeps the exact English heading source`);
    for (const bodyIndex of [1, 2, 3, 4]) {
      const part = slides[2].target.body[bodyIndex];
      const accepted = approvedStudyOutcome('vegetables-staples', lang, 3, bodyIndex);
      if (accepted) {
        assertCurrentStudyOutcome(part, accepted, `${lang} Vegetables assignment slide body ${bodyIndex}`);
      } else {
        assert.equal(part.status, 'english-hold', `${lang}: this unapproved assignment field stays exact English`);
      }
    }
    assert.equal(slides[2].target.body[5].status, 'mixed');
    assert.deepEqual(slides[2].target.body[5].segments.slice(1).map((segment: any) => segment.sourceEnglish), [
      'A well-shaped bed still fails if everything goes in on one day. ',
      'A diverse planting still struggles if you treat every yellow leaf as an insect problem.',
    ], `${lang}: both one-day planting and yellow-leaf diagnostic cautions remain held`);
    assert.equal(slides[1].english.heading, 'Why This Matters');
    assert.equal(slides[1].english.body[3], source[1].body[3],
      `${lang}: preserve the exact seasonal-overlap source clause`);
    assert.ok(['draft', 'mixed'].includes(slides[1].target.body[3].status),
      `${lang}: keep the seasonal-overlap draft attached to its exact source`);
    if (slides[1].target.body[3].status === 'mixed') {
      assert.equal(slides[1].target.body[3].segments.map((segment: any) => segment.sourceEnglish).join(''),
        slides[1].english.body[3], `${lang}: keep every held clause in the exact seasonal source`);
    }

    for (const n of [17, 18]) {
      assert.equal(slides[n - 1].target.heading.status, 'draft', `${lang} slide ${n} keeps its visible heading draft`);
      assert.equal(slides[n - 1].english.heading, source[n - 1].heading,
        `${lang} slide ${n} keeps its exact English heading source`);
    }

    const hungryGapHeading = slides[10];
    assert.equal(hungryGapHeading.english.heading, 'Plan Backwards From Your Hungry Gap');
    assert.equal(hungryGapHeading.target.heading.status, 'mixed');
    assert.deepEqual(hungryGapHeading.target.heading.segments.map((segment: any) => ({
      sourceEnglish: segment.sourceEnglish,
      status: segment.status,
    })), [
      { sourceEnglish: 'Plan Backwards From ', status: 'draft' },
      { sourceEnglish: 'Your Hungry Gap', status: 'english-hold' },
    ], `${lang}: retain “Your” with the technical Hungry Gap term so the source's possessive is not lost`);

    const staplesRiskHeading = slides[12];
    assert.equal(staplesRiskHeading.english.heading, 'Different Staples Protect Against Different Risks');
    assert.equal(staplesRiskHeading.target.heading.status, 'draft');
    assert.ok(staplesRiskHeading.target.heading.text.includes('Staples'), `${lang}: retain the source staple category`);
    const riskAnchors = {
      st: ['tse fapaneng', 'sireletsa', 'dikotsi tse fapaneng'],
      ve: ['dzo fhambanaho', 'tsireledza', 'khombo dzo fhambanaho'],
      ts: ['to hambana', 'sirhelela', 'makhombo yo hambana'],
    } as const;
    for (const anchor of riskAnchors[lang]) {
      assert.ok(staplesRiskHeading.target.heading.text.includes(anchor),
        `${lang}: preserve the claim that different staples protect against different risks`);
    }

    const pestMessengerHeading = slides[14];
    assert.equal(pestMessengerHeading.english.heading, 'Pests Are Messengers Before They Are Enemies');
    assert.deepEqual(pestMessengerHeading.target.heading, { status: 'english-hold' },
      `${lang}: keep the whole pest-messenger claim in exact English until its relationship is safely drafted`);

    const soil = slides[16];
    assert.equal(soil.english.body[0], 'Now the lesson finishes in the soil.');
    const soilEndings = {
      st: 'Joale thuto e fella mobung.',
      ve: 'Zwino ngudo i fhela mavuni.',
      ts: 'Sweswi, dyondzo yi hela emhlabeni.',
    } as const;
    assert.deepEqual(soil.target.body[0], { status: 'draft', text: soilEndings[lang] },
      `${lang}: the lesson ends in soil, and the exact source remains paired`);

    const bed = soil.target.body[1];
    assert.equal(soil.english.body[1], 'Build one bed that can keep feeding you. One point two metres by three metres.');
    assert.equal(bed.status, 'mixed');
    assert.deepEqual(bed.segments.map((segment: any) => segment.sourceEnglish), [
      'Build one bed that can keep feeding you. ',
      'One point two metres by three metres.',
    ], `${lang}: each source segment remains attached to its exact sentence`);
    assert.equal(bed.segments[0].status, 'draft');
    assert.ok(bed.segments[0].text.includes('bed'), `${lang}: retain the intentional English bed term`);
    assert.deepEqual(bed.segments[1], { sourceEnglish: 'One point two metres by three metres.', status: 'english-hold' },
      `${lang}: keep the exact 1.2 × 3 metre instruction held with the source`);

    const access = soil.target.body[2];
    assert.equal(soil.english.body[2], 'Reach the middle from both sides. Keep every foot on the paths. Space your plants for your own climate. Mulch the bed.');
    assert.equal(access.status, 'draft');
    const accessText = {
      st: 'Fihla bohareng ho tloha mahlakoreng ka bobedi. Etsa bonnete ba hore leoto le leng le le leng le sala ditseleng. Beha dimela ka sebaka se tshwanetseng boemo ba lehodimo ba hao. Tshhela mulch bedeng.',
      ve: 'Swikani vhukati ha bed ni tshi bva thungo dzoṱhe mbili. Ni ite uri milenzhe yaṋu yoṱhe i dzule i kha paths fhedzi. Ṋeani zwimela spacing yo teaho kha climate yaṋu. Vheani mulch kha bed.',
      ts: 'Fika exivindzini hi matlhelo hamambirhi. Tiyisisa leswaku milenge ya wena yi sala yi ri etindleleni ntsena. Siyela swimilani mpfhuka lowu faneleke eka maxelo ya wena. Tirhisa mulch eka bed.',
    } as const;
    assert.equal(access.text, accessText[lang], `${lang}: full access, path, own-climate spacing and mulch wording stays source-paired`);
    assert.ok(access.text.includes(lang === 'st' ? 'mahlakoreng ka bobedi' : lang === 've' ? 'thungo dzoṱhe mbili' : 'matlhelo hamambirhi'),
      `${lang}: retain access from both sides`);
    assert.ok(access.text.includes(lang === 'st' ? 'ditseleng' : lang === 've' ? 'paths fhedzi' : 'etindleleni ntsena'),
      `${lang}: keep every foot on paths`);
    assert.ok(access.text.includes(lang === 'st' ? 'boemo ba lehodimo ba hao' : lang === 've' ? 'climate yaṋu' : 'maxelo ya wena'),
      `${lang}: spacing remains for the learner's own climate`);
    assert.ok(access.text.includes('mulch') && access.text.includes('bed'), `${lang}: retain the mulch action and its bed`);

    assert.equal(soil.english.body[3], 'Check the bed regularly from planting. Use the ten-day photograph as an assignment checkpoint, not a reason to delay care.');
    const regularCheck = soil.target.body[3];
    assert.ok(['mixed', 'draft'].includes(regularCheck.status));
    if (lang === 've') {
      assert.equal(regularCheck.status, 'mixed');
      assert.deepEqual(regularCheck.segments[0], { sourceEnglish: 'Check the bed regularly from planting.', status: 'english-hold' },
        'hold the full regularly-from-planting sentence to avoid turning regularly into an all-the-time prescription');
    } else {
      assert.equal(regularCheck.status, 'mixed');
      assert.equal(regularCheck.segments[0].sourceEnglish, 'Check the bed regularly from planting.');
      assert.equal(regularCheck.segments[0].status, 'draft');
      assert.ok(regularCheck.segments[0].text.includes(lang === 'st' ? 'kgafetsa' : 'nkarhi na nkarhi'),
        `${lang}: preserve regular checking from planting without adding a schedule`);
    }
    assert.equal(regularCheck.segments.map((segment: any) => segment.sourceEnglish).join(''), soil.english.body[3],
      `${lang}: the complete checkpoint and no-delay-care source remains attached`);
    assert.ok(regularCheck.segments.some((segment: any) => segment.sourceEnglish === 'not a reason to delay care.' && segment.status === 'draft'),
      `${lang}: the ten-day checkpoint cannot be treated as a reason to postpone care`);
    assert.equal(soil.english.body[4], 'Photograph it when it\'s planted. Then come back after ten days with what you observed.');
    const plantedPhoto = soil.target.body[4];
    assert.ok(['draft', 'mixed'].includes(plantedPhoto.status));
    if (lang === 've') {
      assert.equal(plantedPhoto.status, 'mixed');
      assert.deepEqual(plantedPhoto.segments[0], { sourceEnglish: 'Photograph it', status: 'english-hold' },
        'Tshivenda retains the uncertain photograph command in exact English');
    }
    assert.equal(plantedPhoto.status === 'draft' ? plantedPhoto.text : plantedPhoto.segments.map((segment: any) =>
      segment.status === 'draft' ? segment.text : segment.sourceEnglish).join(''),
    lang === 'st' ? 'Nka senepe ha bed e se e jetsoe. Ebe o kgutle ka mora matsatsi a leshome o tlisa seo o se boneng.' :
    lang === 've' ? 'Photograph it musi bed yo no ṱavhiwa. Nga murahu ha maḓuvha a fumi ni vhuye ni na zwe na zwi vhona.' :
    'Teka foto loko bed yi byariwile. Kutani vuya endzhaku ka masiku ya khume with what you observed.',
    `${lang}: keep the planting-time image and ten-day return in source order`);
    if (lang === 'ts') assert.deepEqual(plantedPhoto.segments.at(-1), { sourceEnglish: ' with what you observed.', status: 'english-hold' },
      'keep the observer/accompaniment phrase exact rather than changing its actor');

    const aim = soil.target.body[5];
    assert.equal(soil.english.body[5], source[16].body[5]);
    assert.equal(aim.status, 'draft');
    const aimText = {
      st: 'Sepheo ha se setshwantsho se phethahetseng. Sepheo ke bed eo o kgethileng shape, spacing le rhythm ya yona ka boomo.',
      ve: 'Tshipikwa a si tshifanyiso tsho fhelelaho. Tshipikwa ndi bed ine na khetha shape, spacing na rhythm yayo nga ndivho.',
      ts: 'Xikongomelo a hi xifaniso lexi hetisekeke. Xikongomelo i bed leyi xivumbeko, spacing ni rhythm ya yona u swi hlawuleke hi vomu.',
    } as const;
    assert.equal(aim.text, aimText[lang], `${lang}: retain both the not-perfect-picture and intentional-bed aims`);
    assert.ok(aim.text.includes('bed') && aim.text.includes(lang === 'ts' ? 'xivumbeko' : 'shape') && aim.text.includes('spacing') && aim.text.includes('rhythm'),
      `${lang}: the chosen bed's shape, spacing and rhythm remain visible`);
    assert.ok(aim.text.includes(lang === 'st' ? 'ka boomo' : lang === 've' ? 'nga ndivho' : 'hi vomu'),
      `${lang}: preserve that the bed design was chosen on purpose`);

    const action = slides[17];
    const requiredActions = [
      'This week, put one bed into production.',
      'One. Mark the bed and the paths.',
      'Two. Plant, with your spacing and your sowing rhythm.',
      'Three. Return after ten days, with a photo.',
    ];
    for (let index = 0; index < requiredActions.length; index++) {
      assert.equal(action.english.body[index], requiredActions[index], `${lang}: retain the numbered source action`);
      const step = action.target.body[index];
      assert.ok(['draft', 'mixed'].includes(step.status),
        `${lang}: the authorized unreviewed ordinary Field Action text is visibly drafted`);
      const stepText = step.status === 'draft' ? step.text : step.segments.map((segment: any) =>
        segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');
      assert.ok(stepText && stepText.trim().length > 0,
        `${lang}: each action has visible target text while its exact English stays paired`);
    }
    assert.equal(action.english.body[4], 'Then observe. Adjust. And write it down.');
    assert.equal(action.target.body[4].status, 'draft', `${lang}: ordinary observe-adjust-record framing is drafted`);
    const observationAnchors = {
      st: ['sheba', 'fetole', 'ngole fatshe'],
      ve: ['sedze', 'lulamise', 'ṅwale fhasi'],
      ts: ['languta', 'Lulamisa', 'Tsala leswi ehansi'],
    } as const;
    let previous = -1;
    for (const anchor of observationAnchors[lang]) {
      const index = action.target.body[4].text.indexOf(anchor);
      assert.ok(index > previous, `${lang}: keep observe, adjust and write-down actions in order`);
      previous = index;
    }
    assert.equal(action.english.body[5], 'Record the sowing date. The rain. What germinated. Pest pressure. What you harvested.');
    const record = action.target.body[5];
    assert.equal(record.status, 'mixed', `${lang}: ordinary record framing is drafted beside held technical items`);
    assert.deepEqual(record.segments.map((segment: any) => segment.sourceEnglish), [
      'Record the sowing date.',
      ' The rain.',
      ' What germinated.',
      ' Pest pressure.',
      ' What you harvested.',
    ], `${lang}: preserve all five record items in their original order and exact source wording`);
    assert.equal(record.segments.map((segment: any) => segment.sourceEnglish).join(''), action.english.body[5],
      `${lang}: changed source wording must not be hidden by a partial list`);
    for (const index of [2, 3]) {
      assert.deepEqual(record.segments[index], {
        sourceEnglish: index === 2 ? ' What germinated.' : ' Pest pressure.',
        status: 'english-hold',
      }, `${lang}: retain uncertain crop-observation terms as exact English holds`);
    }
    const expectedRecordDrafts = {
      st: ['Ngola letsatsi la sowing.', ' Pula.', ' Seo o se kotutseng.'],
      ve: ['Ṅwalani datumu ya sowing.', ' Mvula.'],
      ts: ['Tsala siku ra sowing.', ' Mpfula.', ' Leswi u tshoveleke.'],
    } as const;
    const expectedDraftSegments = lang === 've' ? [0, 1] : [0, 1, 4];
    assert.deepEqual(expectedDraftSegments.map((index) => record.segments[index].text), expectedRecordDrafts[lang],
      `${lang}: retain only the accepted ordinary record wording, with VE harvest timing held`);
    for (const index of expectedDraftSegments) {
      assert.equal(record.segments[index].text.startsWith(' '), record.segments[index].sourceEnglish.startsWith(' '),
        `${lang}: retain separator spacing so adjoining record items do not run together`);
    }
    if (lang === 've') {
      assert.deepEqual(record.segments[4], { sourceEnglish: ' What you harvested.', status: 'english-hold' },
        'Tshivenda keeps the past-harvest list item held rather than risking a tense shift');
    }
    const changedRecordSource = structuredClone(packet);
    changedRecordSource.slides[17].english.body[5] += ' Changed source.';
    assert.throws(() => validatePairedDraft(changedRecordSource, source, lang), /slide 18: English body differs/,
      `${lang}: a changed record item withdraws the complete paired list draft`);
    if (lang === 'st') {
      const seasonEvidence = action.target.body[6];
      assert.equal(action.english.body[6], "Season by season, your garden becomes less dependent on guesswork — and more on what you've actually seen happen on your own ground.");
      assert.equal(seasonEvidence.status, 'mixed');
      assert.equal(seasonEvidence.segments.map((segment: any) => segment.sourceEnglish).join(''), action.english.body[6],
        'all translated and held clauses remain attached to the season-by-season source');
      assert.deepEqual(seasonEvidence.segments.map((segment: any) => ({
        sourceEnglish: segment.sourceEnglish,
        status: segment.status,
        ...(segment.text === undefined ? {} : { text: segment.text }),
      })), [
        { sourceEnglish: 'Season by season, ', status: 'draft', text: 'Sehla ka seng, ' },
        { sourceEnglish: 'your garden ', status: 'draft', text: 'serapa sa hao ' },
        { sourceEnglish: 'becomes less dependent on guesswork', status: 'english-hold' },
        { sourceEnglish: ' — and more on ', status: 'draft', text: ' — mme haholo ka ' },
        { sourceEnglish: "what you've actually seen happen", status: 'draft', text: 'seo o hlileng o se boneng se etsahala' },
        { sourceEnglish: ' on your own ground.', status: 'english-hold' },
      ], 'Sesotho keeps the less-versus-more comparison and own-ground scope anchored in exact source clauses');
    }
    assert.equal(action.english.body[7], 'Use your record with reliable local advice when making the next decision.');
    assert.equal(action.target.body[7].status, 'mixed',
      `${lang}: draft only record-use framing around the reliable-advice condition`);
    assert.deepEqual(action.target.body[7].segments.map((segment: any) => ({
      sourceEnglish: segment.sourceEnglish,
      status: segment.status,
    })), [
      { sourceEnglish: 'Use your record ', status: 'draft' },
      { sourceEnglish: 'with reliable local advice', status: 'english-hold' },
      { sourceEnglish: ' when making the next decision.', status: 'draft' },
    ], `${lang}: preserve reliable local advice and the when-making-next-decision condition`);

    const changed = structuredClone(packet);
    changed.slides[16].english.body[0] += ' Changed source.';
    assert.throws(() => validatePairedDraft(changed, source, lang), /slide 17: English body differs/,
      `${lang}: a changed canonical source still blocks these paired field drafts`);
  }
});

test('Intro integration noun updates preserve paired conditions and leave Sesotho audio-bound text untouched', () => {
  const introSource = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
  const sourceText = introSource[13].body[1];
  assert.equal(sourceText,
    'A garden, fruit trees and a chicken run arranged so the chickens rotate through the beds after harvest is integration. Keep chickens away from crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage the bed safely before edible crops return. The chickens can clean up pests and add fertility instead of sitting idle in a fixed pen.');

  const stDeck = JSON.parse(readFileSync('docs/narration/intro-permaculture.st.paired-draft.json', 'utf8'));
  const stSlides = validatePairedDraft(stDeck, introSource, 'st');
  assert.deepEqual(stSlides[13].target.body[1], { status: 'english-hold' },
    'the whole Sesotho source pair stays English because the spoken text is bound to the existing narration');

  const expected = {
    ve: {
      first: 'A garden, miri ya mitshelo na chicken run zwi nga dzudzanywa uri khuhu dzi rotate through the beds after harvest; izwi ndi integration. Ni songo tendela khuhu dzi tshi swika kha crops dzine dza khou harvestiwa uri dzi ḽiwe.',
      second: ' Vhudzisani extension adviser uri bed i langulwe hani safely, edible crops dzi sa athu dovha u hula. Khuhu dzi nga thusa u bvisa pests na u engedza fertility, nṱhani ha uri dzi dzule dzi sa shumi kha fixed pen.',
      nouns: ['miri ya mitshelo', 'khuhu'],
    },
    ts: {
      first: 'Ntanga, mirhi ya mihandzu na chicken run swi nga veketeriwa leswaku tihuku ti rotate through the beds after harvest; leswi i integration. U nga pfumeleli tihuku ti tshinela eka crops leti ku tshoveriwaka swakudya.',
      second: ' Kombela extension adviser a ku hlamusela ndlela yo hlayisa bed yi ri safe loko edible crops ti nga si tlhela ti byariwa. Tihuku ti nga basisa pests ti tlhela ti engetela fertility, ematshan’weni yo tshama ti nga endli swo karhi eka fixed pen.',
      nouns: ['Ntanga', 'mirhi ya mihandzu', 'tihuku'],
    },
  } as const;

  for (const lang of ['ve', 'ts'] as const) {
    const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(deck, introSource, lang);
    const field = slides[13].target.body[1];
    assert.equal(slides[13].english.body[1], sourceText);
    assert.equal(field.status, 'mixed');
    assert.equal(field.provenance, 'new-unreviewed-machine-draft; exact source paired; publish for facilitator feedback; fluent review remains open');
    assert.equal(field.segments.length, 3, `${lang}: preserve the pre-existing mixed segment structure`);
    assert.deepEqual(field.segments.map((segment: any) => ({
      sourceEnglish: segment.sourceEnglish,
      status: segment.status,
    })), [
      { sourceEnglish: sourceText.split(' Fresh manure can carry germs.')[0], status: 'draft' },
      { sourceEnglish: ' Fresh manure can carry germs.', status: 'english-hold' },
      { sourceEnglish: sourceText.slice(sourceText.indexOf(' Ask an extension adviser')), status: 'draft' },
    ], `${lang}: preserve every previous source boundary and the exact manure safety hold`);
    assert.equal(field.segments.map((segment: any) => segment.sourceEnglish).join(''), sourceText,
      `${lang}: the full source still binds in order`);
    assert.equal(field.segments[0].text, expected[lang].first,
      `${lang}: only the approved garden, fruit-tree and chicken nouns change in the existing first draft segment`);
    assert.equal(field.segments[1].text, undefined, `${lang}: held manure risk has no competing draft text`);
    assert.equal(field.segments[2].text, expected[lang].second,
      `${lang}: preserve the existing adviser, crop-return, pest and fertility wording`);
    for (const noun of expected[lang].nouns) assert.ok(targetVisibleText(field).includes(noun), `${lang}: expected noun ${noun} remains visible`);
    for (const condition of ['Keep chickens away from crops being harvested for food.', 'Fresh manure can carry germs.', 'Ask an extension adviser', 'before edible crops return.']) {
      assert.ok(field.segments.some((segment: any) => segment.sourceEnglish.includes(condition)),
        `${lang}: source keeps safety or advice condition “${condition}” attached`);
    }

    const drifted = structuredClone(deck);
    drifted.slides[13].english.body[1] += ' Changed source.';
    assert.throws(() => validatePairedDraft(drifted, introSource, lang), /slide 14: English body differs/,
      `${lang}: changing canonical source withdraws these noun-only draft refinements`);
  }
});

test('regional Study frames draft screened observations while risky advice stays in exact English', () => {
  const cases = [
    { moduleId: 'vegetables-staples', lang: 'st', drafted: ['1:2', '1:3', '2:1', '2:2', '2:3', '2:4', '2:5', '8:1', '8:2', '8:3', '8:4', '8:5', '8:6', '9:1'], held: [], mixed: ['2:4'] },
    { moduleId: 'market-community', lang: 've', drafted: ['2:1', '2:2', '2:3', '3:4', '7:2', '18:1', '18:3'], held: ['15:4'] },
    // Full soil paragraphs are now reused only at byte-exact canonical matches; the dedicated Soil test checks resolver equality and keeps safety claims paired.
    { moduleId: 'soil-health', lang: 'ts', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '3:1', '4:1', '4:2', '5:1', '5:2', '5:3', '14:1', '19:2'], held: ['2:3', '5:4', '20:4'] },
    { moduleId: 'soil-health', lang: 'st', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '4:1', '4:2', '5:1', '5:2', '5:3', '5:4', '14:1', '19:2', '20:4'], held: ['3:3'] },
    { moduleId: 'soil-health', lang: 've', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '4:1', '4:2', '5:1', '5:2', '5:3', '14:1', '19:2'], held: ['5:4', '20:4'] },
  ] as const;
  for (const { moduleId, lang, drafted, held, ...rest } of cases) {
    const source = englishSlideRecords(readFileSync(`docs/narration/${moduleId}.en.md`, 'utf8'));
    const packet = JSON.parse(readFileSync(`docs/narration/${moduleId}.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const item of drafted) {
      const [n, p] = item.split(':').map(Number);
      assert.ok(['draft', 'mixed'].includes(slides[n - 1].target.body[p - 1].status),
        `${lang} ${moduleId} ${item} keeps its source-paired draft as the deck grows`);
    }
    for (const item of held) {
      const [n, p] = item.split(':').map(Number);
      assert.equal(slides[n - 1].target.body[p - 1].status, 'english-hold', `${lang} ${moduleId} ${item} keeps the exact source`);
    }
    for (const item of (rest as { mixed?: readonly string[] }).mixed ?? []) {
      const [n, p] = item.split(':').map(Number);
      const part = slides[n - 1].target.body[p - 1];
      assert.equal(part.status, 'mixed', `${lang} ${moduleId} ${item} keeps its unresolved source clause visibly held`);
      assert.equal(part.segments[0].sourceEnglish, 'Small sowings create a rhythm instead. ',
        'small quantities sown must not silently turn into small plants');
      assert.equal(part.segments[0].status, 'english-hold');
      if (lang === 'st' && moduleId === 'vegetables-staples') {
        assert.equal(part.segments[0].sourceEnglish, 'Small sowings create a rhythm instead. ',
          'the sowing-scale contrast stays exact English instead of shifting to small plants');
        assert.deepEqual(part.segments.at(-1), { sourceEnglish: 'Something is always coming ready.', status: 'english-hold' },
          'the last sentence must retain progressive coming-ready timing, not say food is already ready');
        assert.equal(part.segments[1].sourceEnglish, 'Planting, tending and harvesting overlap. ');
        assert.equal(part.segments[1].status, 'draft');
      }
    }
  }
});

test('Soil Health deck reuses complete resolver paragraphs only at exact sources and keeps safety claims intact', () => {
  const soilModule = COURSE_MODULES.find((module) => module.id === 'soil-health');
  assert.ok(soilModule);
  const source = englishSlideRecords(readFileSync('docs/narration/soil-health.en.md', 'utf8'));
  const exactResolverMatches = { st: 32, ve: 32, ts: 31 } as const;
  const safetySources = [
    'Sand settles first. Silt settles next, while clay can remain suspended much longer.',
    'This is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.',
    'A thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.',
    'Record what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.',
    'A hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.',
    'Keep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.',
    'Do not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required.',
    'Keep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.',
    'Use only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.',
    'Liquid that drains naturally from a worm bin is called leachate. It is not the same as a prepared worm-casting tea.',
    'Leachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe.',
  ];

  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/soil-health.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    let mappedParagraphs = 0;
    let resolverParagraphsVisible = 0;

    for (const slide of slides) {
      for (let bodyIndex = 0; bodyIndex < slide.english.body.length; bodyIndex++) {
        const english = slide.english.body[bodyIndex];
        const matches: Array<{ lesson: (typeof COURSE_MODULES)[number]['lessons'][number]; canonicalIndex: number }> = soilModule.lessons.flatMap((lesson) => lesson.body.split('\n\n')
          .flatMap((paragraph, canonicalIndex) => paragraph === english
            ? [{ lesson, canonicalIndex }]
            : []));
        assert.ok(matches.length <= 1,
          `${lang} slide ${slide.n} body ${bodyIndex}: a complete source paragraph cannot identify multiple canonical paragraphs`);
        if (matches.length === 0) continue;

        mappedParagraphs++;
        const { lesson, canonicalIndex } = matches[0];
        const resolved = resolveLearnerLessonPresentation(lesson, lang);
        const learnerParagraph = resolved.content.body.split('\n\n')[canonicalIndex];
        const target = slide.target.body[bodyIndex];
        if (learnerParagraph === english) {
          assert.deepEqual(target, { status: 'english-hold' },
            `${lang} slide ${slide.n} keeps a resolver English fallback visible as an exact hold`);
          continue;
        }

        assert.ok(['draft', 'mixed'].includes(target.status),
          `${lang} slide ${slide.n} body ${bodyIndex}: do not leave a source-matched learner draft hidden in English`);
        if (target.status === 'draft' && target.text === learnerParagraph) resolverParagraphsVisible++;
        if (target.status === 'mixed') {
          assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), english,
            `${lang} slide ${slide.n} keeps every mixed clause attached to the whole source paragraph`);
        }
      }
    }
    assert.equal(mappedParagraphs, 37, `${lang}: verify the complete set of exact source paragraph matches`);
    assert.equal(resolverParagraphsVisible, exactResolverMatches[lang],
      `${lang}: retain each complete current resolver paragraph in the slide deck`);

    for (const english of safetySources) {
      const matches: Array<{ lesson: (typeof COURSE_MODULES)[number]['lessons'][number]; canonicalIndex: number }> = soilModule.lessons.flatMap((lesson) => lesson.body.split('\n\n')
        .flatMap((paragraph, canonicalIndex) => paragraph === english
          ? [{ lesson, canonicalIndex }]
          : []));
      assert.equal(matches.length, 1, `keep the exact canonical soil safety source: ${english}`);
      const { lesson, canonicalIndex } = matches[0];
      const deckMatches = slides.flatMap((slide: any) => slide.english.body
        .flatMap((paragraph: string, bodyIndex: number) => paragraph === english ? [{ slide, bodyIndex }] : []));
      assert.equal(deckMatches.length, 1, `pair the complete safety source with one deck field: ${english}`);
      const [{ slide, bodyIndex }] = deckMatches;
      const resolved = resolveLearnerLessonPresentation(lesson, lang);
      assert.equal(slide.target.body[bodyIndex].status, 'draft');
      assert.equal(slide.target.body[bodyIndex].text, resolved.content.body.split('\n\n')[canonicalIndex],
        `${lang} retains the current full resolver wording for the jar, compost, or leachate safety condition`);
    }

    const inspection = slides[18];
    assert.equal(inspection.english.body[0], 'Inspect soil in a working area. Record colour, structure, roots, moisture and any worm channels.');
    const inspectionDraft = inspection.target.body[0];
    assert.equal(inspectionDraft.status, 'mixed');
    assert.deepEqual(inspectionDraft.segments.map((segment: any) => ({
      sourceEnglish: segment.sourceEnglish,
      status: segment.status,
    })), [
      { sourceEnglish: 'Inspect soil in a working area. ', status: 'draft' },
      { sourceEnglish: 'Record colour, structure, roots, moisture and any worm channels.', status: 'english-hold' },
    ], `${lang}: localize the ordinary inspection lead-in while keeping the complete technical checklist held`);
    const inspectionAnchors = {
      st: 'Hlahloba mobu',
      ve: 'Sedzani mavu',
      ts: 'Kambela misava',
    } as const;
    assert.ok(inspectionDraft.segments[0].text.startsWith(inspectionAnchors[lang]));

    const firstAction = slides[19];
    assert.equal(firstAction.english.body[0], 'Start one soil-building action from this module.');
    const action = firstAction.target.body[0];
    assert.equal(action.status, 'draft');
    assert.ok(action.text.includes('soil-building'), `${lang}: retain the technical soil-building phrase in English`);
    const actionAnchors = {
      st: { one: "'ngoe", action: 'ketso', scope: 'ho tsoa mojulung ona' },
      ve: { one: 'nthihi', action: 'nyito', scope: 'u bva kha module iyi' },
      ts: { one: "rin'we", action: 'goza', scope: 'ku suka eka modula lowu' },
    } as const;
    for (const anchor of Object.values(actionAnchors[lang])) {
      assert.ok(action.text.includes(anchor), `${lang}: preserve the one-action instruction and its module scope`);
    }

    const drifted = structuredClone(packet);
    drifted.slides[18].english.body[0] += ' Changed source.';
    assert.throws(() => validatePairedDraft(drifted, source, lang), /slide 19: English body differs/,
      `${lang}: source drift blocks reuse of the inspection and action drafts`);
  }

  const changedLesson = structuredClone(soilModule.lessons[0]);
  changedLesson.body += '\n\nNew source paragraph.';
  const fallback = resolveLearnerLessonPresentation(changedLesson, 'st');
  assert.equal(fallback.status, 'english-fallback', 'a changed canonical lesson must fail closed to English');
  assert.equal(fallback.content.body, changedLesson.body);
});

test('Reading Landscape drafts keep exact sources, field-safety conditions and directional claims paired', () => {
  const readingSource = englishSlideRecords(readFileSync('docs/narration/reading-landscape.en.md', 'utf8'));
  const accepted = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-SLIDES-3-14-ROOT-ACCEPTED-CANDIDATES-2026-10-04.json', 'utf8'));
  const preservation = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-SLIDES-3-14-IMPLEMENTATION-PRESERVATION-2026-10-04.json', 'utf8'));
  assert.equal(accepted.scope.targetFields, 20);
  assert.equal(accepted.scope.uniqueFrames, 17);
  assert.equal(accepted.candidateFields.length, 20);
  assert.equal(preservation.targetFieldsChanged, 20);
  assert.equal(preservation.uniqueFramesChanged, 17);

  const changed = new Set<string>();
  const next15Proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-NEXT15-IMPLEMENTATION-PRESERVATION-2026-10-04.json', 'utf8'));
  const pairedReuseProof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-PAIRED-REUSE-CANDIDATES-2026-10-04.json', 'utf8'));
  const observationProof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-OBSERVATION-NEXT-2026-10-04.json', 'utf8'));
  const seasonalMapFollowup = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-SEASONAL-OBSERVATION-MAP-COMPARISON-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  const bodySync = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-BODY-DECK-SYNC-IMPLEMENTATION-2026-10-05.json', 'utf8'));
  const outcomes = studyOutcomesProof.changedFiles.flatMap((file: any) => file.changedBodyFields);
  for (const language of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/reading-landscape.${language}.paired-draft.json`, 'utf8'));
    // The newer 76-field Reading batch translated ordinary framing around exact technical holds.
    // Verify its live targets against the applied proof, then restore its before-values so the
    // older 20-field preservation snapshot below still tests the historical deck state.
    restorePreFullReadingDeck(packet, language);
    // Reconstruct the earlier 20-field snapshot across later authorized batches.
    // The frozen outcomes proof carries exact before-target objects for these newer fields.
    for (const change of outcomes.filter((item: any) => item.moduleId === 'reading-landscape' && item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.bodyIndexZeroBased] = change.beforeTarget;
    }
    // Restore this later follow-up first; older batches below then restore their own earlier snapshots.
    for (const change of bodySync.pairedFields[language].changedFields) {
      packet.slides[change.slide - 1].target.body[change.bodyIndex] = change.previousTarget;
    }
    for (const change of seasonalMapFollowup.fields.filter((item: any) => item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.bodyIndex] = change.currentTarget;
    }
    for (const change of observationProof.pairedTargetChanges.filter((item: any) => item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.bodyIndex] = change.previousTarget;
    }
    for (const change of pairedReuseProof.targetFieldChanges.filter((item: any) => item.language === language)) {
      const target = packet.slides[change.slide - 1].target;
      if (change.bodyIndex === undefined) target.heading = change.previousTarget;
      else target.body[change.bodyIndex] = change.previousTarget;
    }
    for (const change of next15Proof.changedTargets.filter((item: any) => item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.bodyIndex] = change.previousTarget;
    }
    // The first-observations batch is newer than these historical snapshots; restore its exact recorded before-values.
    for (const change of firstObservationFields.filter((item: any) => item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.index] = change.currentTargetRecord;
    }
    const slides = validatePairedDraft(packet, readingSource, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    for (const field of accepted.candidateFields.filter((item: any) => item.language === language)) {
      const slide = slides[field.slide - 1];
      const key = `${language}:${field.slide}:${field.bodyIndex}`;
      assert.equal(slide.english.body[field.bodyIndex], field.sourceEnglish,
        `${key}: the candidate remains attached to its exact English narration`);
      const target = slide.target.body[field.bodyIndex];
      assert.equal(target.status, field.candidateStatus, `${key}: keep the accepted draft or mixed state visible`);
      changed.add(key);
      if (field.candidateStatus === 'mixed') {
        assert.deepEqual(target.segments, field.candidateSegments, `${key}: retain the reviewed segment boundaries`);
        assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
          `${key}: every translated clause and English hold follows the complete source in order`);
        for (const segment of target.segments) {
          if (segment.status === 'english-hold') {
            assert.equal(segment.text, undefined, `${key}: an English hold stays exact source text, not a second draft`);
          } else {
            assert.ok(typeof segment.text === 'string' && segment.text.trim(), `${key}: each localized segment is present`);
          }
        }
      } else {
        assert.equal(target.text, field.candidateText, `${key}: keep the accepted source-bound draft`);
        assert.notEqual(target.text.trim(), field.sourceEnglish.trim(), `${key}: translated copy cannot masquerade as an English hold`);
      }
    }
    for (const snapshot of preservation.preservedTargets[language]) {
      const slide = slides[snapshot.slide - 1];
      const current = snapshot.field === 'heading'
        ? slide.target.heading
        : slide.target.body[snapshot.bodyIndex];
      assert.deepEqual(current, snapshot.target,
        `${language} slide ${snapshot.slide}: after restoring later accepted batches, every earlier heading and non-target body keeps its wording and review state`);
    }

    // The field walk remains conditional on safety: heavy-rain observation and the full feature/property checklist stay exact.
    if (language === 'st' || language === 'ts') {
      const walk = slides[3].target.body[1];
      assert.equal(walk.status, 'mixed');
      assert.deepEqual(walk.segments.map((segment: any) => [segment.sourceEnglish, segment.status]), [
        ['Watch from a safe place during heavy rain. ', 'english-hold'],
        ['When it is safe afterward, walk your land. ', 'draft'],
        ['Look for rills, places where water fans out, ponds, and where water leaves your property.', 'english-hold'],
      ]);
    }

    // The learner must not infer one universal slope placement rule from the observation prompt.
    const placement = slides[6].target.body[1];
    assert.equal(placement.status, 'draft');
    const noRuleAndObserve = {
      st: ['Ha ho na molao o le mong wa sebaka', 'metsi a tsamayang le ho bokellana teng'],
      ve: ['A hu na mulayo muthihi', 'maḓi a tshimbila na hune a kuvhangana hone'],
      ts: ['A ku na placement rule yin’we', 'mati ma fambaka kona ni laha ma hlengeletanaka kona'],
    } as const;
    for (const anchor of noRuleAndObserve[language]) {
      assert.ok(placement.text.includes(anchor), `${language}: retain the no-single-rule and observe-water meaning`);
    }

    // Directional claims stay source-exact; translators cannot silently flip the sun or cold-air movement.
    const winterSun = slides[7].target.body[0];
    assert.equal(winterSun.status, 'mixed');
    assert.ok(winterSun.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish === 'the sun is to the north. Its path changes with the season and your location.'));
    const coldAir = slides[13].target.body[0];
    assert.equal(coldAir.status, 'mixed');
    assert.ok(coldAir.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish === 'cold air can flow downhill and collect in low places.'));
    if (language === 'st') assert.ok(coldAir.segments.at(-1).text.includes('di ka bata ho feta'),
      'ST keeps the source possibility (“can be colder”), without strengthening it to a certainty');
    if (language === 've') assert.ok(coldAir.segments.at(-1).text.includes('hu nga rothola u fhira'),
      'VE keeps the source possibility (“can be colder”), without strengthening it to a certainty');
    if (language === 'ts') assert.ok(coldAir.segments.at(-1).sourceEnglish === ' These places can be colder than nearby slopes.' &&
      coldAir.segments.at(-1).status === 'english-hold', 'TS keeps the uncertain comparative exact');

    // Damaging-wind direction and the weather-record check before a windbreak remain exact where they are held.
    const wind = slides[11].target.body[1];
    assert.ok(['draft', 'mixed', 'english-hold'].includes(wind.status));
    const windText = wind.status === 'mixed'
      ? wind.segments.filter((segment: any) => segment.status === 'english-hold').map((segment: any) => segment.sourceEnglish).join('')
      : wind.status === 'english-hold' ? slides[11].english.body[1] : '';
    if (language === 've' || language === 'ts') {
      assert.equal(wind.status, 'english-hold', `${language}: retain the full wind-direction and record-before-windbreak paragraph`);
    } else {
      assert.ok(windText.includes("The direction and strength of damaging wind change with region, season and your site's ridges and gaps."));
      assert.ok(windText.includes('Check local weather records before placing a windbreak.'));
      assert.ok(wind.status === 'mixed' && wind.segments.some((segment: any) =>
        segment.status === 'draft' && segment.sourceEnglish === 'Walk the land on windy days. '));
    }

    // A changed source must block the whole paired deck instead of presenting this draft against stale English.
    const drifted = structuredClone(readingSource);
    drifted[13].body[0] += ' Changed source.';
    assert.throws(() => validatePairedDraft(packet, drifted, language), /slide 14: English body differs/,
      `${language}: source drift blocks these paired field notes`);
  }
  assert.equal(changed.size, 20, 'all 20 accepted target fields remain represented once');
});

test('Reading observation drafts preserve exact sources, unlisted fields and seasonal conditions', () => {
  const readingSource = englishSlideRecords(readFileSync('docs/narration/reading-landscape.en.md', 'utf8'));
  const followup = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-SEASONAL-OBSERVATION-MAP-COMPARISON-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-OBSERVATION-NEXT-2026-10-04.json', 'utf8'));
  const bodySync = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-BODY-DECK-SYNC-IMPLEMENTATION-2026-10-05.json', 'utf8'));
  const outcomes = studyOutcomesProof.changedFiles.flatMap((file: any) => file.changedBodyFields);
  assert.equal(proof.scope.pairedTargetFieldsChanged, 21);
  assert.equal(proof.scope.learnerRegistryParagraphRepairs, 1);
  assert.match(proof.scope.excludedTsSlide19Body2, /Pronoun antecedent/);

  const expectedChangedFields = new Set<string>();
  for (const language of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/reading-landscape.${language}.paired-draft.json`, 'utf8'));
    // Recreate the proof's immediately preceding snapshot only after confirming every current
    // field still equals the recorded full-deck result.
    restorePreFullReadingDeck(packet, language);
    for (const change of outcomes.filter((item: any) => item.moduleId === 'reading-landscape' && item.language === language)) {
      packet.slides[change.slide - 1].target.body[change.bodyIndexZeroBased] = change.beforeTarget;
    }
    for (const change of bodySync.pairedFields[language].changedFields) {
      packet.slides[change.slide - 1].target.body[change.bodyIndex] = change.previousTarget;
    }
    for (const addition of followup.fields.filter((field: any) => field.language === language)) {
      packet.slides[addition.slide - 1].target.body[addition.bodyIndex] = addition.currentTarget;
    }
    const slides = validatePairedDraft(packet, readingSource, language);
    const fields = proof.pairedTargetChanges.filter((field: any) => field.language === language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(fields.length, language === 've' ? 8 : language === 'st' ? 7 : 6);

    for (const field of fields) {
      const key = `${language}:${field.slide}:${field.bodyIndex}`;
      expectedChangedFields.add(key);
      assert.equal(readingSource[field.slide - 1].body[field.bodyIndex], field.sourceEnglish,
        `${key}: canonical narration remains unchanged`);
      assert.equal(slides[field.slide - 1].english.body[field.bodyIndex], field.sourceEnglish,
        `${key}: target remains paired to its exact source`);
      const target = slides[field.slide - 1].target.body[field.bodyIndex];
      assert.deepEqual(target, field.currentTarget, `${key}: preserve the recorded unreviewed proposal`);
      if (target.status === 'mixed') {
        assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
          `${key}: every source clause remains in its original order`);
        for (const segment of target.segments) {
          if (segment.status === 'english-hold') {
            assert.equal(segment.text, undefined, `${key}: held wording displays the exact English source`);
          } else {
            assert.ok(segment.text.trim(), `${key}: each localized clause is present`);
          }
        }
      } else {
        assert.equal(target.status, 'draft');
        assert.notEqual(target.text, field.sourceEnglish, `${key}: a full draft is not an English copy`);
      }
    }

    for (const snapshot of proof.preservedTargets[language]) {
      const slide = packet.slides[snapshot.slide - 1];
      const current = snapshot.field === 'heading' ? slide.target.heading : slide.target.body[snapshot.bodyIndex];
      const laterObservation = snapshot.field === 'body'
        ? firstObservationField(language, snapshot.slide, snapshot.bodyIndex)
        : undefined;
      if (laterObservation) {
        assertCurrentFirstObservation(current, laterObservation,
          `${language} slide ${snapshot.slide} body ${snapshot.bodyIndex}`);
        continue;
      }
      assert.deepEqual(current, snapshot.target,
        `${language} slide ${snapshot.slide}: all unlisted target paragraphs and headings are unchanged`);
    }
    assert.deepEqual(packet.slides.map((slide: any) => ({ n: slide.n, english: slide.english })),
      proof.sourceSnapshots.englishSlides[language], `${language}: no source narration changed`);

    const wind = slides[18].target.body[0];
    const windText = targetVisibleText(wind);
    const seasonalWindAnchor = { st: 'moya wa lehlabula', ve: 'muya wa tshilimo', ts: 'moya wa ximumu' } as const;
    assert.ok(windText.includes(seasonalWindAnchor[language]),
      `${language}: retain distinct summer and winter wind wording`);
    assert.ok(windText.includes('different directions') && windText.includes('may be wrong'),
      `${language}: different directions and the conditional consequence remain exact English`);
    const map = slides[18].target.body[1];
    assert.ok(targetVisibleText(map).includes('on the same base map.'),
      `${language}: retain the exact same-base-map relation until supported terminology is checked`);
    const dawn = slides[19].target.body[1];
    const dawnHolds = dawn.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish).join('');
    assert.equal(dawn.status, 'mixed');
    assert.ok(dawnHolds.includes('dawn on a cold June morning.'), `${language}: keep the exact seasonal timing`);
    assert.deepEqual(dawn.segments.slice(0, 2).map((segment: any) => [segment.sourceEnglish, segment.status]), [
      ['Return at ', 'draft'], ['dawn on a cold June morning. ', 'english-hold'],
    ], `${language}: keep the translated return action joined to “at” so the held dawn clause does not duplicate the preposition`);
    assert.ok(dawnHolds.includes('mist, frozen dew, and the places frost lasts longest.'), `${language}: keep every observation exact`);
    const assignmentMap = slides[19].target.body[2];
    assert.equal(assignmentMap.status, 'mixed');
    assert.ok(assignmentMap.segments.some((segment: any) => segment.status === 'english-hold' && segment.sourceEnglish === 'your boundary, '),
      `${language}: retain ownership of the boundary`);
    assert.ok(assignmentMap.segments.at(-1).sourceEnglish === 'and add the house, water, roads, fences, slopes, and existing vegetation.',
      `${language}: retain the complete ordered site-object list`);

    const stale = structuredClone(packet);
    stale.slides[17].english.body[2] += ' Changed soil guidance.';
    assert.throws(() => validatePairedDraft(stale, readingSource, language), /slide 18: English body differs/,
      `${language}: changed canonical source invalidates the observation draft`);
  }
  assert.equal(expectedChangedFields.size, 21, 'all 21 authorized fields appear exactly once');

  const canonical = COURSE_MODULES.find((module) => module.id === 'reading-landscape')!;
  assert.deepEqual(canonical.lessons.map((lesson) => ({ id: lesson.id, body: lesson.body })),
    proof.sourceSnapshots.canonicalReadingLandscapeLessonBodies,
    'all four canonical lesson bodies stay unchanged');
});

test('Reading season map updates keep field indicators and perfect-map comparison source-bound', () => {
  const readingSource = englishSlideRecords(readFileSync('docs/narration/reading-landscape.en.md', 'utf8'));
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-SEASONAL-OBSERVATION-MAP-COMPARISON-IMPLEMENTATION-2026-10-04.json', 'utf8'));
  const expectedSources: Record<'ts' | 've', Partial<Record<18 | 19, string>>> = {
    ts: {
      18: 'Look for places where frost sits longest and where the ground smells damp during dry months.',
      19: 'Update the sketch season by season. A pencil map you actually use is worth more than a perfect map drawn once.',
    },
    ve: {
      19: 'Update the sketch season by season. A pencil map you actually use is worth more than a perfect map drawn once.',
    },
  } as const;

  for (const field of proof.fields) {
    const language = field.language as 've' | 'ts';
    const slide = field.slide as 18 | 19;
    const packet = JSON.parse(readFileSync(`docs/narration/reading-landscape.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, readingSource, language);
    const expectedSource = expectedSources[language][slide];
    assert.equal(field.source, expectedSource, `${language} slide ${slide}: source is the reviewed field`);
    assert.equal(slides[slide - 1].english.body[field.bodyIndex], field.source,
      `${language} slide ${slide}: canonical English remains paired`);
    const target = slides[slide - 1].target.body[field.bodyIndex];
    assert.deepEqual(target, field.appliedTarget, `${language} slide ${slide}: preserve the checked machine draft`);
    assert.equal(target.status, 'mixed');
    assert.match(target.provenance, /unreviewed/);
    assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.source,
      `${language} slide ${slide}: every source fragment remains in order`);
    assert.equal(targetVisibleText(target), target.segments.map((segment: any) =>
      segment.status === 'draft' ? segment.text : segment.sourceEnglish).join(''));

    if (language === 'ts' && slide === 18) {
      assert.deepEqual(target.segments.map((segment: any) => [segment.sourceEnglish, segment.status]), [
        ['Look for places ', 'draft'],
        ['where frost sits longest', 'english-hold'],
        [' and ', 'draft'],
        ['where the ground smells damp', 'english-hold'],
        [' during dry months.', 'draft'],
      ], 'duration and smell-based field indicators stay exact while only the search framing and dry-month timing are localized');
      assert.equal(target.segments[0].text, 'Languta tindhawu ');
      assert.equal(target.segments[2].text, ' ni ');
      assert.equal(target.segments[4].text, ' hi tin’hweti leti omeke.');
    } else {
      assert.deepEqual(target.segments.at(-1), {
        sourceEnglish: 'a perfect map drawn once.',
        status: 'english-hold',
      }, `${language}: retain the exact comparison tail rather than risk changing “perfect” or “once”`);
      assert.ok(target.segments[0].text.endsWith('. '), `${language}: preserve the current season-by-season sentence and separator`);
      assert.equal(target.segments[1].sourceEnglish, 'A pencil map you actually use is worth more than ');
      assert.equal(target.segments[1].status, 'draft');
      assert.ok(target.segments[1].text.endsWith(' '), `${language}: separate the localized comparative lead from the held tail`);
      assert.ok(target.segments[1].text.includes('Pencil map'), `${language}: keep the map-medium phrase visible`);
      if (language === 'ts') {
        const comparativeWord = target.segments[1].text.trimEnd().split(/\s+/).at(-1)!;
        assert.deepEqual([...comparativeWord].map((character) => character.codePointAt(0)), [116, 108, 117, 108, 97],
          'the independently checked Xitsonga comparative keeps its exact source-candidate spelling');
      }
    }

    const changed = structuredClone(packet);
    changed.slides[slide - 1].english.body[field.bodyIndex] += ' Changed source.';
    assert.throws(() => validatePairedDraft(changed, readingSource, language),
      new RegExp(`slide ${slide}: English body differs`),
      `${language} slide ${slide}: source edits must withdraw this paired draft`);
  }
  assert.deepEqual(proof.fields.map((field: any) => `${field.language}:${field.slide}:${field.bodyIndex}`).sort(),
    ['ts:18:0', 'ts:19:2', 've:19:2'], 'only the three approved Reading fields are added');
});

test('the 18 Study outcomes still paragraphs stay exact to source, segment order and unreviewed status', () => {
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/STUDY-OUTCOMES-RESIDUAL-PAIRED-FIELDS-2026-10-05.json', 'utf8'));
  assert.equal(proof.fieldCount, 18);
  assert.equal(proof.postWriteIntegrityCheck.checkedFieldCount, 18);
  assert.equal(proof.postWriteIntegrityCheck.allNonTargetParsedFileDataEqualsSnapshotsAfterRestoringOnlyApprovedBodySlots, true);
  assert.deepEqual(proof.preservation, {
    canonicalEnglishChanged: false,
    audioChanged: false,
    otherDeckFieldsChanged: false,
    animationConfigChanged: false,
  });
  const fields = proof.changedFiles.flatMap((file: any) => file.changedBodyFields);
  assert.equal(fields.length, 18);
  assert.equal(new Set(fields.map((field: any) => `${field.language}:${field.moduleId}:${field.slide}:${field.bodyIndexZeroBased}`)).size, 18);
  const frameKeys = new Set<string>();
  for (const field of fields) {
    const path = `docs/narration/${field.moduleId}.${field.language}.paired-draft.json`;
    const packet = JSON.parse(readFileSync(path, 'utf8'));
    const sourceSlides = englishSlideRecords(readFileSync(`docs/narration/${field.moduleId}.en.md`, 'utf8'));
    const validated = validatePairedDraft(packet, sourceSlides, field.language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    const slide = validated[field.slide - 1];
    assert.equal(slide.english.body[field.bodyIndexZeroBased], field.sourceEnglish,
      `${field.language}:${field.moduleId}:${field.slide}:${field.bodyIndexZeroBased} remains paired to its exact English source`);
    const target = slide.target.body[field.bodyIndexZeroBased];
    const rawTarget = packet.slides[field.slide - 1].target.body[field.bodyIndexZeroBased];
    assert.equal(rawTarget.status, field.targetStatus,
      `${field.language}:${field.moduleId}:${field.slide}: retain the stored draft/hold state`);
    assert.match(rawTarget.provenance ?? packet.reviewStatus, /unreviewed/i,
      `${field.language}:${field.moduleId}:${field.slide}: raw field or packet keeps unreviewed provenance`);
    const visibleText = target.status === 'mixed'
      ? target.segments.map((segment: any) => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('')
      : target.text;
    assert.equal(visibleText, field.targetText,
      `${field.moduleId}/${field.language}/${field.slide}: resolver exposes the reviewed composition`);
    if (rawTarget.status === 'mixed') {
      assert.equal(rawTarget.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
        `${field.moduleId}/${field.language}/${field.slide}: segments preserve complete source order`);
      const storedVisibleText = rawTarget.segments.map((segment: any) =>
        segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');
      assert.equal(storedVisibleText, field.targetText,
        `${field.moduleId}/${field.language}/${field.slide}: stored segments match the reviewed composition`);
      for (const segment of rawTarget.segments) {
        if (segment.status === 'english-hold') assert.equal(segment.text, undefined,
          `${field.moduleId}/${field.language}/${field.slide}: an exact source hold has no competing target`);
      }
    } else {
      assert.equal(rawTarget.text, field.targetText,
        `${field.moduleId}/${field.language}/${field.slide}: full draft matches reviewed text`);
    }
    frameKeys.add(`${field.moduleId}:${field.language}:${field.slide}`);
  }
  assert.equal(frameKeys.size, 9, 'the 18 paragraph edits map to exactly nine rendered stills');
  const frames = proof.renderedFrames as Array<{ module: string; language: string; slide: number; path: string; bytes: number; sha256: string }>;
  assert.equal(frames.length, 9);
  assert.deepEqual(new Set(frames.map(frame => `${frame.module}:${frame.language}:${frame.slide}`)), frameKeys);
  const fullDeckRenderProof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-FULL-DECK-RENDER-PROOF-2026-10-05.json', 'utf8'));
  for (const frame of frames) {
    const bytes = readFileSync(frame.path);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const currentRender = fullDeckRenderProof.assets.find((asset: any) =>
      asset.url === frame.path.replace(/^public/, ''));
    if (currentRender) {
      // The later full-deck batch changed the two Reading slide-14 stills after this older
      // outcomes render. Tie the old hash to the new render's before-hash, then verify current bytes.
      assert.equal(currentRender.beforeSha256, frame.sha256,
        `${frame.path}: later redraw starts from the frozen outcomes still`);
      assert.equal(bytes.byteLength, currentRender.bytes,
        `${frame.path}: current redraw byte count matches the full-deck render proof`);
      assert.equal(digest, currentRender.sha256,
        `${frame.path}: current redraw hash matches the full-deck render proof`);
    } else {
      assert.equal(bytes.byteLength, frame.bytes, `${frame.path}: manifest byte count matches the still`);
      assert.equal(digest, frame.sha256, `${frame.path}: manifest hash matches the still`);
    }
  }
});

test('Reading Landscape next15 drafts keep frost limits, observation times and A-frame parts source-bound', () => {
  const readingSource = englishSlideRecords(readFileSync('docs/narration/reading-landscape.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-NEXT15-ROOT-ACCEPTED-CANDIDATES-2026-10-04.json', 'utf8'));
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-NEXT15-IMPLEMENTATION-PRESERVATION-2026-10-04.json', 'utf8'));
  const observationProof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-LANDSCAPE-OBSERVATION-NEXT-2026-10-04.json', 'utf8'));
  const excluded = new Set<string>(packet.excludedFields.map((field: any) =>
    `${field.language}:${field.slide}:${field.bodyIndex}`));
  const acceptedFields = packet.candidateFields.filter((field: any) =>
    !excluded.has(`${field.language}:${field.slide}:${field.bodyIndex}`));
  assert.equal(packet.scope.targetFields, 15);
  assert.equal(acceptedFields.length, 15);
  assert.equal(proof.targetFieldsChanged, 15);
  assert.equal(proof.unlistedFieldsDeepEqualToBase, true);
  assert.equal(proof.canonicalEnglishUnchanged, true);

  const expected = new Set<string>();
  const poleWords = { st: 'tse tharo', ve: 'tharu', ts: 'tinharhu' } as const;
  const weightedStringWords = { st: 'weighted string', ve: 'weighted string', ts: 'ntambhu leyi nga ni ntiko' } as const;
  for (const language of ['st', 've', 'ts'] as const) {
    const pair = JSON.parse(readFileSync(`docs/narration/reading-landscape.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(pair, readingSource, language);
    assert.equal(pair.reviewStatus, 'unreviewed');
    const fields = acceptedFields.filter((field: any) => field.language === language);
    assert.equal(fields.length, 5, `${language}: only the five accepted body fields are wired`);
    for (const field of fields) {
      const key = `${language}:${field.slide}:${field.bodyIndex}`;
      expected.add(key);
      const slide = slides[field.slide - 1];
      assert.equal(slide.english.body[field.bodyIndex], field.sourceEnglish,
        `${key}: the source stays byte-for-byte paired`);
      const target = slide.target.body[field.bodyIndex];
      const storedTarget = pair.slides[field.slide - 1].target.body[field.bodyIndex];
      assert.equal(target.status, field.candidateStatus, `${key}: keep the unreviewed state visible`);
      assert.match(storedTarget.provenance ?? '', /unreviewed/i, `${key}: facilitator review remains pending`);
      if (field.candidateStatus === 'mixed') {
        assert.deepEqual(target.segments, field.candidateSegments, `${key}: retain accepted source segments`);
        assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.sourceEnglish,
          `${key}: mixed segments cover the complete source in order`);
        for (const segment of target.segments) {
          if (segment.status === 'english-hold') {
            assert.equal(segment.text, undefined, `${key}: an English hold displays its exact source text`);
          }
        }
      } else {
        assert.equal(target.text, field.candidateText, `${key}: preserve the accepted draft text`);
      }
    }

    const frost = slides[14].target.body[0];
    assert.equal(frost.status, 'mixed');
    const frostHolds = frost.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish).join('');
    assert.ok(frostHolds.includes('Put a frost-sensitive seedling nursery outside the cold pockets you have observed.'));
    assert.ok(frostHolds.includes('Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position.'));
    assert.ok(frostHolds.includes('No hillside position guarantees freedom from frost.'));
    assert.ok(frost.segments.some((segment: any) => segment.status === 'draft' &&
      segment.sourceEnglish === 'Compare candidate places through the local frost season. '),
    `${language}: comparison remains limited to the local frost season`);

    const disease = slides[14].target.body[1];
    assert.equal(disease.status, 'mixed');
    const diseaseHolds = disease.segments.filter((segment: any) => segment.status === 'english-hold')
      .map((segment: any) => segment.sourceEnglish).join('');
    assert.ok(diseaseHolds.includes('For tomatoes troubled by late blight, good airflow and morning sun can help leaves dry.'));
    assert.ok(diseaseHolds.includes('Prolonged cool, damp weather can still favour the disease. Moving a bed alone does not control late blight.'));
    assert.ok(disease.segments.some((segment: any) => segment.status === 'draft' &&
      segment.sourceEnglish === 'Seek local crop-health advice too.'), `${language}: keep the adviser recommendation`);

    const times = slides[9].target.body[2];
    assert.equal(times.status, 'mixed');
    assert.ok(times.segments.some((segment: any) => segment.status === 'english-hold' &&
      segment.sourceEnglish === "at 8am, midday, and 4pm on a winter's day. "),
    `${language}: preserve all observation times and winter timing exactly`);

    const frame = slides[20].target.body[0];
    assert.equal(frame.status, 'draft');
    assert.ok(frame.text.includes('A-frame level') && frame.text.includes(weightedStringWords[language]),
      `${language}: retain the level and weighted-string concept`);
    assert.ok(frame.text.includes(poleWords[language]), `${language}: keep the source count of three poles`);

    const staleSource = structuredClone(readingSource);
    staleSource[14].body[0] += ' Changed source.';
    assert.throws(() => validatePairedDraft(pair, staleSource, language), /slide 15: English body differs/,
      `${language}: source drift blocks stale paired copy`);
    const canonicalLesson = COURSE_MODULES.find((module) => module.id === 'reading-landscape')!
      .lessons.find((lesson) => lesson.id === 'reading-landscape-l2')!;
    const changedCanonical = { ...canonicalLesson, body: `${canonicalLesson.body} Changed source.` };
    const fallback = resolveLearnerLessonPresentation(changedCanonical, language);
    assert.equal(fallback.status, 'english-fallback', `${language}: stale learner translations fall back to English`);
    assert.equal(fallback.content.body, changedCanonical.body);
  }
  assert.equal(expected.size, 15, 'the 15 accepted language/body bindings appear exactly once');
  for (const field of proof.excludedUnchangedTargets) {
    const pair = JSON.parse(readFileSync(`docs/narration/reading-landscape.${field.language}.paired-draft.json`, 'utf8'));
    // Rebuild the prior next15 snapshot before checking excluded fields; the later
    // observation batch has its own test for those target changes.
    for (const change of observationProof.pairedTargetChanges.filter((item: any) => item.language === field.language)) {
      pair.slides[change.slide - 1].target.body[change.bodyIndex] = change.previousTarget;
    }
    const current = pair.slides[field.slide - 1].target.body[field.bodyIndex];
    assert.deepEqual(current, field.currentTarget,
      `${field.language} slide ${field.slide} body ${field.bodyIndex}: do not count an unchanged target as translation progress`);
  }
});

test('regional Market slides preserve the teaching-price source, seed holds and conditions inside unreviewed drafts', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const safetyAnchors = {
    st: { beforePrice: 'Pele o beha theko', noGuarantee: 'ha e tiise thekiso', agreement: 'feela ha', beforeBoxes: 'pele o tshepisa' },
    ve: { beforePrice: 'Musi ni sa athu', noGuarantee: 'a u khwaṱhisedzi', agreement: 'only when customers and growers can keep the agreement', beforeBoxes: 'musi ni sa athu fulufhedzisa' },
    ts: { beforePrice: 'U nga si veka', noGuarantee: 'a wu tiyisisi', agreement: 'ntsena loko', beforeBoxes: 'u nga si tiyisekisa' },
  } as const;
  const teachingLabels = {
    st: 'Mohlala ona ke wa ho ruta, eseng theko ya mmaraka',
    ve: 'Tsumbo iyi ndi ya u funza, a si mutengo wa makete',
    ts: 'Lexi i xikombiso xo dyondzisa, a hi nxavo wa makete',
  } as const;
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    for (const [slideNumber, paragraphIndex] of [[7, 1], [15, 3]] as const) {
      const slide = slides[slideNumber - 1];
      const held = slide.target.body[paragraphIndex];
      if (slideNumber === 7 && paragraphIndex === 1) {
        // The reviewed source-matched L1 candidate now translates this complete teaching example.
        // Keep the historic exact English source, R18-before-R15 order, per-kilogram units and
        // explicit teaching label; the separate L3 permission clause below remains an English hold.
        assert.equal(slide.english.body[paragraphIndex], source[slideNumber - 1].body[paragraphIndex]);
        assert.equal(held.status, 'draft', `${lang}: the checked teaching example is now a source-bound draft`);
        assert.deepEqual(held.text.match(/R\d+/g), ['R18', 'R15'], `${lang}: preserve the stated cost-before-sale order`);
        assert.equal((held.text.match(/kilogram/gi) ?? []).length, 2, `${lang}: retain both per-kilogram units`);
        assert.ok(held.text.startsWith(teachingLabels[lang]),
          `${lang}: keep the explicit teaching-example label so the amounts are not presented as current market prices`);
        assert.ok(held.provenance?.includes('no fluent approval'));
        continue;
      }
      const laterField = approvedStudyOutcome('market-community', lang, slideNumber, paragraphIndex);
      if (laterField) {
        assert.equal(slide.english.body[paragraphIndex], source[slideNumber - 1].body[paragraphIndex]);
        assertCurrentStudyOutcome(held, laterField, `${lang} Market slide ${slideNumber} body ${paragraphIndex}`);
        const requiredPermissionHold = 'check whether the variety is protected and whether permission is needed.';
        assert.deepEqual(laterField.retainedEnglishSourceSegments, [requiredPermissionHold],
          `${lang} Market slide 15 keeps the exact protection and permission check as its hold`);
        assert.ok(laterField.targetText.endsWith(requiredPermissionHold),
          `${lang} Market slide 15 keeps the full permission check visible after the localized lead-in`);
        continue;
      }
      assert.equal(held.status, 'english-hold', `${lang} slide ${slideNumber} retains the high-risk exact English hold`);
      assert.equal(held.text, undefined, `${lang} does not show a held claim as localized text`);
      assert.equal(slide.english.body[paragraphIndex], source[slideNumber - 1].body[paragraphIndex]);
    }
    const beforePrice = slides[6].target.body[0];
    assert.equal(beforePrice.status, 'draft');
    assert.ok(beforePrice.text.startsWith(safetyAnchors[lang].beforePrice), `${lang} keeps the before-price instruction`);
    const noGuarantee = slides[6].target.body[2];
    assert.equal(noGuarantee.status, 'draft');
    assert.ok(noGuarantee.text.includes(safetyAnchors[lang].noGuarantee), `${lang} keeps the no-guarantee condition`);
    const orders = slides[10].target.body[2];
    assert.equal(orders.status, 'draft');
    assert.ok(orders.text.includes(safetyAnchors[lang].agreement), `${lang} keeps the only-when agreement condition`);
    if (lang === 'ts') assert.ok(orders.text.includes('vaxavi ni varimi'),
      'the Xitsonga condition still names both customers and growers');
    const beforeBoxes = slides[11].target.body[1];
    assert.equal(beforeBoxes.status, 'draft');
    assert.ok(beforeBoxes.text.includes(safetyAnchors[lang].beforeBoxes), `${lang} keeps the condition before promising boxes`);
    for (const [slideNumber, paragraphIndex, exactClause] of [
      [20, 2, 'Before a seed swap, check whether the variety is protected and whether permission is needed.'],
    ] as const) {
      const slide = slides[slideNumber - 1];
      const draft = slide.target.body[paragraphIndex];
      assert.equal(draft.status, 'draft', `${lang} labels the source-paired wording as unreviewed`);
      assert.ok(draft.text.includes(exactClause), `${lang} preserves the difficult source clause in English`);
      assert.ok(draft.provenance?.includes('unreviewed'));
    }
  }
});

test('Market backup and shared-seed deck paragraphs map only their exact source sentences', () => {
  const module = COURSE_MODULES.find(({ id }) => id === 'market-community')!;
  const sentences = (text: string) => text.match(/[^.!?]+[.!?](?:\s|$)/g)?.map((part) => part.trim()) ?? [];

  // The deck body is two sentences. Keep the existing localized first sentence, then reuse only
  // the resolver's second sentence so the backup instruction does not fall back to English.
  {
    const packet = JSON.parse(readFileSync('docs/narration/market-community.ve.paired-draft.json', 'utf8'));
    const slides = validatePairedDraft(packet, marketSource, 've');
    const lesson = module.lessons.find(({ id }) => id === 'market-community-l1')!;
    const sourceParagraph = lesson.body.split('\n\n')[16];
    const learnerParagraph = resolveLearnerLessonPresentation(lesson, 've').content.body.split('\n\n')[16];
    const slide = slides[7];
    const sourceSentences = sentences(slide.english.body[2]);
    const target = slide.target.body[2];
    const targetSentences = sentences(target.text);
    assert.equal(slide.english.body[2], sourceParagraph, 'VE slide 8 keeps the exact two-sentence canonical source');
    assert.equal(target.status, 'draft');
    assert.equal(sourceSentences.length, 2);
    assert.equal(targetSentences.length, 2);
    assert.notEqual(targetSentences[0], sourceSentences[0], 'retain the existing localized may-not clause');
    assert.ok(targetSentences[0].includes('nga kha ḽi sa shumi'), 'keep the condition that another farm’s date may not work here');
    const appliedProof = JSON.parse(readFileSync(
      'docs/study-translation-reviews/MARKET-COMMUNITY-L1-PAIRED-DECK-APPLIED-2026-10-05.json', 'utf8'));
    const approvedParagraph = appliedProof.languages.ve.bodyFields.find((field: any) => field.paragraphIndex === 16)!.afterTarget.text;
    assert.equal(target.text, approvedParagraph,
      'the field keeps the exact full-clause target accepted for this source instead of a stale earlier wording');
    for (const condition of ['backup plan', 'mvula', 'maḓi', 'zwimela']) assert.ok(target.text.includes(condition));
    assert.ok(!target.text.includes('Before exchanging seed'), 'do not add unrelated source content');
    const changedSource = structuredClone(marketSource);
    changedSource[7].body[2] += ' Source wording changed.';
    assert.throws(() => validatePairedDraft(packet, changedSource, 've'), /English body differs/);
  }

  // The learner registry paragraph also includes a third protected-variety/permission sentence.
  // Remove only that exact suffix because it is absent from this deck body; slide 20 still keeps it.
  const permissionSuffix = ' Before exchanging seed, check whether the variety is protected and whether permission is needed.';
  for (const language of ['st', 'ts', 've'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, marketSource, language);
    const lesson = module.lessons.find(({ id }) => id === 'market-community-l3')!;
    const canonicalParagraph = lesson.body.split('\n\n')[2];
    const learnerParagraph = resolveLearnerLessonPresentation(lesson, language).content.body.split('\n\n')[2];
    const sourceParagraph = slides[14].english.body[2];
    const target = slides[14].target.body[2];
    assert.ok(canonicalParagraph.endsWith(permissionSuffix), `${language}: known protected-variety suffix remains exact in the lesson source`);
    assert.equal(canonicalParagraph.slice(0, -permissionSuffix.length).trim(), sourceParagraph,
      `${language}: deck source is exactly the first two canonical sentences`);
    assert.ok(learnerParagraph.endsWith(permissionSuffix), `${language}: learner resolver retains the exact suffix`);
    const reusableLearnerPrefix = learnerParagraph.slice(0, -permissionSuffix.length).trim();
    assert.equal(target.status, 'draft');
    assert.equal(target.text, reusableLearnerPrefix, `${language}: reuse only the exact two-sentence learner prefix`);
    assert.equal(sentences(sourceParagraph).length, 2);
    assert.equal(sentences(target.text).length, 2);
    assert.ok(!target.text.includes('Before exchanging seed'), `${language}: do not add the absent permission sentence to slide 15`);
    assert.ok(target.text.includes('identity') && target.text.includes('germination') && target.text.includes('shared seed'),
      `${language}: keep the identity and germination check before relying on shared seed`);
    const slide20 = slides[19];
    assert.ok(slide20.target.body[2].text.includes('Before a seed swap, check whether the variety is protected and whether permission is needed.'),
      `${language}: retain the separate protected-variety/permission instruction on slide 20`);
    const changedSource = structuredClone(marketSource);
    changedSource[14].body[2] += ' Source wording changed.';
    assert.throws(() => validatePairedDraft(packet, changedSource, language), /English body differs/,
      `${language}: source drift invalidates the two-sentence reuse`);
  }
});

test('Market seed record and advice slides reuse only exact whole learner paragraphs', () => {
  const module = COURSE_MODULES.find(({ id }) => id === 'market-community')!;
  const reuse = [
    { lang: 'st', slide: 15, body: 1, lessonId: 'market-community-l3', lessonParagraph: 1 },
    { lang: 'st', slide: 18, body: 2, lessonId: 'market-community-l3', lessonParagraph: 11 },
    { lang: 've', slide: 15, body: 1, lessonId: 'market-community-l3', lessonParagraph: 1 },
    { lang: 've', slide: 18, body: 2, lessonId: 'market-community-l3', lessonParagraph: 11 },
    { lang: 'ts', slide: 15, body: 1, lessonId: 'market-community-l3', lessonParagraph: 1 },
    { lang: 'ts', slide: 18, body: 2, lessonId: 'market-community-l3', lessonParagraph: 11 },
  ] as const;

  for (const item of reuse) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${item.lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, marketSource, item.lang);
    const slide = slides[item.slide - 1];
    const lesson = module.lessons.find(({ id }) => id === item.lessonId)!;
    const sourceParagraphs = lesson.body.split('\n\n');
    const learnerParagraphs = resolveLearnerLessonPresentation(lesson, item.lang).content.body.split('\n\n');
    assert.equal(slide.english.body[item.body], sourceParagraphs[item.lessonParagraph],
      `${item.lang} slide ${item.slide}: the entire deck paragraph must bind to the canonical source paragraph`);
    assert.equal(slide.target.body[item.body].status, 'draft');
    assert.equal(slide.target.body[item.body].text, learnerParagraphs[item.lessonParagraph],
      `${item.lang} slide ${item.slide}: reuse the learner resolver paragraph verbatim`);
    assert.equal(packet.reviewStatus, 'unreviewed');

    const changedSource = structuredClone(marketSource);
    changedSource[item.slide - 1].body[item.body] += ' Source wording changed.';
    assert.throws(() => validatePairedDraft(packet, changedSource, item.lang), /English body differs/,
      `${item.lang} slide ${item.slide}: a source edit invalidates this reuse mapping`);
  }
});

test('regional closing records passages remain visibly unreviewed and source-paired after wording refinements', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const [slideNumber, paragraphIndex] of [[1, 1], [6, 0], [18, 1]] as const) {
      const part = slides[slideNumber - 1].target.body[paragraphIndex];
      assert.equal(part.status, 'draft', `${lang} slide ${slideNumber} shows the records draft`);
      assert.equal(slides[slideNumber - 1].english.body[paragraphIndex], source[slideNumber - 1].body[paragraphIndex]);
      assert.ok(part.text && part.text !== source[slideNumber - 1].body[paragraphIndex]);
      if (part.provenance) assert.ok(part.provenance.includes('unreviewed'));
    }
    if (lang === 'ts') assert.ok(slides[0].target.body[1].text.includes('local food networks'),
      'keep the local network meaning explicit where the prior wording could imply food relationships');
  }
});

test('a changed source sentence or heading blocks the entire paired draft', () => {
  const changed = completeHold();
  changed.slides[3].english.body[1] += ' Water every day.';
  assert.throws(() => validatePairedDraft(changed, source), /slide 4: English body differs/);
  changed.slides[3].english.body = [...source[3].body];
  changed.slides[3].english.heading = 'Different heading';
  assert.throws(() => validatePairedDraft(changed, source), /slide 4: English heading differs/);
});

test('missing, duplicate, and reordered slide records cannot be rendered', () => {
  const missing = completeHold();
  missing.slides.pop();
  assert.throws(() => validatePairedDraft(missing, source), /slide count differs/);
  const duplicated = completeHold();
  duplicated.slides[1].n = 1;
  assert.throws(() => validatePairedDraft(duplicated, source), /slide 2: missing, duplicate, or out of order/);
  assert.throws(() => englishSlideRecords('**Slide 1 — One**\nA.\n**Slide 3 — Three**\nB.'), /slide 2: found number 3/);
  assert.throws(() => englishSlideRecords('**Slide 1 — One**\nA.\n**Slide 2: Bad**\nB.'), /malformed slide heading/);
});

test('a target needs a declared unreviewed status and full draft copy or an explicit English hold', () => {
  const draft: any = completeHold();
  draft.slides[0].target.heading = { status: 'draft', text: 'Selelekela' };
  draft.slides[0].target.body[0] = { status: 'draft', text: 'Draft paragraph' };
  assert.equal(validatePairedDraft(draft, source)[0].target.body[0].status, 'draft');
  draft.slides[0].target.body[1] = {};
  assert.throws(() => validatePairedDraft(draft, source), /paragraph 2: review status is missing/);
  draft.slides[0].target.body[1] = { status: 'draft' };
  assert.throws(() => validatePairedDraft(draft, source), /paragraph 2: target draft text is missing/);
  draft.slides[0].target.body[1] = { status: 'english-hold', text: 'Hidden translation' };
  assert.throws(() => validatePairedDraft(draft, source), /must not masquerade/);
  draft.slides[0].target.body[1] = { status: 'english-hold' };
  draft.slides[0].target.body[1] = { status: 'draft', text: source[0].body[1] };
  assert.throws(() => validatePairedDraft(draft, source), /unchanged English needs an explicit hold/);
  draft.slides[0].target.body[1] = { status: 'english-hold' };
  draft.slides[0].target.body.pop();
  assert.throws(() => validatePairedDraft(draft, source), /target paragraph count differs/);
  draft.slides[0].target.body.push({ status: 'english-hold' });
  draft.reviewStatus = 'reviewed';
  assert.throws(() => validatePairedDraft(draft, source), /reviewStatus must be unreviewed/);
});

test('the opt-in command rejects stale English before creating a slide directory', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-check-'));
  try {
    const draft = completeHold();
    draft.slides[5].english.body[0] = 'Changed farming instruction.';
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(draft));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output, '--paired-draft', json],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /slide 6: English body differs/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('the paired layout preflights all 22 full source records without writing media', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-layout-'));
  try {
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(completeHold()));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /validated 22 source-paired slides; no images written/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('the CLI preflights all supported paired languages and rejects unsupported languages', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-language-'));
  try {
    const json = join(temp, 'draft.json');
    writeFileSync(json, JSON.stringify(completeHold('ts')));
    const output = join(temp, 'slides');
    const supported = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'ts', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(supported.status, 0, supported.stderr);
    assert.match(supported.stdout, /validated 22 source-paired slides/);
    assert.equal(existsSync(output), false);

    const veDraft = join(temp, 've-draft.json');
    writeFileSync(veDraft, JSON.stringify(completeHold('ve')));
    const tshivenda = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 've', output,
        '--paired-draft', veDraft, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(tshivenda.status, 0, tshivenda.stderr);
    assert.match(tshivenda.stdout, /validated 22 source-paired slides/);
    assert.equal(existsSync(output), false);

    const unsupported = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'xh', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(unsupported.status, 0);
    assert.match(unsupported.stderr, /supports st, ts, ve and zu/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('Seeds native-source proof is explicit, exact-size, and does not relax the shared illustration gate', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-seeds-native-paired-'));
  try {
    const output = join(temp, 'slides');
    const args = ['scripts/make-lesson-slides.mjs', 'seeds-sovereignty', 'st', output,
      '--paired-draft', 'docs/narration-reviews/seeds-sovereignty.st.paired.json', '--validate-only'];
    const defaultGate = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(defaultGate.status, 0);
    assert.match(defaultGate.stderr, /slide 1 English illustration is too small/);
    assert.equal(existsSync(output), false);

    const native = spawnSync(process.execPath, [...args, '--paired-native-source'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(native.status, 0, native.stderr);
    assert.match(native.stdout, /validated 24 source-paired slides; no images written/);
    assert.equal(existsSync(output), false);

    const wrongModule = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'food-forest', 'st', output,
        '--paired-draft', 'docs/narration/food-forest.st.paired-draft.json',
        '--paired-native-source', '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(wrongModule.status, 0);
    assert.match(wrongModule.stderr, /currently limited to Seeds and Seed Sovereignty/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('isiZulu silent paired cards validate exact authored source and select original slide numbers only', () => {
  const zuluSource = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
  const packet: any = {
    language: 'zu',
    sourceLanguage: 'en',
    reviewStatus: 'unreviewed',
    slides: zuluSource.map((english) => ({
      n: english.n,
      english: structuredClone(english),
      target: {
        heading: { status: 'english-hold' },
        body: english.body.map((sourceEnglish: string) => ({ status: 'english-hold' })),
      },
    })),
  };
  packet.slides[1].target.heading = { status: 'draft', text: 'Kungani kubalulekile' };
  const firstBodySource = packet.slides[1].english.body[0];
  packet.slides[1].target.body[0] = {
    status: 'mixed',
    segments: [
      { sourceEnglish: 'A good design ', status: 'draft', text: 'Ukuhlela okuhle ' },
      { sourceEnglish: 'saves work before you pick up a spade.', status: 'english-hold' },
    ],
  };

  assert.equal(pairedDraftLanguageLabel('zu'), 'ISIZULU');
  const validated = validatePairedDraft(packet, zuluSource, 'zu');
  assert.deepEqual(validated[1].target.body[0].segments.map((segment: any) => segment.sourceEnglish).join(''), firstBodySource);
  assert.equal(pairedTargetHasEnglishHolds(validated[0].target), true);

  const selection = pairedSlideSelection('2,5', validated.length);
  const selected = selectPairedSlides(validated, selection);
  assert.deepEqual(selected.map((slide: any) => slide.n), [2, 5]);
  assert.equal(selected.length, 2);
  assert.equal(selected.some((slide: any) => slide.n === 1 || slide.n === 3 || slide.n === 4), false,
    'unselected English-hold cards remain in the fully validated packet but are not handed to rendering');

  const stalePacket = structuredClone(packet);
  stalePacket.slides[3].english.body[0] += ' Changed source.';
  assert.throws(() => validatePairedDraft(stalePacket, zuluSource, 'zu'), /slide 4: English body differs/,
    'selection must never let an unselected stale source bypass full-packet validation');
});

test('paired slide subset parsing rejects empty, duplicate, malformed, and out-of-range indices', () => {
  assert.equal(pairedSlideSelection(undefined, 22), null);
  assert.throws(() => pairedSlideSelection('', 22), /needs a comma-separated list/);
  assert.throws(() => pairedSlideSelection('1,1', 22), /duplicate slide numbers/);
  assert.throws(() => pairedSlideSelection('0,2', 22), /positive slide numbers/);
  assert.throws(() => pairedSlideSelection('2, 1.5', 22), /positive slide numbers/);
  assert.throws(() => pairedSlideSelection('23', 22), /only 22 slides/);
});

test('paired CLI validates the whole isiZulu packet but reports only selected original slide numbers', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-zulu-selection-'));
  try {
    const english = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
    const packet: any = {
      language: 'zu', sourceLanguage: 'en', reviewStatus: 'unreviewed',
      slides: english.map((record) => ({
        n: record.n,
        english: record,
        target: { heading: { status: 'english-hold' }, body: record.body.map(() => ({ status: 'english-hold' })) },
      })),
    };
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(packet));
    const selected = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'zu', output,
        '--paired-draft', json, '--slides', '2,5', '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /validated 2 source-paired slides; no images written/);
    assert.equal(existsSync(output), false);

    const staleUnselected = structuredClone(packet);
    staleUnselected.slides[3].english.body[0] += ' Changed source.';
    writeFileSync(json, JSON.stringify(staleUnselected));
    const stale = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'zu', output,
        '--paired-draft', json, '--slides', '2,5', '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /slide 4: English body differs/);
    assert.equal(existsSync(output), false,
      'a stale unselected record must block the selected output before any directory is created');

    const nonPaired = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'zu', output, '--slides', '2'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(nonPaired.status, 0);
    assert.match(nonPaired.stderr, /--slides requires --paired-draft/);
    assert.equal(existsSync(output), false);

    const repeatedSelection = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'zu', output,
        '--paired-draft', json, '--slides', '2', '--slides', '5', '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(repeatedSelection.status, 0);
    assert.match(repeatedSelection.stderr, /--slides may be specified only once/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

// Rewritten 2 October 2026: the F1 comparison, seed-parent selection and pollination paragraphs on slides 5, 8
// and 9 (and Tshivenda 8.7) were held in English until their conditions could be checked. They are now drafted
// with blind back-translations and independent semantic checks, so this requires every passage to be a labelled
// draft and the genetics terms, negations and storage conditions to stay explicit inside the translation.
test('Seeds regional drafts translate every slide and keep the genetics terms, negations and storage conditions', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/seeds-sovereignty.en.md', 'utf8'));
  const keeps: Record<'st' | 've' | 'ts', { notDie: string; evenIf: string; reject: string }> = {
    st: { notDie: 'Ha o shwe', evenIf: 'leha', reject: 'hane' },
    ve: { notDie: 'A zwi ambi uri mbeu i ḓo fa', evenIf: 'naho', reject: 'hane' },
    ts: { notDie: 'A xi fi', evenIf: 'hambiloko', reject: 'ala' },
  };
  for (const language of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(
      `docs/narration-reviews/seeds-sovereignty.${language}.paired.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    checkCompleteSlideDrafts(slides, language, `${language} Seeds`);
    const text = (slide: number, paragraph: number | 'heading') =>
      paragraph === 'heading' ? slides[slide - 1].target.heading.text : slides[slide - 1].target.body[paragraph].text;
    assert.match(text(4, 'heading'), /Open-Pollinated/);
    assert.match(text(4, 'heading'), /\bF1\b/);
    assert.match(text(4, 1), /stable variety/i);
    assert.match(text(4, 1), /self-pollination/);
    for (const paragraph of [2, 6]) assert.match(text(4, paragraph), /\bF1\b/);
    assertKeeps(text(4, 6), [keeps[language].notDie], `${language}: the next F1 generation varies but does not automatically die`);
    for (const term of [/open-pollinated/, /stable/, /pollination/]) assert.match(text(5, 2), term);
    assert.match(text(5, 3), /\bF1\b/);
    assert.match(text(8, 5), /cross-pollinated/);
    assertKeeps(text(8, 6), [keeps[language].evenIf, keeps[language].reject],
      `${language}: reject a seed plant even if its fruit is large (an earlier draft reversed this)`);
    assert.match(text(9, 4), /pollination/);
    assert.match(text(9, 4), /\(covers\)/);
    assert.match(text(18, 1), /desiccant/);
    assert.match(text(23, 8), /\(variety\)/);
    assert.match(text(7, 2), /\(varieties\)/, `${language}: the seed-variety meaning must remain explicit beside the regional draft`);
    if (language === 'ts') {
      assert.match(text(6, 4), /\(crop\)/, 'the Xitsonga word for plant must be disambiguated as a crop');
    }
  }
});

test('a paired illustration override must name an existing repository image before rendering', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-art-'));
  try {
    const json = join(temp, 'draft.json');
    const art = join(temp, 'art.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(completeHold()));
    writeFileSync(art, JSON.stringify({ 10: 'docs/media/no-such-site-image.jpg' }));
    const args = ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
      '--paired-draft', json, '--paired-art', art, '--validate-only'];
    const missing = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /image is missing or outside this repository/);
    assert.equal(existsSync(output), false);
    writeFileSync(art, JSON.stringify({ 10: 'docs/media/studies-illustrated-release/art/reading-landscape/landscape-walk.jpg' }));
    const present = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(present.status, 0, present.stderr);
    assert.match(present.stdout, /validated 22 source-paired slides/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a long draft fails layout instead of shrinking or dropping a farming paragraph', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-overflow-'));
  try {
    const draft: any = completeHold();
    draft.slides[0].target.body[0] = { status: 'draft', text: 'A long draft sentence. '.repeat(120) };
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(draft));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /slide 1 paired text needs .*phone-readable type size/);
    assert.match(result.stderr, /maximum extra space 800 px/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a moderately longer paired draft expands only its frame and keeps the readable type size', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-frame-growth-'));
  try {
    const draft: any = completeHold();
    draft.slides[0].target.body[0] = {
      status: 'draft',
      text: 'Read the full translated instruction at the same readable size. '.repeat(13),
    };
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(draft));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
        '--paired-draft', json],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const expandedSlide = readFileSync(join(output, 'slide-01.png'));
    assert.equal(expandedSlide.readUInt32BE(16), 1440);
    const expandedHeight = expandedSlide.readUInt32BE(20);
    assert.ok(expandedHeight > 5400 && expandedHeight <= 6200,
      `only the slide whose target panel overflows may grow by up to 800 px; got ${expandedHeight}`);

    const unchangedSlide = readFileSync(join(output, 'slide-02.png'));
    assert.equal(unchangedSlide.readUInt32BE(16), 1440);
    assert.equal(unchangedSlide.readUInt32BE(20), 5400,
      'a fitting frame retains the established 1440x5400 canvas');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('mixed paired text wraps as inline color runs without losing spaces or punctuation', () => {
  const code = String.raw`
import json, sys
sys.path.insert(0, 'scripts')
from PIL import Image, ImageDraw, ImageFont
from paired_text_flow import body_pitches, layout_mixed_segments
segments = [
    {'status': 'english-hold', 'text': 'Mist'},
    {'status': 'draft', 'text': ' alone does not show that '},
    {'status': 'english-hold', 'text': 'ice has formed'},
    {'status': 'draft', 'text': ', and'},
    {'status': 'english-hold', 'text': ' frost damage can happen without visible ice.'},
]
draw = ImageDraw.Draw(Image.new('RGB', (100, 100)))
font = ImageFont.load_default()
measure = lambda text: draw.textlength(text, font=font)
max_width = measure('Mist alone does not show that') + 2
lines, logical = layout_mixed_segments(segments, measure, max_width, 14)
word_error = ''
try:
    layout_mixed_segments([
        {'status': 'draft', 'text': 'word'},
        {'status': 'english-hold', 'text': ','},
    ], measure, measure('word') + measure(',') - 1, 15)
except ValueError as error:
    word_error = str(error)
measure_runs = [
    {'status': 'draft', 'text': 'abc'},
    {'status': 'english-hold', 'text': ','},
    {'status': 'draft', 'text': ' def'},
]
measured, measured_logical = layout_mixed_segments(measure_runs, measure, measure('abc') + measure(',') + 1, 16)
under_mark_pitches = body_pitches(['ṱa', 'next'])
print(json.dumps({'lines': lines, 'logical': logical, 'wordError': word_error,
                  'measured': measured, 'measuredLogical': measured_logical,
                  'underMarkPitches': under_mark_pitches, 'widthLimit': max_width,
                  'lineWidths': [sum(measure(run['text']) for run in line) for line in lines],
                  'measuredLimit': measure('abc') + measure(',') + 1,
                  'measuredWidths': [sum(measure(run['text']) for run in line) for line in measured]}))
`;
  const result = spawnSync('python3', ['-c', code], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const layout = JSON.parse(result.stdout);
  assert.equal(layout.logical,
    'Mist alone does not show that ice has formed, and frost damage can happen without visible ice.');
  assert.ok(layout.lines.length > 1, 'long mixed paragraphs wrap to the paired panel width');
  assert.equal(layout.lines.flatMap((line: any[]) => line.map(run => run.rawText)).join(''), layout.logical,
    'raw runs concatenate to the exact target text even when display lines wrap');
  const expectedStyledCharacters = [
    ...'Mist'.split('').map((char: string) => [char, 'english-hold']),
    ...' alone does not show that '.split('').map((char: string) => [char, 'draft']),
    ...'ice has formed'.split('').map((char: string) => [char, 'english-hold']),
    ...', and'.split('').map((char: string) => [char, 'draft']),
    ...' frost damage can happen without visible ice.'.split('').map((char: string) => [char, 'english-hold']),
  ].filter(([char]: any[]) => !/\s/.test(char));
  const actualStyledCharacters = layout.lines.flatMap((line: any[]) => line.flatMap(run =>
    run.rawText.split('').filter((char: string) => !/\s/.test(char)).map((char: string) => [char, run.status])));
  assert.deepEqual(actualStyledCharacters, expectedStyledCharacters,
    'every nonspace character, including punctuation, keeps its source run color in order');
  assert.ok(layout.lineWidths.every((width: number) => width <= layout.widthLimit),
    'each visual line stays within width measured using the actual font runs');
  for (const line of layout.lines) {
    assert.ok(line.every((run: any) => ['draft', 'english-hold'].includes(run.status)),
      'each inline run retains its source review/color status');
  }
  assert.ok(layout.lines.some((line: any[]) => new Set(line.map((run: any) => run.status)).size > 1),
    'draft and held text share a natural wrapped line without losing color boundaries');
  assert.ok(layout.lines.flatMap((line: any[]) => line)
    .some((run: any) => run.status === 'draft' && run.text.includes(', and')),
  'comma and conjunction remain attached to their translated run');
  assert.match(layout.wordError, /slide 15 has a word wider than its paired panel/,
    'a color boundary inside a word cannot become a visual line break before punctuation');
  assert.equal(layout.measuredLogical, 'abc, def');
  assert.equal(layout.measured.flatMap((line: any[]) => line.map(run => run.rawText)).join(''), 'abc, def');
  assert.ok(layout.measuredWidths.every((width: number) => width <= layout.measuredLimit),
    'wrapping measures the actual merged color runs drawn on the line');
  assert.deepEqual(layout.underMarkPitches, [78, 66],
    'Tshivenda under-marks retain their extra clearance between rendered lines');
});

test('Reading frost wording sync matches its independent source-bound seven-field proof', () => {
  const proof = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-BODY-DECK-SYNC-IMPLEMENTATION-2026-10-05.json', 'utf8'));
  const independent = JSON.parse(readFileSync(
    'docs/study-translation-reviews/READING-BODY-DECK-SYNC-INDEPENDENT-CHECK-2026-10-05.json', 'utf8'));
  assert.equal(independent.summary.semanticChecksPassed, 7);
  assert.equal(independent.summary.currentTargetsMatch, 7);
  const changed = new Set<string>();
  for (const language of ['st', 've', 'ts'] as const) {
    const pair = JSON.parse(readFileSync(`docs/narration/reading-landscape.${language}.paired-draft.json`, 'utf8'));
    // This seven-field review predates the full-deck pass. Check the live applied targets first,
    // then restore its recorded before-fields to inspect the historical seven-field composition.
    restorePreFullReadingDeck(pair, language);
    const snapshots = JSON.parse(readFileSync(
      `docs/study-translation-reviews/READING-BODY-DECK-SYNC-BEFORE-${language.toUpperCase()}-2026-10-05.json`, 'utf8'));
    const fields = proof.pairedFields[language].changedFields;
    for (const field of fields) {
      const key = `${language}:${field.slide}:${field.bodyIndex}`;
      changed.add(key);
      const slide = pair.slides[field.slide - 1];
      assert.equal(slide.english.body[field.bodyIndex], field.source,
        `${key}: the paired English source remains unchanged`);
      const target = slide.target.body[field.bodyIndex];
      const laterField = approvedStudyOutcome('reading-landscape', language, field.slide, field.bodyIndex);
      if (laterField) {
        assertCurrentStudyOutcome(target, laterField, key);
      } else {
        assert.equal(target.status, 'mixed', `${key}: unreviewed translated and held clauses stay visible`);
        assert.deepEqual(target, field.newTarget, `${key}: preserve the approved field composition exactly`);
      }
      assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), field.source,
        `${key}: source segments cover the complete original field in order`);
      const visible = target.segments.map((segment: any) =>
        segment.status === 'english-hold' ? segment.sourceEnglish : segment.text).join('');
      assert.equal(visible, laterField?.targetText ?? field.renderedText,
        `${key}: held text remains exact and draft text is source-paired`);
      for (const segment of target.segments) {
        if (segment.status === 'english-hold') assert.equal(segment.text, undefined, `${key}: holds use exact source copy`);
      }
      const previous = snapshots.slides[field.slide - 1].target.body[field.bodyIndex];
      assert.deepEqual(previous, field.previousTarget, `${key}: before-state is recorded for preservation checks`);
    }
    for (const snapshot of snapshots.slides) {
      const live = pair.slides[snapshot.n - 1];
      assert.deepEqual(live.english, snapshot.english, `${language} slide ${snapshot.n}: source snapshot remains exact`);
      assert.deepEqual(live.target.heading, snapshot.target.heading,
        `${language} slide ${snapshot.n}: headings stay unchanged`);
      for (let index = 0; index < snapshot.target.body.length; index++) {
        if (!fields.some((field: any) => field.slide === snapshot.n && field.bodyIndex === index)) {
          const laterObservation = firstObservationField(language, snapshot.n, index);
          if (laterObservation) {
            assertCurrentFirstObservation(live.target.body[index], laterObservation,
              `${language} Reading slide ${snapshot.n} body ${index}`);
            continue;
          }
          const laterField = approvedStudyOutcome('reading-landscape', language, snapshot.n, index);
          if (laterField) {
            assertCurrentStudyOutcome(live.target.body[index], laterField,
              `${language} Reading slide ${snapshot.n} body ${index}`);
            continue;
          }
          assert.deepEqual(live.target.body[index], snapshot.target.body[index],
            `${language} slide ${snapshot.n} body ${index}: unlisted target remains unchanged`);
        }
      }
    }
  }
  assert.equal(changed.size, 7);
  assert.equal(new Set([...changed].map(key => key.split(':').slice(0, 2).join(':'))).size, 4,
    'the seven fields affect the four intended frame numbers');
});

test('the reviewed three-line Market channel heading passes at readable size while runaway headings still fail', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-market-heading-fit-'));
  try {
    const market = JSON.parse(readFileSync('docs/narration/market-community.ts.paired-draft.json', 'utf8'));
    assert.equal(market.slides[12].english.heading, 'Match the Channel to Your Supply');
    assert.equal(market.slides[12].target.heading.status, 'draft');

    const validJson = join(temp, 'market-three-line.json');
    const validOutput = join(temp, 'valid-slides');
    writeFileSync(validJson, JSON.stringify(market));
    const valid = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'market-community', 'ts', validOutput,
        '--paired-draft', validJson, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /validated 20 source-paired slides; no images written/);
    assert.equal(existsSync(validOutput), false);

    const tooLong = structuredClone(market);
    tooLong.slides[12].target.heading.text = 'A deliberately excessive Market heading '.repeat(30);
    const invalidJson = join(temp, 'market-runaway-heading.json');
    const invalidOutput = join(temp, 'invalid-slides');
    writeFileSync(invalidJson, JSON.stringify(tooLong));
    const invalid = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'market-community', 'ts', invalidOutput,
        '--paired-draft', invalidJson, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /heading needs more than three lines/);
    assert.equal(existsSync(invalidOutput), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


// Rewritten 2 October 2026: the Sesotho Plant Guilds deck no longer mixes legacy "ENGLISH HOLD —" sentences into
// 22 drafted paragraphs and leaves 28 paragraphs fully English. All 51 slides are drafted in full beside exact
// English, with nitrogen, nodule, bacteria and insect wording checked alongside the support-plant terms.
test('Sesotho Plant Guilds slides draft all 51 slides in full, with no English hold sentences inside the drafts', () => {
  const slides = checkForestGuildDeck('plant-guilds', 'st');
  for (const slide of slides) {
    for (const part of [slide.target.heading, ...slide.target.body]) {
      assert.doesNotMatch(part.text, /ENGLISH HOLD/, `st slide ${slide.n}: no legacy hold sentence inside a draft`);
    }
  }
  assertKeepsTerms(slides[7].target.body[0].text, ['(bacteria)', 'nitrogen', 'legume', 'nodules', 'nodulation'],
    'st slide 8: bacteria, nitrogen, nodules and nodulation');
  assertKeepsTerms(slides[13].target.body[0].text, ['invasive', '(pods)', 'botanical guidance', 'project species list'],
    'st slide 14: invasive red sesbania, its pods and the project species list');
});

// Rewritten 2 October 2026: the Tshivenda and Xitsonga Plant Guilds decks no longer localise only the observation
// prompts on slides 46 and 47; every heading and paragraph on all 51 slides is drafted beside exact English,
// including the chop-and-drop clip caption on slide 27 that stayed English.
test('Tshivenda and Xitsonga Plant Guilds slides draft all 51 slides, observation prompts and clip caption included', () => {
  for (const lang of ['ve', 'ts'] as const) {
    const slides = checkForestGuildDeck('plant-guilds', lang);
    assert.equal(slides[26].english.body[0], 'Watch the branch fall onto the cut leaves.');
    assertKeepsTerms(slides[31].target.body[0].text, ['Bocking 14', 'cultivar', 'viable seed'],
      `${lang} slide 32: the Bocking 14 cultivar and viable seed`);
    assertKeepsTerms(slides[33].target.body[0].text, ['ladybirds', 'aphids', 'parasitoid wasps', '(pests)', '(insects)'],
      `${lang} slide 34: helpful insects and crop pests`);
    assertKeepsTerms(slides[42].target.body[0].text, ['support plants', 'thinning', 'chop-and-drop', 'mulch'],
      `${lang} slide 43: thinning support plants through chop-and-drop`);
  }
});
