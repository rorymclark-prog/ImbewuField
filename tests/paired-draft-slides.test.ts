import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishSlideRecords, pairedDraftLanguageLabel, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
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

test('Food Forest Xitsonga slides keep only the recorded concept sentences as drafts', () => {
  const foodForestSource = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, foodForestSource, 'ts');
  assert.equal(packet.reviewStatus, 'unreviewed');
  assert.equal(slides.length, 20);
  const drafts = slides.flatMap((slide: any) => [
    ...(slide.target.heading.status === 'draft' ? [`${slide.n}:heading`] : []),
    ...slide.target.body.flatMap((part: any, index: number) =>
      part.status === 'draft' ? [`${slide.n}:body-${index + 1}`] : []),
  ]);
  assert.deepEqual(drafts, ['4:body-1', '4:body-2', '8:body-2']);
  assert.ok(slides.every((slide: any) => slide.target.heading.status === 'english-hold'),
    'titles remain exact English while their Xitsonga terminology awaits review');
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
    assert.deepEqual(drafted, lang === 've'
      ? ['1:1', '1:4', '2:2', '3:1', '4:1', '5:1', '6:1', '9:1', '9:2', '9:3', '14:1', '16:4', '18:4', '20:4']
      : ['1:1', '1:4', '2:2', '3:1', '4:1', '5:1', '6:1', '9:3', '16:3', '16:4']);
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
        assert.ok(slides[n - 1].target.body.every((part: any) => part.status === 'english-hold'),
          `slide ${n}: ethics, technical, farming, safety or field-action text stays in exact English`);
      }
      assert.ok(slides[8].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.ok(slides[15].target.body.slice(0, 2).every((part: any) => part.status === 'english-hold'));
      assert.equal(slides[8].target.body[2].status, 'draft');
      assert.deepEqual(slides[15].target.body.slice(2).map((part: any) => part.status), ['draft', 'draft']);
    }
    for (const p of [0, 2, 3]) assert.equal(slides[1].target.body[p].status, 'english-hold',
      `slide 2 ${lang}: the spade, land-work contrast and work question need a local check`);
    for (const part of slides[2].target.body.slice(1)) assert.equal(part.status, 'english-hold',
      `slide 3 ${lang}: ethics, principles, zones and sectors must remain English`);
    for (const n of [4, 5, 6]) {
      assert.ok(slides[n - 1].target.body.slice(1).every((part: any) => part.status === 'english-hold'),
        `slide ${n} ${lang}: examples, care advice and reflection questions must remain English`);
    }
    for (const n of [7, 8]) {
      assert.ok(slides[n - 1].target.body.every((part: any) => part.status === 'english-hold'),
        `slide ${n} ${lang}: work, zones, water and permission claims must remain English`);
    }
    if (lang === 've') {
      const permittedReflectiveDrafts: Record<number, number[]> = { 16: [3], 18: [3], 20: [3] };
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

test('Food Forest Xitsonga media keeps every unreviewed sentence paired with its current English narration', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((paragraph: any, index: number) => paragraph.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  assert.deepEqual(drafted, ['4:1', '4:2', '8:2']);
});

test('Food Forest Sesotho narration only drafts the three existing low-risk L1 body sentences', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((paragraph: any, index: number) => paragraph.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  assert.deepEqual(drafted, ['4:1', '4:2', '8:2']);
  assert.deepEqual(slides.flatMap((slide: any) => slide.target.heading.status), Array(20).fill('english-hold'));
  assert.deepEqual([
    slides[3].target.body[0].text,
    slides[3].target.body[1].text,
    slides[7].target.body[1].text,
  ], [
    'Moru wa tlhaho o tlatsa sebaka ho tloha makaleng a hodimo ho isa metsong.',
    'Dimela tse fapaneng di sebedisa kganya le mongobo tse fumanehang boemong ba tsona.',
    'Ha dimela di ntse di hola, moriti le masalla a makgasi di fetola maemo a ka tlase ho tsona.',
  ]);
  const lessonBody = SESOTHO_FOOD_FOREST_DRAFT.lessons[0].body;
  const lessonEnglish = lessonBody.sourceEnglish.split('\n\n');
  const lessonSesotho = lessonBody.sesothoDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 1, 1], [7, 1, 11]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], lessonEnglish[lessonParagraph],
      `slide ${slideIndex + 1} must use the exact lesson source sentence`);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, lessonSesotho[lessonParagraph],
      `slide ${slideIndex + 1} must reuse the existing Sesotho draft sentence`);
  }
  assert.ok(slides.every((slide: any) => slide.target.body.every((part: any) =>
    part.status === 'draft' || part.status === 'english-hold')));
});

test('Tshivenda Food Forest slides hold care, ground-cover and habitat claims in English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/food-forest.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/food-forest.ve.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 've');
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  assert.deepEqual(drafted, ['4:1', '4:3', '4:4', '6:1']);
  const lesson = TSHIVENDA_FOOD_FOREST_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.tshivendaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[3, 0, 0], [3, 2, 2], [3, 3, 3], [5, 0, 4]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assert.equal(slides[5].target.body[1].status, 'english-hold');
  assert.equal(slides[12].target.body[0].status, 'english-hold');
});

