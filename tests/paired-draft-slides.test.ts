import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishSlideRecords, pairedDraftLanguageLabel, pairedTargetHasEnglishHolds, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';

const source = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
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

test('Water Harvesting regional decks translate only one source-paired rainfall sentence', () => {
  const waterSource = englishSlideRecords(readFileSync('docs/narration/water-harvesting.en.md', 'utf8'));
  const candidates = {
    st: 'Dihla tsa dipula di fapana ho pholletsa le Afrika Borwa.',
    ve: 'Zwifhinga zwa mvula zwi a fhambana kha Afrika Tshipembe.',
    ts: 'Tinguva ta mpfula ta hambana eAfrika Dzonga.',
  };
  assert.equal(waterSource.length, 24);
  for (const [language, candidate] of Object.entries(candidates)) {
    const packet = JSON.parse(readFileSync(`docs/narration/water-harvesting.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, waterSource, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 24);
    const drafted = [];
    for (const slide of slides) {
      assert.equal(slide.target.heading.status, 'english-hold', `${language} slide ${slide.n}: title remains English`);
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

test('silent Small Livestock drafts keep animal-care text exact and ship the reviewed still bytes', () => {
  const english = englishSlideRecords(readFileSync('docs/narration/small-livestock.en.md', 'utf8'));
  assert.equal(english.length, 20);
  for (const lang of ['st', 've', 'ts']) {
    const packet = JSON.parse(readFileSync(`docs/study-translation-reviews/small-livestock-regional/small-livestock.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, english, lang);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 20);
    for (const number of [12, 13, 14, 15, 16, 18, 19, 20]) {
      assert.ok(slides[number - 1].target.body.every((part: any) => part.status === 'english-hold'),
        `${lang} slide ${number}: husbandry, safety, manure and field-action advice stays exact English`);
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

test('Food Forest Xitsonga orientation is drafted while site-specific field guidance stays in English', () => {
  const foodForestSource = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, foodForestSource, 'ts');
  assert.equal(packet.reviewStatus, 'unreviewed');
  assert.equal(slides.length, 20);
  // The former exact draft list blocked legitimate translation of the introduction.
  // Keep the learner-facing rule: introductory copy is localised, and each later hold is explicit.
  assert.ok(slides.slice(0, 4).every((slide: any) =>
    slide.target.heading.status === 'draft' &&
    slide.target.body.every((part: any) => part.status === 'draft')),
  'the four introductory slides should not silently revert to English');
  for (const slide of slides) {
    for (const [index, part] of slide.target.body.entries()) {
      if (part.status === 'english-hold') {
        assert.equal(part.text, undefined, `slide ${slide.n} paragraph ${index + 1} is an explicit English hold`);
      }
    }
  }
  assert.ok(slides.filter((slide: any) => slide.n === 7 || slide.n >= 9).every((slide: any) =>
    slide.target.body.every((part: any) => part.status === 'english-hold')),
  'species, site, water, legal and field-action slides retain all teaching text in English');
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
          (n === 11 && index === 3) ||
          (n === 17 && [0, 3].includes(index))),
          `slide ${n}: ethics, technical, farming, safety or field-action text stays in exact English`);
      }
      assert.ok(slides[8].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.ok(slides[15].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.equal(slides[8].target.body[2].status, 'draft');
      assert.deepEqual(slides[15].target.body.slice(2).map((part: any) => part.status), ['draft', 'draft']);
    }
    assert.equal(slides[1].target.body[0].status, 'english-hold',
      `slide 2 ${lang}: the spade claim needs a local check`);
    if (lang === 've') assert.equal(slides[1].target.body[2].status, 'english-hold',
      'Tshivenda slide 2 land-work contrast remains an English hold');
    for (const part of slides[2].target.body.slice(1)) assert.equal(part.status, 'english-hold',
      `slide 3 ${lang}: ethics, principles, zones and sectors must remain English`);
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
    assert.ok(slides[6].target.body.every((part: any) => part.status === 'english-hold'),
      `slide 7 ${lang}: water, permission and work claims must remain English`);
    assert.ok(slides[7].target.body.every((part: any, index: number) =>
      part.status === 'english-hold' || (lang === 've' && index === 0)),
    `slide 8 ${lang}: only the Tshivenda ethics orientation may replace an English hold`);
    if (lang === 've') {
      const permittedReflectiveDrafts: Record<number, number[]> = { 16: [3], 17: [0, 3], 18: [3], 20: [2, 3] };
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

test('Food Forest Xitsonga media pairs every unreviewed sentence with its current English narration', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  for (const slide of slides) {
    for (const [index, paragraph] of slide.target.body.entries()) {
      if (paragraph.status === 'draft') {
        assert.notEqual(paragraph.text, slide.english.body[index],
          `slide ${slide.n} paragraph ${index + 1} must not disguise English as a translation`);
      } else {
        assert.equal(paragraph.text, undefined,
          `slide ${slide.n} paragraph ${index + 1} must visibly hold exact English`);
      }
    }
  }
  assert.equal(slides[7].target.heading.status, 'draft');
  assert.equal(slides[12].target.heading.status, 'draft');
  assert.equal(slides[12].target.body[0].status, 'english-hold',
    'the candidate narrowed habitat support to habitat protection');
  assert.equal(slides[12].target.body[2].status, 'english-hold',
    'healthy grassland advice remains exact English pending local review');
});

test('Food Forest Sesotho slides pair low-risk orientation drafts with exact English and hold technical guidance', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  assert.equal(slides.length, 20);
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((paragraph: any, index: number) => paragraph.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  for (const field of ['1:1', '1:4', '2:1', '4:1', '4:2', '4:3', '4:4', '8:2', '13:1']) {
    assert.ok(drafted.includes(field), `the source-paired draft at ${field} should remain available`);
  }
  assert.equal(slides[1].target.heading.status, 'draft');
  assert.equal(slides[2].target.heading.status, 'draft');
  for (const n of [8, 13]) {
    assert.equal(slides[n - 1].target.heading.status, 'draft',
      `slide ${n} offers an unreviewed orientation heading beside exact English`);
  }
  assert.equal(slides[12].target.body[1].status, 'english-hold',
    'ecosystem and percentage guidance remains exact English');
  assert.equal(slides[12].target.body[2].status, 'english-hold',
    'healthy-grassland protection remains exact English');
  for (const [slideIndex, paragraphIndex] of [[0, 0], [0, 3], [1, 0]]) {
    const slide = slides[slideIndex];
    const draft = slide.target.body[paragraphIndex];
    assert.equal(draft.status, 'draft');
    assert.ok(draft.text && draft.text !== slide.english.body[paragraphIndex]);
    assert.ok(draft.provenance?.includes('unreviewed-draft'));
  }
  assert.equal(slides[0].target.body[1].status, 'english-hold',
    'canopy-to-root-crop claim needs local language and farming review');
  assert.equal(slides[1].target.body[1].status, 'english-hold',
    'plant competition and soil-cover guidance remains exact English');
  assert.ok(slides[2].target.body.every((part: any) => part.status === 'english-hold'),
    'layers, approved species and establishment timing must not be improvised');
  assert.deepEqual([
    slides[3].target.body[0].text,
    slides[3].target.body[1].text,
    slides[7].target.body[1].text,
  ], [
    'Moru wa tlhaho o tlatsa sebaka ho tloha makaleng a hodimo ho isa metsong.',
    'Dimela tse fapaneng di sebedisa kganya le mongobo tse fumanehang boemong ba tsona.',
    'Ha dimela di ntse di hola, moriti le masalla a makgasi di fetola maemo a ka tlase ho tsona.',
  ]);
  assert.ok(slides.every((slide: any) => slide.target.body.every((part: any) =>
    part.status === 'draft' || (part.status === 'english-hold' && part.text === undefined))));
  const lessonBody = SESOTHO_FOOD_FOREST_DRAFT.lessons[0].body;
  const lessonEnglish = lessonBody.sourceEnglish.split('\n\n');
  const lessonSesotho = lessonBody.sesothoDraft.split('\n\n');
  // These two forest-pattern sentences now appear in both the learner text and silent slide.
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 1, 1], [3, 2, 2], [3, 3, 3], [7, 1, 11]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], lessonEnglish[lessonParagraph],
      `slide ${slideIndex + 1} must use the exact lesson source sentence`);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, lessonSesotho[lessonParagraph],
      `slide ${slideIndex + 1} must reuse the existing Sesotho draft sentence`);
  }
  assert.ok(slides.every((slide: any) => slide.target.body.every((part: any) =>
    part.status === 'draft' || part.status === 'english-hold')));
});

