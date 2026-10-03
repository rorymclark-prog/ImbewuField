import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishSlideRecords, pairedDraftLanguageLabel, pairedTargetHasEnglishHolds, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
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
    { slide: 2, body: 2, source: 'Use that information to protect household food and make better business decisions.', anchors: ['better business decisions'] },
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
      for (const anchor of item.anchors) assert.ok(part.text.includes(anchor), `${language} keeps the ${anchor} anchor`);
    }
    assert.ok(slides[1].target.body.every((part: any) => part.status === 'draft'),
      `${language} pairs each ordinary harvest-use explanation with its exact English source`);
    assert.ok(slides[4].target.body.every((part: any) => part.status === 'draft'),
      `${language} records every harvest while retaining quantity and destination wording`);
  }
});

test('Water Harvesting keeps technical teaching in English under localized generic headings', () => {
  const waterSource = englishSlideRecords(readFileSync('docs/narration/water-harvesting.en.md', 'utf8'));
  const candidates = {
    st: 'Dihla tsa dipula di fapana ho pholletsa le Afrika Borwa.',
    ve: 'Zwifhinga zwa mvula zwi a fhambana kha Afrika Tshipembe.',
    ts: 'Tinguva ta mpfula ta hambana eAfrika Dzonga.',
  };
  const safeHeadings = {
    st: { 2: 'Liphetho tsa ho ithuta', 23: 'Mosebetsi oa tšimong' },
    ve: { 2: 'Zwine na ḓo guda', 23: 'Mushumo wa tsimuni' },
    ts: { 2: 'Leswi u nga ta swi dyondza', 23: 'Ntirho wa le nsinini' },
  };
  assert.equal(waterSource.length, 24);
  for (const [language, candidate] of Object.entries(candidates)) {
    const packet = JSON.parse(readFileSync(`docs/narration/water-harvesting.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, waterSource, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 24);
    const drafted = [];
    for (const slide of slides) {
      const genericHeading = safeHeadings[language as keyof typeof safeHeadings][slide.n as 2 | 23];
      if (genericHeading) {
        assert.equal(slide.target.heading.status, 'draft');
        assert.equal(slide.target.heading.text, genericHeading);
        assert.match(slide.target.heading.provenance, /unreviewed.*exact English source paired/);
      } else {
        assert.equal(slide.target.heading.status, 'english-hold',
          `${language} slide ${slide.n}: technical or unreviewed title remains English`);
      }
      for (const [index, part] of slide.target.body.entries()) {
        if (part.status === 'mixed') {
          assert.equal(slide.n, 10);
          assert.equal(index, 1);
          assert.deepEqual(part.segments.map(({ status }: { status: string }) => status), ['draft', 'english-hold']);
          assert.equal(pairedTargetHasEnglishHolds(slide.target), true,
            'a mixed passage with held English text must retain the visible English-hold label');
          assert.equal(part.segments[0].sourceEnglish, 'Rainfall seasons differ across South Africa.');
          assert.equal(part.segments[0].text, candidate);
          assert.equal(part.segments.map(({ sourceEnglish }: { sourceEnglish: string }) => sourceEnglish).join(''), slide.english.body[index]);
          drafted.push(slide.n);
        } else {
          assert.equal(part.status, 'english-hold');
          assert.equal(part.text, undefined);
        }
      }
    }
    assert.deepEqual(drafted, [10], `${language}: every technical or actionable passage stays held`);
  }
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

test('silent Xitsonga Introduction stills expose only source-paired, directionally checked drafts', () => {
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
  assert.ok(ts[6].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'),
    'borehole access and supply instructions stay exact English');
  assert.ok(ts[5].target.body.slice(1, 4).every((part: any) => part.status === 'english-hold'),
    'uncertain Xitsonga Fair Share wording cannot reverse the teaching point');
  assert.equal(ts[7].target.body[0].status, 'draft', 'ethics purpose is a marked Xitsonga orientation draft');
  assert.ok(ts[7].target.body.slice(1).every((part: any) => part.status === 'english-hold'),
    'grazing, swales, permission and building guidance stay exact English');
  assert.equal(ve[2].target.body[4].status, 'draft', 'the later-plan sketch metaphor is a marked Tshivenda draft');
  assert.ok(ve[2].target.body.slice(1, 4).every((part: any) => part.status === 'english-hold'),
    'technical learning goals stay exact English');
});

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

// Rewritten 2 October 2026: the Xitsonga deck no longer drafts only its four orientation slides. Every heading and
// paragraph on all 20 slides, including the species, site, water and legal guidance that was held in English, is
// now a back-translated unreviewed draft beside its exact English, with the closing follow-up checks drafted too.
test('Food Forest Xitsonga slides draft every passage, including the species, site and legal guidance once held in English', () => {
  const slides = checkForestGuildDeck('food-forest', 'ts');
  assertKeepsTerms(slides[16].target.body[2].text, ['support plants', 'thinning', 'mulch'],
    'ts slide 17: prune or thin support plants and return clean cuttings as mulch');
  assertKeepsTerms(slides[15].target.body[1].text, ['cardboard', 'mulch'], 'ts slide 16: plain cardboard under mulch');
});

test('regional Introduction drafts stay source-paired while uncertain farming, safety and permission advice stays English', () => {
  for (const lang of ['ve', 'ts']) {
    const packet = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    const drafted = slides.flatMap((slide: any) => slide.target.body
      .map((paragraph: any, index: number) => paragraph.status === 'draft' ? `${slide.n}:${index + 1}` : null)
      .filter(Boolean));
    // A fixed complete draft list became stale whenever a safely checked reflection
    // was translated. Verify the new source-paired slots and keep the consequential
    // English holds below; the validator checks every other slot's structure.
    for (const slot of lang === 've' ? ['8:1', '17:4', '20:3'] : ['2:3', '11:4', '17:4']) {
      assert.ok(drafted.includes(slot), `${lang} slide paragraph ${slot} remains a visible draft`);
    }
    assert.deepEqual(slides.filter((slide: any) => slide.target.heading.status === 'draft')
      .map((slide: any) => slide.n), lang === 've'
      ? [2, 4, 5, 6, 8, 9, 11, 12, 13, 14, 18, 19, 20, 21, 22]
      : [1, 2, 3, 4, 5, 6]);
    if (lang === 'ts') {
      assert.equal(slides[0].target.heading.text, 'Masungulo ya Permaculture');
      assert.equal(slides[0].english.heading, 'Introduction to Permaculture');
      assert.ok(slides.slice(6).every((slide: any) => slide.target.heading.status === 'english-hold'),
        'slides 7–22 keep every title in exact English until its terms and register receive fluent review');
      for (const n of [7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22]) {
        assert.ok(slides[n - 1].target.body.every((part: any, index: number) =>
          part.status === 'english-hold' ||
          (n === 7 && index === 2) ||
          (n === 8 && index === 0) ||
          (n === 11 && index === 3) ||
          (n === 17 && [0, 3].includes(index)) ||
          (n === 20 && index === 3)),
          `slide ${n}: ethics, technical, farming, safety or field-action text stays in exact English`);
      }
      assert.ok(slides[8].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.ok(slides[15].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.equal(slides[8].target.body[2].status, 'draft');
      assert.deepEqual(slides[15].target.body.slice(2).map((part: any) => part.status), ['draft', 'draft']);
    }
    assert.equal(slides[1].target.body[0].status, lang === 'ts' ? 'draft' : 'english-hold',
      `slide 2 ${lang}: only the independently checked work-before-digging draft may replace the spade image`);
    if (lang === 've') assert.equal(slides[1].target.body[2].status, 'english-hold',
      'Tshivenda slide 2 land-work contrast remains an English hold');
    for (const [index, part] of slides[2].target.body.entries()) {
      if (index === 0) continue;
      const checkedDraft = (lang === 'ts' && [1, 4].includes(index)) || (lang === 've' && index === 4);
      assert.equal(part.status, checkedDraft ? 'draft' : 'english-hold',
        `slide 3 ${lang}: only checked ethics and sketch reflections may replace English holds`);
    }
    for (const n of [4, 5, 6]) {
      assert.ok(slides[n - 1].target.body.slice(1).every((part: any, index: number) =>
        part.status === 'english-hold' || (n === 4 && index === 2) || (n === 5 && [0, 1, 3].includes(index))),
        `slide ${n} ${lang}: examples and care advice stay held apart from the ordinary reflections and People Care example`);
    }
    assert.match(slides[4].target.body[2].text, /People Care/,
      `slide 5 ${lang}: keep the named ethic visible in English`);
    assert.notEqual(slides[4].target.body[2].text, slides[4].english.body[2],
      `slide 5 ${lang}: a draft label cannot disguise unchanged English as a translation`);
    assert.equal(slides[4].target.body[1].status, 'draft',
      `slide 5 ${lang}: the family-priority sentence is a marked, source-paired draft`);
    assert.equal(slides[4].target.body[4].status, 'draft',
      `slide 5 ${lang}: the closing household-food reflection is a marked, source-paired draft`);
    assert.equal(slides[4].target.body[3].status, 'english-hold',
      `slide 5 ${lang}: keep the farm-purpose sentence held until its wording is checked`);
    for (const index of [1, 4]) {
      assert.ok(slides[4].target.body[index].text?.trim(),
        `slide 5 ${lang}: each new draft needs visible target text`);
      assert.notEqual(slides[4].target.body[index].text, slides[4].english.body[index],
        `slide 5 ${lang}: a draft label cannot disguise unchanged English as a translation`);
    }
    for (const index of [1, 2]) assert.equal(slides[5].target.body[index].status, 'english-hold',
      `slide 6 ${lang}: keep the uncertain surplus/mielies example paired in English`);
    assert.ok(slides[6].target.body.every((part: any, index: number) =>
      part.status === 'english-hold' || (lang === 'ts' && index === 2 && part.status === 'draft')),
    `slide 7 ${lang}: water access and work claims stay English; only the checked Xitsonga help question may be drafted`);
    assert.ok(slides[7].target.body.every((part: any, index: number) =>
      part.status === 'english-hold' || (index === 0 && part.status === 'draft')),
    `slide 8 ${lang}: only the checked ethics orientation may replace an English hold`);
    if (lang === 've') {
      const permittedReflectiveDrafts: Record<number, number[]> = { 16: [2, 3], 17: [0, 3], 18: [3], 20: [2, 3] };
      for (const n of [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22]) {
        assert.ok(slides[n - 1].target.body.every((part: any, index: number) =>
          part.status === 'english-hold' || (permittedReflectiveDrafts[n] ?? []).includes(index)),
          `slide ${n}: farming, safety, ecological, zone/sector and field instructions need a fluent review`);
      }
      for (const n of [15, 16, 17]) assert.equal(slides[n - 1].target.heading.status, 'english-hold',
        `slide ${n}: rejected or unreviewed heading stays in English`);
      assert.equal(slides[9].target.heading.status, 'english-hold',
        'slide 10 keeps Observe and Interact in English because the candidate changed the object of interaction');
      assert.ok(slides[13].target.body.slice(1).every((part: any) => part.status === 'english-hold'),
        'slide 14 keeps manure, food-safety and further integration wording in English');
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

test('Vegetables slide 14 pairs both regional resilience drafts while keeping the one-crop limit exact', () => {
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
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  assert.deepEqual(drafted, ['2:3', '2:5', '13:6', '14:1', '14:2', '14:5']);
  const lesson = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.xitsongaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[12, 5, 10], [13, 0, 11], [13, 1, 12], [13, 4, 15]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assert.equal(slides[13].target.body[2].status, 'english-hold',
    'the one-crop point-of-failure claim remains exact English in this slide packet');
  assert.equal(slides[13].target.body[3].status, 'english-hold');
  assert.equal(slides[1].target.body[1].status, 'english-hold',
    'the Xitsonga glut wording still needs fluent review');
  assert.equal(slides[1].target.body[3].status, 'english-hold',
    'coming ready must not become already ready to harvest');
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
  assert.ok(specialistAdvice.text.startsWith('Seek qualified advice for unfamiliar disease or technical problems.'),
    'the unresolved specialist advice remains exact English inside the visibly unreviewed draft');
  assert.equal(slides[17].english.body[2], source[17].body[2]);
});

test('Tshivenda staples media holds the unresolved staple placeholder in English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 've');
  assert.deepEqual(slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean)), ['2:2', '14:2']);
  assert.equal(slides[1].target.body[2].status, 'english-hold',
    'the Tshivenda harvest verb must not become the word for drinking');
  assert.equal(slides[1].target.body[3].status, 'english-hold');
  assert.equal(slides[1].target.body[4].status, 'english-hold');
  assert.equal(slides[11].target.body[0].status, 'english-hold',
    'the literal [staple] placeholder cannot be shown as a learner draft');
  assert.equal(slides[13].english.body[1], TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.sourceEnglish);
  assert.equal(slides[13].target.body[1].text, TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.tshivendaDraft);
  assert.equal(slides[11].target.body[3].status, 'english-hold');
  assert.equal(slides[13].target.body[3].status, 'english-hold');
});

test('Vegetables study headings never turn field tasks into translated instructions', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const n of [3, 17, 18]) {
      assert.equal(slides[n - 1].target.heading.status, 'draft', `${lang} slide ${n} has a visibly unreviewed heading`);
      assert.equal(slides[n - 1].english.heading, source[n - 1].heading, `${lang} slide ${n} preserves the exact heading source`);
      assert.ok(slides[n - 1].target.body.every((part: any) => part.status === 'english-hold'),
        `${lang} slide ${n} keeps the field instructions in English`);
    }
    assert.equal(slides[1].english.heading, 'Why This Matters');
    assert.equal(slides[1].target.body[3].status, 'english-hold',
      `${lang} must not imply food is already ready to harvest`);
  }
});

test('regional Study frames draft screened observations while risky advice stays in exact English', () => {
  const cases = [
    { moduleId: 'vegetables-staples', lang: 'st', drafted: ['1:2', '2:1', '2:2', '2:3', '2:5', '8:1', '8:4', '9:1'], held: ['2:4', '8:2', '8:3', '8:5', '8:6'] },
    { moduleId: 'market-community', lang: 've', drafted: ['2:1', '2:2', '2:3', '3:4', '18:1', '18:3'], held: ['7:2', '15:4'] },
    // Soil ordinary framing/observation cells are now source-paired visible drafts; technical or action-sensitive holds remain exact English below.
    { moduleId: 'soil-health', lang: 'ts', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '3:1', '5:1', '5:2', '5:3', '14:1', '19:2'], held: ['2:3', '4:1', '4:2', '5:4', '20:4'] },
    { moduleId: 'soil-health', lang: 'st', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '5:1', '5:2', '5:3', '5:4', '14:1', '19:2', '20:4'], held: ['3:3', '4:1'] },
    { moduleId: 'soil-health', lang: 've', drafted: ['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '5:1', '5:2', '5:3', '14:1', '19:2'], held: ['4:1', '4:2', '5:4', '20:4'] },
  ] as const;
  for (const { moduleId, lang, drafted, held } of cases) {
    const source = englishSlideRecords(readFileSync(`docs/narration/${moduleId}.en.md`, 'utf8'));
    const packet = JSON.parse(readFileSync(`docs/narration/${moduleId}.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const item of drafted) {
      const [n, p] = item.split(':').map(Number);
      assert.equal(slides[n - 1].target.body[p - 1].status, 'draft',
        `${lang} ${moduleId} ${item} keeps its source-paired draft as the deck grows`);
    }
    for (const item of held) {
      const [n, p] = item.split(':').map(Number);
      assert.equal(slides[n - 1].target.body[p - 1].status, 'english-hold', `${lang} ${moduleId} ${item} keeps the exact source`);
    }
  }
});

test('regional Market slides preserve exact price and seed holds plus conditions inside unreviewed drafts', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const safetyAnchors = {
    st: { beforePrice: 'Pele o beha theko', noGuarantee: 'ha e tiise thekiso', agreement: 'feela ha', beforeBoxes: 'pele o tshepisa' },
    ve: { beforePrice: 'Musi ni sa athu', noGuarantee: 'a u fulufhedzisi', agreement: 'only when customers and growers can keep the agreement', beforeBoxes: 'musi ni sa athu fulufhedzisa' },
    ts: { beforePrice: 'U nga si veka', noGuarantee: 'a wu tiyisisi', agreement: 'ntsena loko', beforeBoxes: 'u nga si tiyisekisa' },
  } as const;
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    for (const [slideNumber, paragraphIndex] of [[7, 1], [15, 3]] as const) {
      const slide = slides[slideNumber - 1];
      const held = slide.target.body[paragraphIndex];
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
      [15, 1, 'Plan suitable isolation, selection, drying and storage for each crop.'],
      [15, 2, 'Check identity and germination before relying on shared seed.'],
      [18, 2, 'Seek qualified advice for unfamiliar disease or technical problems.'],
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
    assert.match(unsupported.stderr, /supports st, ts and ve/);
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
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
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