test('Vegetables slides pair only existing Xitsonga resilience concepts with exact English', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/vegetables-staples.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  const drafted = slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean));
  assert.deepEqual(drafted, ['13:6', '14:1', '14:2', '14:5']);
  const lesson = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.xitsongaDraft.split('\n\n');
  for (const [slideIndex, slideParagraph, lessonParagraph] of [[12, 5, 10], [13, 0, 11], [13, 1, 12], [13, 4, 15]]) {
    assert.equal(slides[slideIndex].english.body[slideParagraph], english[lessonParagraph]);
    assert.equal(slides[slideIndex].target.body[slideParagraph].text, translated[lessonParagraph]);
  }
  assert.equal(slides[13].target.body[2].status, 'english-hold');
  assert.equal(slides[13].target.body[3].status, 'english-hold');
});

test('Sesotho Market records slides reuse six exact existing learner draft sentences', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/market-community.st.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'st');
  const map = [[2, 1, 0], [2, 2, 1], [5, 1, 3], [5, 4, 6], [6, 1, 7], [6, 4, 10]];
  assert.deepEqual(slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean)), map.map(([n, p]) => `${n}:${p}`));
  const lesson = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons[0].body;
  const english = lesson.sourceEnglish.split('\n\n');
  const translated = lesson.sesothoDraft.split('\n\n');
  for (const [n, p, i] of map) {
    assert.equal(slides[n - 1].english.body[p - 1], english[i]);
    assert.equal(slides[n - 1].target.body[p - 1].text, translated[i]);
  }
  assert.equal(slides[1].target.body[2].status, 'english-hold');
  assert.equal(slides[4].target.body[1].status, 'english-hold');
});

test('Xitsonga Market media pairs only the two existing low-risk learner concepts', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/market-community.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/market-community.ts.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 'ts');
  const map = [[2, 1, 'market-community-l1', 0], [18, 1, 'market-community-l3', 9]] as const;
  assert.deepEqual(slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean)), ['2:1', '18:1']);
  for (const [n, p, lessonId, paragraphIndex] of map) {
    const body = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === lessonId)!.body;
    assert.equal(slides[n - 1].english.body[p - 1], body.sourceEnglish.split('\n\n')[paragraphIndex]);
    assert.equal(slides[n - 1].target.body[p - 1].text, body.xitsongaDraft.split('\n\n')[paragraphIndex]);
  }
  assert.equal(slides[17].target.body[1].status, 'english-hold');
});

test('Tshivenda staples media holds quantities and crop claims beside two existing concepts', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
  const packet = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const slides = validatePairedDraft(packet, source, 've');
  assert.deepEqual(slides.flatMap((slide: any) => slide.target.body
    .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
    .filter(Boolean)), ['12:1', '14:2']);
  const concepts = [TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.bodyConcept,
    TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept];
  for (const [n, p, concept] of [[12, 1, concepts[0]], [14, 2, concepts[1]]] as const) {
    assert.equal(slides[n - 1].english.body[p - 1], concept.sourceEnglish);
    assert.equal(slides[n - 1].target.body[p - 1].text, concept.tshivendaDraft);
  }
  assert.equal(slides[11].target.body[3].status, 'english-hold');
  assert.equal(slides[13].target.body[3].status, 'english-hold');
});

test('the next regional Study frames keep safety and business advice as exact English holds', () => {
  const cases = [
    { moduleId: 'vegetables-staples', lang: 'st', drafted: ['1:2', '2:1', '8:1', '8:4', '9:1'], held: ['8:2', '8:3', '8:5', '8:6'] },
    { moduleId: 'market-community', lang: 've', drafted: ['2:1', '2:2', '3:4'], held: ['1:1', '2:3', '18:1'] },
    { moduleId: 'soil-health', lang: 'ts', drafted: ['1:1', '2:1', '3:1', '5:1'], held: ['1:3', '4:1', '4:2', '5:2'] },
    { moduleId: 'soil-health', lang: 'st', drafted: ['1:1', '2:1', '5:1'], held: ['1:2', '1:3', '2:2', '3:3', '4:1', '5:2'] },
  ] as const;
  for (const { moduleId, lang, drafted, held } of cases) {
    const source = englishSlideRecords(readFileSync(`docs/narration/${moduleId}.en.md`, 'utf8'));
    const packet = JSON.parse(readFileSync(`docs/narration/${moduleId}.${lang}.paired-draft.json`, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    assert.deepEqual(slides.flatMap((slide: any) => slide.target.body
      .map((part: any, index: number) => part.status === 'draft' ? `${slide.n}:${index + 1}` : null)
      .filter(Boolean)), drafted, `${lang} ${moduleId} must show only reviewed draft fields`);
    for (const item of held) {
      const [n, p] = item.split(':').map(Number);
      assert.equal(slides[n - 1].target.body[p - 1].status, 'english-hold', `${lang} ${moduleId} ${item} keeps the exact source`);
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
    .map((slide: any) => slide.n), [1, 2, 3, 4, 5, 6, 7, 8, 33, 34, 37, 38, 48, 49]);

  const draftedBodySlides = slides.filter((slide: any) => slide.target.body.some((part: any) => part.status === 'draft'))
    .map((slide: any) => slide.n);
  assert.deepEqual(draftedBodySlides, [1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 20, 22, 24, 27, 33, 34, 36, 38, 42, 46, 47, 48, 49]);
  assert.equal(slides.flatMap((slide: any) => slide.target.body).filter((part: any) => part.status === 'draft').length, 23);
  assert.equal(slides.flatMap((slide: any) => slide.target.body)
    .filter((part: any) => part.status === 'draft' && part.text.includes('ENGLISH HOLD —')).length, 13,
  'mixed Sesotho and English paragraphs explicitly mark every held sentence for facilitator review');
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
});