test('Tshivenda Food Forest drafts pair habitat context while field care and grassland guidance stay English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ve.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 've');
  assert.ok(slides.slice(0, 4).every((slide: any) =>
    slide.target.heading.status === 'draft' &&
    slide.target.body.every((part: any) => part.status === 'draft')),
  'the four introductory slides should not silently revert to English');
  const lesson = TSHIVENDA_FOOD_FOREST_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.tshivendaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 2, 2], [3, 3, 3], [5, 0, 4]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assert.equal(slides[5].target.body[1].status, 'english-hold');
  assert.equal(slides[7].target.heading.status, 'draft');
  assert.equal(slides[12].target.heading.status, 'draft');
  assert.equal(slides[12].target.body[0].status, 'draft');
  assert.equal(slides[12].target.body[1].status, 'english-hold');
  assert.equal(slides[12].target.body[2].status, 'english-hold',
    'the healthy-grassland protection instruction cannot silently become an unreviewed draft');
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
  assert.equal(slides[4].target.body[1].status, 'english-hold',
    'kilograms, dozens and bundles remain English until the units are checked');
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
  assert.equal(slides[17].target.body[1].status, 'english-hold');
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
    { moduleId: 'market-community', lang: 've', drafted: ['2:1', '2:2', '3:4', '18:1'], held: ['2:3', '18:3'] },
    { moduleId: 'soil-health', lang: 'ts', drafted: ['1:1', '2:1', '3:1', '5:1', '5:3', '14:1'], held: ['1:3', '2:3', '4:1', '4:2', '5:2', '5:4', '19:2', '20:4'] },
    { moduleId: 'soil-health', lang: 'st', drafted: ['1:1', '2:1', '2:3', '5:1', '5:3', '5:4', '14:1', '20:4'], held: ['1:2', '1:3', '2:2', '3:3', '4:1', '5:2', '19:2'] },
    { moduleId: 'soil-health', lang: 've', drafted: ['1:1', '2:1', '2:3', '5:1', '5:3', '14:1'], held: ['1:3', '4:1', '4:2', '5:2', '5:4', '19:2', '20:4'] },
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

test('regional Market slides keep financial, seed, tool and specialist advice in exact English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  for (const lang of ['st', 've', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/market-community.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    for (const n of [7, 10, 11, 12, 15, 16, 17]) {
      assert.ok(slides[n - 1].target.body.every((part: any) => part.status === 'english-hold'),
        `${lang} slide ${n} keeps action or trading advice in English`);
    }
    assert.equal(slides[7].target.body[1].status, 'english-hold',
      `${lang} slide 8 keeps crop choice and harvest timing advice in English`);
    assert.equal(slides[17].target.body[2].status, 'english-hold',
      `${lang} slide 18 keeps specialist disease and technical advice in English`);
    assert.equal(slides[18].target.body[3].status, 'english-hold',
      `${lang} slide 19 keeps the crop-return conclusion in English`);
    for (const part of slides[19].target.body.slice(1)) {
      assert.equal(part.status, 'english-hold', `${lang} slide 20 keeps financial and seed-swap decisions in English`);
    }
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

test('Seeds regional drafts pair the English source and hold technical seed-selection claims', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/seeds-sovereignty.en.md', 'utf8'));
  for (const language of ['st', 've', 'ts']) {
    const packet = JSON.parse(readFileSync(
      `docs/narration-reviews/seeds-sovereignty.${language}.paired.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.ok(slides.slice(0, 3).every((slide: any) =>
      slide.target.heading.status === 'draft' && slide.target.body.every((part: any) => part.status === 'draft')),
    `${language}: the packet's first three study slides carry the supplied learner drafts`);
    // Ordinary prompts can now be translated after the opening slides. Keep the F1 comparison,
    // seed-parent selection and pollination instructions in exact English until their conditions
    // have been checked: a reversal here could lead a learner to save the wrong seed.
    for (const [slideNumber, bodyIndexes] of [
      [5, [2, 3, 5]],
      [8, [4, 5, 7]],
      [9, [0, 1, 2, 4, 5]],
    ] as const) {
      const slide = slides[slideNumber - 1];
      for (const bodyIndex of bodyIndexes) {
        assert.equal(slide.target.body[bodyIndex].status, 'english-hold',
          `${language} slide ${slideNumber} paragraph ${bodyIndex + 1}: technical condition stays English`);
      }
    }
    if (language === 've') {
      assert.equal(slides[7].target.body[6].status, 'english-hold',
        'Tshivenda seed-parent rejection remains English after an ambiguous draft reversed its meaning');
    }
    const communityFields: Record<string, readonly (readonly [number, number])[]> = {
      st: [[6, 2], [6, 4], [7, 2]],
      ve: [[7, 2]],
      ts: [[6, 4], [7, 2]],
    };
    for (const [slideNumber, bodyIndex] of communityFields[language]) {
      const slide = slides[slideNumber - 1];
      const paragraph = slide.target.body[bodyIndex];
      assert.equal(paragraph.status, 'draft',
        `${language} slide ${slideNumber}: household and sharing context must remain visibly marked`);
      assert.ok(paragraph.text && paragraph.text !== slide.english.body[bodyIndex]);
      assert.match(paragraph.provenance ?? '', /unreviewed-machine-draft/);
    }
    assert.match(slides[6].target.body[2].text, /\(varieties\)/,
      `${language}: the seed-variety meaning must remain explicit beside the regional draft`);
    if (language === 'ts') {
      assert.match(slides[5].target.body[4].text, /\(crop\)/,
        'the Xitsonga word for plant must be disambiguated as a crop');
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


test('Sesotho Plant Guilds learner draft keeps exact source pairing, labeled field holds and all 51 rendered slides', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/plant-guilds.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/plant-guilds.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  assert.equal(packet.reviewStatus, 'unreviewed');
  assert.equal(slides.length, 51);
  assert.deepEqual(slides.filter((slide: any) => slide.target.heading.status === 'draft')
    .map((slide: any) => slide.n), [1, 2, 3, 4, 5, 6, 7, 8, 33, 34, 37, 38, 46, 47, 48, 49]);

  const draftedBodySlides = slides.filter((slide: any) => slide.target.body.some((part: any) => part.status === 'draft'))
    .map((slide: any) => slide.n);
  assert.deepEqual(draftedBodySlides, [1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 20, 22, 24, 27, 33, 34, 36, 38, 42, 46, 48, 49]);
  assert.equal(slides.flatMap((slide: any) => slide.target.body).filter((part: any) => part.status === 'draft').length, 22);
  assert.equal(slides.flatMap((slide: any) => slide.target.body)
    .filter((part: any) => part.status === 'draft' && part.text.includes('ENGLISH HOLD —')).length, 12,
  'legacy Sesotho and English paragraphs explicitly mark every held sentence for facilitator review');
  assert.equal(slides.flatMap((slide: any) => slide.target.body)
    .filter((part: any) => part.status === 'english-hold').length, 28,
  'uncertain field guidance stays fully in English instead of being presented as Sesotho');

  for (const slide of slides) {
    const image = `public/course-decks/plant-guilds/st/slide-${String(slide.n).padStart(2, '0')}.webp`;
    assert.ok(existsSync(image), `published paired learner slide ${slide.n} has its rendered image`);
  }

  const slide4 = slides[3].target.body[0].text;
  assert.ok(slide4.includes('ENGLISH HOLD — Check sunlight, drainage, soil condition and water availability.'));
  assert.ok(slide4.includes('Nitrojene ke e nngwe feela ya dintho tse ka nnang tsa thibela kgolo.'));
  const slide8 = slides[7].target.body[0].text;
  assert.ok(slide8.includes('ENGLISH HOLD — Find nodules on a spare legume plant.'));
  assert.ok(slide8.includes('ENGLISH HOLD — Nodulation and growth depend on the plant, suitable bacteria and growing conditions.'));
  const slide34 = slides[33].target.body[0].text;
  assert.ok(slide34.includes('ENGLISH HOLD — Many ladybirds eat aphids; some parasitoid wasps attack crop pests.'));
  assert.ok(slide34.includes('Ha e le hantle kokonyana ena e etsa eng?'));
  assert.ok(slides[48].target.body[0].text.includes('ENGLISH HOLD — Write down what will trigger pruning or thinning.'));
  assert.equal(slides[45].target.heading.text, 'Etsa qeto ka seo o se bonang');
  assert.equal(slides[45].target.body[0].text,
    'Boloka rekoto e kgutshwane ya kamoo sehlopha sa dimela tse tshehetsanang (guild) se sebetsang kateng.');
  assert.equal(slides[46].target.heading.text, 'Etsa qeto ka seo o se bonang');
  assert.equal(slides[46].target.body[0].status, 'mixed');
  assert.equal(slides[46].target.body[0].segments.map((segment: any) => segment.sourceEnglish).join(''),
    slides[46].english.body[0], 'the field observations remain exact-English and source-paired');
  assert.equal(slides[46].target.body[0].segments[1].text,
    'Ke bopaki bofe bo ka etsang hore o fetole sehlopha sena sa dimela tse tshehetsanang (guild)?');
});

test('Tshivenda and Xitsonga Plant Guilds localise only observation prompts in silent paired decks', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/plant-guilds.en.md', 'utf8'));
  const headingDrafts = {
    ve: 'Ni tendele zwe na zwi vhona zwi ni thuse u dzhia phetho.',
    ts: 'Leswi u swi vonaka a swi ku pfuna ku endla xiboho.',
  };
  const recordDrafts = {
    ve: null,
    ts: 'Tsala rhekhodo yo koma ya ndlela leyi guild yi tirhaka ha yona.',
  };
  const questionDrafts = {
    ve: 'Ndi vhuṱanzi vhufhio vhune ha nga ita uri ni shandule guild?',
    ts: 'Hi vumbhoni byihi byi nga ku endla u cinca guild?',
  };
  for (const language of ['ve', 'ts'] as const) {
    const packet = JSON.parse(readFileSync(`docs/narration/plant-guilds.${language}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, language);
    assert.equal(packet.reviewStatus, 'unreviewed');
    assert.equal(slides.length, 51);
    assert.deepEqual(slides.filter((slide: any) => slide.target.heading.status === 'draft')
      .map((slide: any) => slide.n), [46, 47], `${language} only localises observation headings`);
    assert.equal(slides[45].target.heading.text, headingDrafts[language]);
    assert.equal(slides[46].target.heading.text, headingDrafts[language]);
    if (recordDrafts[language]) {
      assert.equal(slides[45].target.body[0].status, 'draft');
      assert.equal(slides[45].target.body[0].text, recordDrafts[language]);
    } else {
      assert.deepEqual(slides[45].target.body, [{ status: 'english-hold' }],
        'Tshivenda keeps the record-over-time instruction exact English until its wording is clear');
    }
    assert.equal(slides[46].target.body[0].status, 'mixed');
    assert.equal(slides[46].target.body[0].segments.map((segment: any) => segment.sourceEnglish).join(''),
      slides[46].english.body[0], `${language} preserves exact source for all held observations`);
    assert.equal(slides[46].target.body[0].segments[1].sourceEnglish,
      'What evidence would make you change the guild?');
    assert.equal(slides[46].target.body[0].segments[1].text, questionDrafts[language]);
    for (const slide of slides.filter((item: any) => item.n !== 46 && item.n !== 47)) {
      assert.equal(slide.target.heading.status, 'english-hold', `${language} slide ${slide.n} heading stays English`);
      assert.ok(slide.target.body.every((part: any) => part.status === 'english-hold'),
        `${language} slide ${slide.n} body stays English`);
    }
    assert.equal(slides[26].english.body[0], 'Watch the branch fall onto the cut leaves.');
    assert.deepEqual(slides[26].target.body, [{ status: 'english-hold' }]);
    for (const slide of slides) {
      assert.ok(slide.target.body.every((part: any) => ['draft', 'mixed', 'english-hold'].includes(part.status)),
        `${language} slide ${slide.n} has an explicit draft or hold marker`);
      assert.ok(existsSync(`public/course-decks/plant-guilds/${language}/slide-${String(slide.n).padStart(2, '0')}.webp`),
        `${language} silent slide ${slide.n} exists for Study and offline use`);
    }
  }
});
