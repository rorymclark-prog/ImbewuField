import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import test from 'node:test';

import {
  COURSE_DECKS, animationUrls, deckAnimationBytes, deckFor, deckSlideCount, formatBytes,
  hasDeck, resolveDeckLang, silentDraftSlideImageFor, slideAudioUrl, slideImageFor, slideImageUrl,
} from '@/lib/course-deck';
import { isiZuluDeckReviewHold } from '@/lib/course-deck-review-holds';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_MODULES } from '@/lib/course-modules';
import { resolveLearnerLessonPresentation } from '@/lib/course-localization';
import { COURSE_TRANSCRIPTS } from '@/lib/course-transcripts';
import { ISIZULU_DECK_SOURCE_BINDINGS } from '@/lib/course-deck-source-bindings';
import { createIsiZuluSilentDeckDraftRegistry, resolveIsiZuluSilentDeckDraft } from '@/lib/course-deck-silent-drafts';
import { resolveIsiZuluSilentDeckDraft as resolveRegisteredSilentDeckDraft } from '@/lib/course-deck-silent-drafts-registry';
import { collectTranscripts } from '../scripts/gen-course-transcripts.mjs';

const readingFullDeckProof = JSON.parse(readFileSync(
  new URL('../docs/study-translation-reviews/READING-FULL-DECK-APPLIED-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8'));
const readingFullLearnerProof = JSON.parse(readFileSync(
  new URL('../docs/study-translation-reviews/READING-FULL-LEARNER-APPLIED-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8'));

function learnerProofField(lesson: any, field: string): { source: string; target: string } | null {
  if (field === 'body') return { source: lesson.body, target: lesson.body };
  const keyPoint = field.match(/^keyPoints\[(\d+)\]$/);
  if (keyPoint) return { source: lesson.keyPoints[Number(keyPoint[1])], target: lesson.keyPoints[Number(keyPoint[1])] };
  const quizField = field.match(/^quiz\[(\d+)\]\.(question|rationale|options\[(\d+)\])$/);
  if (!quizField) return null;
  const question = lesson.quiz[Number(quizField[1])];
  const selected = quizField[2] === 'question' ? question.q
    : quizField[2] === 'rationale' ? question.rationale
      : question.options[Number(quizField[3])];
  return { source: selected, target: selected };
}

const PUBLIC = new URL('../public/', import.meta.url);
const DECK_PLAYER_CSS_URL = new URL('../components/course/DeckPlayer.module.css', import.meta.url).href;
const DECK_PLAYER_CSS_STUB = "export default { controlStrip: 'controlStrip', playControl: 'playControl', backControl: 'backControl', nextControl: 'nextControl', progress: 'progress', slideStage: 'slideStage' };";
const onDisk = (url: string) => existsSync(new URL(url.replace(/^\//, ''), PUBLIC));

test('phone full-screen slide image stays below the lesson and exit controls', () => {
  const css = readFileSync(new URL(DECK_PLAYER_CSS_URL), 'utf8');
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  };
  const stage = rule('.expanded .slideStage');
  const controls = rule('.expanded .controlStrip');

  assert.match(stage, /z-index:\s*0\s*;/,
    'the full-viewport slide must form a lower stacking layer so it cannot intercept phone taps');
  assert.match(controls, /z-index:\s*5\s*;/, 'Play lesson remains above the slide');
  assert.match(css, /\.expanded \.playerHeader,[\s\S]*?\.expanded \.controlStrip\s*\{[^}]*z-index:\s*5\s*;/,
    'Exit full screen remains in the same higher layer as Play lesson');
});

test('sound-off learners get the complete current script, including its final instruction', () => {
  // A beautiful picture cannot replace words a learner cannot hear. This fails on a missing
  // paragraph, stale edit, shifted slide, or accidentally published draft-language transcript.
  assert.deepEqual(COURSE_TRANSCRIPTS, collectTranscripts());
  for (const [moduleId, narration] of Object.entries(COURSE_NARRATION)) {
    assert.deepEqual(Object.keys(COURSE_TRANSCRIPTS[moduleId]).sort(), [...narration.languages].sort());
    for (const lang of narration.languages) {
      for (const track of narration.tracks) {
        const paragraphs = COURSE_TRANSCRIPTS[moduleId][lang][track.slide];
        assert.ok(paragraphs.length > 0, `${moduleId}/${lang}/${track.slide} has no readable words`);
        assert.ok(paragraphs.every(p => !/\[pause\]|^---\s*$/m.test(p)), 'stage directions are not learner text');
      }
    }
  }
});

test('the deck is derived from the narration manifest, never typed out twice', () => {
  // Two hand-maintained lists of the same 24 rows is this codebase's most repeated defect, and here
  // the drift would be a slide showing one thing while the voice says another. Deriving means the
  // two cannot disagree, and this asserts the derivation rather than the current values.
  const deck = deckFor('seeds-sovereignty');
  assert.ok(deck);
  const tracks = COURSE_NARRATION['seeds-sovereignty'].tracks;

  assert.equal(deck.slides.length, tracks.length);
  assert.deepEqual(deck.slides.map((s) => s.slide), tracks.map((t) => t.slide));
  assert.deepEqual(deck.slides.map((s) => s.title), tracks.map((t) => t.title));
  assert.deepEqual(deck.slides.map((s) => s.lesson), tracks.map((t) => t.lesson));
});

test('every promised slide image exists on disk', () => {
  // The other direction of the same rule tests/course-audio.test.ts enforces for narration: a
  // promised file that is missing is a broken image on a farmer's phone, and they have already
  // paid for the page load by the time they find out.
  const deck = deckFor('seeds-sovereignty')!;
  for (const lang of deck.slideLanguages) {
    const known = deck.missingSlides?.[lang] ?? [];
    for (const s of deck.slides) {
      const url = slideImageUrl('seeds-sovereignty', lang, s.slide);
      if (known.includes(s.slide)) {
        // A slide DECLARED missing must return nothing, so slideImageFor falls back rather than
        // emitting a url to a file that is not there. Declared-and-absent is a known state;
        // undeclared-and-absent is the broken image this test exists to catch.
        assert.equal(url, null, `${lang} slide ${s.slide} is declared missing but produced a url`);
        continue;
      }
      assert.ok(url, `no url for ${lang} slide ${s.slide}`);
      assert.ok(onDisk(url!), `missing file: ${url}`);
    }
  }
});

test('regional Reading the Landscape decks expose all 21 paired WebPs with English source audio', () => {
  const deck = deckFor('reading-landscape')!;
  assert.deepEqual(deck.slideLanguages, ['en', 'zu', 'st', 've', 'ts']);
  assert.equal(COURSE_NARRATION['reading-landscape'].languages.includes('en'), true);
  assert.equal(COURSE_NARRATION['reading-landscape'].languages.includes('st'), false);
  assert.equal(COURSE_NARRATION['reading-landscape'].languages.includes('ve'), false);
  assert.equal(COURSE_NARRATION['reading-landscape'].languages.includes('ts'), false);

  for (const lang of ['st', 've', 'ts']) {
    assert.equal(deck.slideFormatsByLanguage?.[lang], 'webp');
    for (let slide = 1; slide <= 21; slide++) {
      const url = slideImageFor('reading-landscape', lang, slide);
      assert.ok(url?.exact, `${lang} slide ${slide} must stay on its paired regional still`);
      assert.ok(url.url.endsWith('.webp'), `${lang} slide ${slide} should use the supplied WebP`);
      assert.ok(onDisk(url.url), `missing offline still: ${url.url}`);
    }
  }
});

test('silent Small Livestock review decks keep every paired frame visible and claim no regional voice', () => {
  const deck = deckFor('small-livestock')!;
  for (const lang of ['st', 've', 'ts']) {
    assert.ok(deck.slideLanguages.includes(lang));
    assert.equal(deck.slideFormatsByLanguage?.[lang], 'webp');
    assert.equal(COURSE_NARRATION['small-livestock'].languages.includes(lang), false);
    for (let slide = 1; slide <= 20; slide++) {
      const selected = slideImageFor('small-livestock', lang, slide);
      assert.ok(selected?.exact, `${lang} slide ${slide} must show its source-paired still`);
      assert.ok(onDisk(selected.url), `${lang} slide ${slide} must be downloadable offline`);
    }
    for (const slide of [4, 7, 9]) {
      assert.equal(animationUrls('small-livestock', slide, lang), null,
        'an English animation poster would hide the source-paired review text');
    }
  }
});

test('Market regional seed-sharing stills remain readable instead of opening the English film poster', () => {
  for (const language of ['st', 've', 'ts']) {
    const still = slideImageFor('market-community', language, 15);
    assert.ok(still?.exact);
    assert.equal(still.url, `/course-decks/market-community/${language}/slide-15.webp`);
    assert.ok(onDisk(still.url));
    assert.equal(animationUrls('market-community', 15, language), null,
      'an animation poster would hide the unreviewed draft and exact English source in the player and zoom');
  }
  for (const language of ['en', 'zu']) {
    assert.ok(animationUrls('market-community', 15, language), 'existing source-language film remains available');
  }
});

test('Water Harvesting regional review decks register all 24 silent paired frames and only English narration', () => {
  const deck = deckFor('water-harvesting')!;
  assert.deepEqual(deck.slideLanguages, ['en', 'zu', 'st', 've', 'ts']);
  for (const lang of ['st', 've', 'ts']) {
    assert.equal(deck.slideFormatsByLanguage?.[lang], 'webp');
    assert.equal(deck.slideAspectRatioByLanguage?.[lang], 1440 / 5400);
    assert.equal(COURSE_NARRATION['water-harvesting'].languages.includes(lang), false,
      `${lang} paired stills must not imply a regional recording`);
    for (let slide = 1; slide <= 24; slide++) {
      const selected = slideImageFor('water-harvesting', lang, slide);
      assert.ok(selected?.exact, `${lang} slide ${slide} must stay on its paired review frame`);
      assert.ok(selected.url.endsWith('.webp'));
      assert.ok(onDisk(selected.url), `missing silent review frame: ${selected.url}`);
    }
    assert.equal(animationUrls('water-harvesting', 14, lang), null,
      'the English animation poster must not cover the paired review text');
  }
  assert.equal(COURSE_NARRATION['water-harvesting'].languages.includes('en'), true,
    'English source narration remains available as an explicit choice');
});

test('Sesotho, Tshivenda and Xitsonga Plant Guilds expose paired stills without claiming regional voices', () => {
  const deck = deckFor('plant-guilds')!;
  for (const language of ['st', 've', 'ts']) {
    assert.ok(deck.slideLanguages.includes(language));
    assert.equal(COURSE_NARRATION['plant-guilds'].languages.includes(language), false,
      `${language} still has no claimed regional voice`);
    for (let slide = 1; slide <= 51; slide++) {
      const selected = slideImageFor('plant-guilds', language, slide);
      assert.ok(selected?.exact, `slide ${slide} should keep its source-paired ${language} frame`);
      assert.ok(selected.url.endsWith('.webp'));
      assert.ok(onDisk(selected.url), `offline frame missing: ${selected.url}`);
    }
  }
});

test('a declared-missing slide is really absent, and nothing else is', () => {
  // Guards the manifest against drifting from the folder in either direction: a slide declared
  // missing that later gets exported would stay hidden behind an English fallback forever, and a
  // slide quietly deleted from the folder would 404 on a farmer's phone.
  const deck = deckFor('seeds-sovereignty')!;
  for (const lang of deck.slideLanguages) {
    const declared = new Set(deck.missingSlides?.[lang] ?? []);
    const format = deck.slideFormatsByLanguage?.[lang] ?? 'jpg';
    for (const s of deck.slides) {
      const path = `/course-decks/seeds-sovereignty/${lang}/slide-${String(s.slide).padStart(2, '0')}.${format}`;
      assert.equal(
        onDisk(path), !declared.has(s.slide),
        declared.has(s.slide)
          ? `${lang} slide ${s.slide} is declared missing but the file now exists — remove it from missingSlides`
          : `${lang} slide ${s.slide} is missing from disk and not declared`,
      );
    }
  }
});

test('every animation and its poster exist, and the poster is the cheap one', () => {
  const deck = deckFor('seeds-sovereignty')!;
  const withAnim = deck.slides.filter((s) => s.animation);
  assert.equal(withAnim.length, 8, 'six deck animations plus the two Gemini clips');

  for (const s of withAnim) {
    const a = animationUrls('seeds-sovereignty', s.slide)!;
    assert.ok(onDisk(a.video), `missing clip: ${a.video}`);
    assert.ok(onDisk(a.poster), `missing poster: ${a.poster}`);
    assert.ok(a.bytes > 0 && a.seconds > 0, 'the play button prints both, so both must be real');
  }
});

test('a slide with no animation offers none — the still is the lesson', () => {
  assert.equal(animationUrls('seeds-sovereignty', 1), null);
  assert.equal(animationUrls('seeds-sovereignty', 2), null);
  assert.ok(animationUrls('seeds-sovereignty', 5));
});

test('regional paired frames stay visible while English and isiZulu keep their registered films', () => {
  const cases: Array<{
    moduleId: string;
    slide: number;
    newlySuppressed: string[];
    englishPoster: string;
    zuluPoster: string | null;
  }> = [
    {
      moduleId: 'food-forest', slide: 16, newlySuppressed: ['ve', 'ts'],
      englishPoster: '/course-animations/food-forest/posters/flow-sheet-mulching-closeup.jpg',
      zuluPoster: '/course-animations/food-forest/posters/flow-sheet-mulching-closeup.jpg',
    },
    {
      moduleId: 'vegetables-staples', slide: 6, newlySuppressed: ['ve', 'ts'],
      englishPoster: '/course-animations/vegetables-staples/posters/flow-transplant-root-plug.jpg',
      zuluPoster: '/course-animations/vegetables-staples/posters/flow-transplant-root-plug.jpg',
    },
    {
      moduleId: 'soil-health', slide: 10, newlySuppressed: ['ve', 'ts'],
      englishPoster: '/course-animations/soil-health/posters/flow-build-compost-heap.jpg',
      zuluPoster: null,
    },
    {
      moduleId: 'soil-health', slide: 11, newlySuppressed: ['ve', 'ts'],
      englishPoster: '/course-animations/soil-health/posters/flow-compost-materials.jpg',
      zuluPoster: null,
    },
    {
      moduleId: 'reading-landscape', slide: 6, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/reading-landscape/posters/flow-a-frame.jpg',
      zuluPoster: '/course-animations/reading-landscape/posters/flow-a-frame.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 15, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-03-Pigeon-pea-food.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-03-Pigeon-pea-food-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 23, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-09-Labelled.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-09-Labelled-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 27, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-02-Pruning-trimmed.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-02-Pruning-trimmed-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 29, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-01-Mulch-ring.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-01-Mulch-ring-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 33, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-04-Helpful-insects.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-04-Helpful-insects-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 37, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-05-Guild-overview.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-05-Guild-overview-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 41, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-06-Succession-establish.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-06-Succession-establish-zu.jpg',
    },
    {
      moduleId: 'plant-guilds', slide: 45, newlySuppressed: ['st', 've', 'ts'],
      englishPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-08-Succession-carry-mulch.jpg',
      zuluPoster: '/course-animations/plant-guilds/posters/Imbewu-Guilds-08-Succession-carry-mulch-zu.jpg',
    },
  ];
  assert.equal(cases.reduce((count, item) => count + item.newlySuppressed.length, 0), 35,
    'the reviewed change covers only the 35 registered regional poster overlaps');

  for (const item of cases) {
    const deckSlide = deckFor(item.moduleId)?.slides.find((slide) => slide.slide === item.slide);
    assert.ok(deckSlide, `${item.moduleId} slide ${item.slide} remains registered`);

    for (const lang of ['st', 've', 'ts']) {
      const imageUrl = slideImageUrl(item.moduleId, lang, item.slide);
      assert.equal(imageUrl, `/course-decks/${item.moduleId}/${lang}/slide-${String(item.slide).padStart(2, '0')}.webp`);
      assert.ok(onDisk(imageUrl!), `paired ${lang} still exists for ${item.moduleId} slide ${item.slide}`);
      assert.equal(animationUrls(item.moduleId, item.slide, lang), null,
        `${lang} must see its source-paired still instead of the film poster`);
      assert.equal(slideAudioUrl(item.moduleId, lang, item.slide), null,
        `${lang} has no own narration track for ${item.moduleId} slide ${item.slide}`);

      const pairedPath = new URL(`../docs/narration/${item.moduleId}.${lang}.paired-draft.json`, import.meta.url);
      assert.ok(existsSync(pairedPath), `missing paired source record: ${pairedPath.pathname}`);
      const paired = JSON.parse(readFileSync(pairedPath, 'utf8')) as {
        language: string;
        reviewStatus: string;
        slides: Array<{
          n: number;
          english: { n?: number; heading: string; body: string[] };
          target: {
            heading: { status: string; text?: string; segments?: Array<{ sourceEnglish: string; status: string; text?: string }> };
            body: Array<{ status: string; text?: string; segments?: Array<{ sourceEnglish: string; status: string; text?: string }> }>;
          };
        }>;
      };
      assert.equal(paired.language, lang);
      assert.equal(paired.reviewStatus, 'unreviewed');
      const sourcePair = paired.slides.find((slide) => slide.n === item.slide);
      assert.ok(sourcePair, `${lang} source pair exists for ${item.moduleId} slide ${item.slide}`);
      if (sourcePair.english.n !== undefined) assert.equal(sourcePair.english.n, item.slide);
      assert.equal(sourcePair.english.heading, deckSlide.title,
        'the paired source remains bound to the narration slide title');
      assert.ok(sourcePair.english.body.length > 0 && sourcePair.english.body.every((line) => line.trim()));
      assert.equal(sourcePair.target.body.length, sourcePair.english.body.length,
        'the displayed draft/hold lines stay aligned with the complete English source');
      for (const [partIndex, part] of [sourcePair.target.heading, ...sourcePair.target.body].entries()) {
        assert.ok(['draft', 'english-hold', 'mixed'].includes(part.status),
          'regional text keeps its visible unreviewed draft or English-hold status');
        if (part.status === 'draft') assert.ok(part.text?.trim(), 'draft text must be present');
        if (part.status === 'mixed') {
          assert.ok(partIndex > 0, 'a heading cannot contain mixed body segments');
          const sourceText: string = sourcePair.english.body[partIndex - 1];
          assert.ok(part.segments && part.segments.length > 1, 'mixed text retains draft/hold boundaries');
          assert.equal(part.segments.map(segment => segment.sourceEnglish).join(''), sourceText,
            'mixed draft and holds still cover the exact displayed source in order');
          for (const segment of part.segments) {
            assert.ok(['draft', 'english-hold'].includes(segment.status));
            if (segment.status === 'draft') assert.ok(segment.text?.trim());
            else assert.equal(segment.text, undefined, 'held wording renders directly from its English source');
          }
        }
      }
    }

    const english = animationUrls(item.moduleId, item.slide, 'en');
    assert.equal(english?.poster, item.englishPoster,
      'English retains its registered film and poster');
    assert.ok(onDisk(item.englishPoster));
    const zulu = animationUrls(item.moduleId, item.slide, 'zu');
    if (item.zuluPoster) {
      assert.equal(zulu?.poster, item.zuluPoster,
        'isiZulu retains its existing film, including a labelled variant where registered');
      assert.ok(onDisk(item.zuluPoster));
    } else {
      assert.equal(zulu, null, 'pre-existing isiZulu unavailability stays in force');
    }
  }
});

test('regional poster holds preserve the established Market film split and Introduction narration', () => {
  for (const lang of ['st', 've', 'ts']) {
    assert.equal(animationUrls('market-community', 15, lang), null,
      'the existing Market paired-card protection remains in force');
  }
  for (const lang of ['en', 'zu']) {
    assert.equal(animationUrls('market-community', 15, lang)?.poster,
      '/course-animations/market-community/posters/flow-seed-sharing.jpg');
  }

  const introTracks = COURSE_NARRATION['intro-permaculture']!.tracks;
  assert.equal(introTracks.length, 22);
  for (const track of introTracks) {
    assert.ok(slideAudioUrl('intro-permaculture', 'st', track.slide),
      `Sesotho Introduction narration remains available on slide ${track.slide}`);
  }
});

test('food forest sheet mulching plays the reviewed Flow hand action once and holds its final layer order', () => {
  const clip = animationUrls('food-forest', 16);
  assert.ok(clip);
  assert.equal(clip.video, '/course-animations/food-forest/flow-sheet-mulching-closeup.mp4');
  assert.equal(clip.poster, '/course-animations/food-forest/posters/flow-sheet-mulching-closeup.jpg');
  assert.equal(clip.seconds, 8);
  assert.equal(clip.playOnce, true);
});

test('vegetable lesson 1 offers the reviewed Flow transplant and holds its planted end state', () => {
  const slides = deckFor('vegetables-staples')!.slides.filter(s => s.lesson === 'vegetables-staples-l1');
  assert.deepEqual(slides.map(s => s.slide), [4, 5, 6, 7]);
  const clip = animationUrls('vegetables-staples', 6);
  assert.ok(clip);
  assert.equal(clip.video, '/course-animations/vegetables-staples/flow-transplant-root-plug.mp4');
  assert.equal(clip.poster, '/course-animations/vegetables-staples/posters/flow-transplant-root-plug.jpg');
  assert.equal(clip.seconds, 8);
  assert.equal(clip.playOnce, true);
  assert.equal(animationUrls('vegetables-staples', 6, 'st'), null,
    'the English poster must not cover the paired Sesotho slide and its exact English source');
});

test('vegetable pest lesson keeps its still while the unapproved decision animation stays out of the player', () => {
  const slides = deckFor('vegetables-staples')!.slides.filter(s => s.lesson === 'vegetables-staples-l4');
  assert.deepEqual(slides.map(s => s.slide), [15, 16]);
  assert.equal(animationUrls('vegetables-staples', 16), null);
});

test('study clips held for visual or farming-safety review stay behind stills', () => {
  const held: Array<[string, number]> = [
    // The L1 swale and overflow clips imply site outcomes their pictures cannot verify.
    ['water-harvesting', 4], ['water-harvesting', 7], ['water-harvesting', 9], ['water-harvesting', 12], ['water-harvesting', 16], ['water-harvesting', 21],
    ['intro-permaculture', 7], ['intro-permaculture', 13], ['intro-permaculture', 19],
    ['reading-landscape', 5], ['reading-landscape', 9], ['reading-landscape', 13], ['reading-landscape', 17],
    ['soil-health', 5], ['soil-health', 14],
    ['food-forest', 5], ['food-forest', 10], ['food-forest', 15],
    ['small-livestock', 14],
    ['market-community', 4], ['market-community', 9], ['market-community', 14],
  ];
  for (const [moduleId, slide] of held) {
    assert.equal(animationUrls(moduleId, slide), null, `${moduleId} slide ${slide} must use its still`);
    assert.ok(slideImageFor(moduleId, 'en', slide), `${moduleId} slide ${slide} must keep its still`);
  }

  const retained: Array<[string, number]> = [
    ['water-harvesting', 14],
    ['intro-permaculture', 4], ['reading-landscape', 6], ['soil-health', 11],
    ['food-forest', 16], ['small-livestock', 4], ['small-livestock', 7], ['small-livestock', 9],
    ['market-community', 15],
  ];
  for (const [moduleId, slide] of retained) {
    assert.ok(animationUrls(moduleId, slide), `${moduleId} slide ${slide} must retain its registered footage`);
  }
});

test('the bee lesson uses one technically checked Flow move between two blossoms and then holds', () => {
  const clip = animationUrls('small-livestock', 9);
  assert.ok(clip);
  assert.equal(clip.video, '/course-animations/small-livestock/flow-bee-between-blossoms.mp4');
  assert.equal(clip.poster, '/course-animations/small-livestock/posters/flow-bee-between-blossoms.jpg');
  assert.equal(clip.seconds, 8);
  assert.equal(clip.playOnce, true);
});

test('the compost lesson shows dry browns being placed over fresh greens and then holds', () => {
  const clip = animationUrls('soil-health', 10);
  assert.ok(clip);
  assert.equal(clip.video, '/course-animations/soil-health/flow-build-compost-heap.mp4');
  assert.equal(clip.poster, '/course-animations/soil-health/posters/flow-build-compost-heap.jpg');
  assert.equal(clip.bytes, 7619537);
  assert.equal(clip.seconds, 8);
  assert.equal(clip.playOnce, true);
});

test('Soil isiZulu uses localized stills instead of mismatched English Flow scenes', () => {
  for (const slide of [10, 11]) {
    assert.ok(animationUrls('soil-health', slide, 'en'), `English slide ${slide} keeps its existing clip`);
    assert.equal(animationUrls('soil-health', slide, 'zu'), null,
      `isiZulu slide ${slide} must use the localized still while its Flow scene is visually mismatched`);
    assert.deepEqual(slideImageFor('soil-health', 'zu', slide), {
      url: `/course-decks/soil-health/zu/slide-${String(slide).padStart(2, '0')}.jpg`,
      lang: 'zu', exact: true,
    });
  }
});

test('Sesotho Soil Health keeps every paired still visible and suppresses English compost posters', () => {
  for (let slide = 1; slide <= 20; slide++) {
    const selected = slideImageFor('soil-health', 'st', slide);
    assert.deepEqual(selected, {
      url: `/course-decks/soil-health/st/slide-${String(slide).padStart(2, '0')}.webp`,
      lang: 'st', exact: true,
    });
    assert.ok(onDisk(selected!.url), `paired Sesotho slide ${slide} must be present`);
  }
  for (const slide of [10, 11]) {
    assert.ok(animationUrls('soil-health', slide, 'en'), 'English learners keep the reviewed compost film');
    assert.equal(animationUrls('soil-health', slide, 'st'), null,
      'the English poster must not cover the Sesotho source-paired frame');
  }
  assert.equal(slideAudioUrl('soil-health', 'st', 1), null,
    'Sesotho stills remain silent until narration is reviewed');
  assert.ok(slideAudioUrl('soil-health', 'en', 1), 'English narration remains available by choice');
});

test('the isiZulu fallback is PER SLIDE, not per module', () => {
  // The isiZulu deck came back from PowerPoint as "Repaired" with 23 of its 24 slides — the repair
  // dropped slide 13, "Buka: Indlela Eyomile". Falling the whole module back to English because of
  // one missing slide would take a finished isiZulu lesson away from the person it was made for,
  // and would apologise 23 times for something true once.
  //
  // That slide has since been rebuilt, so Seeds no longer exercises the fallback. This test now
  // asserts the MECHANISM on a synthetic gap instead of on Seeds' history — otherwise filling the
  // gap would have quietly deleted the only coverage of per-slide fallback, right before the next
  // module arrives with a gap of its own.
  const zu5 = slideImageFor('seeds-sovereignty', 'zu', 5);
  assert.deepEqual(zu5, { url: '/course-decks/seeds-sovereignty/zu/slide-05.jpg', lang: 'zu', exact: true });

  const deck = deckFor('seeds-sovereignty')!;
  const saved = deck.missingSlides;
  try {
    deck.missingSlides = { zu: [13] };
    assert.deepEqual(
      slideImageFor('seeds-sovereignty', 'zu', 13),
      { url: '/course-decks/seeds-sovereignty/en/slide-13.jpg', lang: 'en', exact: false },
      'a declared gap must fall back to English for THAT slide',
    );
    // Every OTHER slide stays exact, or the note would appear where it does not belong.
    const inexact = deck.slides
      .map((s) => ({ n: s.slide, r: slideImageFor('seeds-sovereignty', 'zu', s.slide) }))
      .filter((x) => x.r && !x.r.exact)
      .map((x) => x.n);
    // A checked silent correction may display its own new still while narration stays held;
    // other held rows and the synthetic gap still use English until a correction is registered.
    const heldWithoutSilentDraft = deck.slides
      .filter(s => isiZuluDeckReviewHold('seeds-sovereignty', s.slide) &&
        !resolveRegisteredSilentDeckDraft('seeds-sovereignty', s.slide))
      .map(s => s.slide);
    assert.deepEqual(inexact, [...heldWithoutSilentDraft, 13].sort((a, b) => a - b),
      'only held rows without a checked still and the declared gap fall back');
  } finally {
    deck.missingSlides = saved;
  }

  // The source review now withholds specific faulty words even though every raw asset exists.
  const stillInexact = deck.slides
    .filter(s => !slideImageFor('seeds-sovereignty', 'zu', s.slide)?.exact)
    .map(s => s.slide);
  const heldWithoutSilentDraft = deck.slides
    .filter(s => isiZuluDeckReviewHold('seeds-sovereignty', s.slide) &&
      !resolveRegisteredSilentDeckDraft('seeds-sovereignty', s.slide))
    .map(s => s.slide);
  assert.deepEqual(stillInexact, heldWithoutSilentDraft,
    'without a synthetic gap, only held rows lacking their own checked visual correction fall back');

  // The new regional files are source-paired review frames, so selection must not fall back to
  // a bare English picture or let an animation poster obscure their comparison panels.
  for (const lang of ['st', 've', 'ts']) {
    assert.deepEqual(resolveDeckLang('seeds-sovereignty', lang), { lang, exact: true });
    for (const { slide } of deck.slides) {
      const still = slideImageFor('seeds-sovereignty', lang, slide);
      assert.equal(still?.lang, lang);
      assert.ok(still && onDisk(still.url), `${lang} slide ${slide} is missing`);
      assert.equal(animationUrls('seeds-sovereignty', slide, lang), null,
        `${lang} slide ${slide} must keep its paired source text visible`);
    }
  }

  // The narration is isiZulu on every slide, including the one whose picture is English.
  assert.equal(slideAudioUrl('seeds-sovereignty', 'zu', 13), '/course-audio/seeds-sovereignty/zu/slide-13.mp3');
});

test('a checked silent draft can supply a held isiZulu still while voice and animation stay unavailable', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS.find((row) => isiZuluDeckReviewHold(row.moduleId, row.slide));
  assert.ok(binding, 'fixture uses an actually audio-held isiZulu row');
  const registry = createIsiZuluSilentDeckDraftRegistry([{
    moduleId: binding.moduleId,
    slide: binding.slide,
    sourceHeading: binding.sourceHeading,
    sourceEnglish: [...binding.source],
    correctedTitle: 'Umbhalo ongakabuyekezwa',
    correctedTarget: ['Umusho olungisiwe ongakabuyekezwa.'],
    sourceHash: binding.sourceHash,
    targetHash: '1'.repeat(64),
    imageUrl: `/course-decks/${binding.moduleId}/zu-silent/slide-${String(binding.slide).padStart(2, '0')}.webp`,
    imageSha256: '2'.repeat(64),
    imageBytes: 12345,
    width: 1440,
    height: 5400,
    reviewStatus: 'unreviewed',
    audioBinding: 'none',
  }]);
  const draft = resolveIsiZuluSilentDeckDraft(registry, binding.moduleId, binding.slide);
  assert.ok(draft);
  assert.deepEqual(silentDraftSlideImageFor(binding.moduleId, 'zu', binding.slide,
    (moduleId, slide) => resolveIsiZuluSilentDeckDraft(registry, moduleId, slide)), {
    url: draft.imageUrl,
    lang: 'zu',
    exact: true,
    aspectRatio: 1440 / 5400,
  });
  assert.equal(slideAudioUrl(binding.moduleId, 'zu', binding.slide), null,
    'a replacement still does not make the superseded recording playable');
  assert.equal(animationUrls(binding.moduleId, binding.slide, 'zu'), null,
    'a poster or clip cannot hide the silent source-paired card');
});

test('unknown modules and slides produce no url rather than a broken one', () => {
  // Water now has a deck; absence is a lookup rule, not a permanent module status.
  assert.equal(hasDeck('no-such-module'), false);
  assert.equal(deckFor('no-such-module'), null);
  assert.equal(resolveDeckLang('no-such-module', 'en'), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'en', 99), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 99), null);
  // Slide 13 used to be asserted null here — the gap the PowerPoint repair left. It has been
  // rebuilt, so the honest assertion is now the opposite one.
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 13), '/course-decks/seeds-sovereignty/zu/slide-13.jpg');
});

test('slides partition by lesson exactly as the narration does', () => {
  const deck = deckFor('seeds-sovereignty')!;
  const counted = ['l1', 'l2', 'l3'].reduce((n, l) => n + deckSlideCount('seeds-sovereignty', `seeds-sovereignty-${l}`), 0);
  const moduleLevel = deck.slides.filter((s) => s.lesson === null).length;
  assert.equal(counted + moduleLevel, deck.slides.length, 'every slide is reachable from exactly one place');
  assert.equal(deckSlideCount('seeds-sovereignty'), deck.slides.length);
});

test('the data cost is stated honestly, because the farmer is paying it', () => {
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(64_000), '63 KB');
  assert.equal(formatBytes(2_306_000), '2.2 MB');

  // The module total must be reachable so a screen can warn before a "play all" rather than after.
  //
  // This used to pin the total inside a 10–12 MB window, which is a snapshot of a constant, not a
  // rule: it passed while the numbers were right, and then FAILED when the clips were legitimately
  // re-encoded from 10.9 MB down to 5.1 MB — flagging the improvement instead of a defect. It could
  // never have caught the thing that actually went wrong, which was the manifest disagreeing with
  // the files. So the rule is: the advertised total is the sum of the real files, and the ceiling
  // is the one that would genuinely hurt — the 101 MB of animated GIF that arrived once before.
  const total = deckAnimationBytes('seeds-sovereignty');
  const fromDisk = (COURSE_DECKS['seeds-sovereignty'].slides)
    .filter((s) => s.animation)
    .reduce((sum, s) => sum + statSync(new URL(`course-animations/seeds-sovereignty/${s.animation!.src}.mp4`, PUBLIC)).size, 0);
  assert.equal(total, fromDisk, 'the advertised total is not what the files actually weigh');
  assert.ok(total < 20_000_000, `a module's clips now total ${formatBytes(total)} — too much to offer a farmer`);
});

test('only modules that really have a deck advertise one', () => {
  assert.equal(hasDeck('seeds-sovereignty'), true);
  for (const id of Object.keys(COURSE_DECKS)) {
    assert.ok(COURSE_DECKS[id].slides.length > 0, `${id} is registered with no slides`);
    assert.ok(COURSE_DECKS[id].slideLanguages.length > 0, `${id} has no rendered language`);
  }
});

test('every registered deck can load its slides and clips at the advertised data cost', () => {
  // New modules must receive the same missing-file and byte checks as Seeds and Guilds.
  for (const [id, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of deck.slideLanguages) {
      for (const slide of deck.slides) {
        const picture = slideImageFor(id, lang, slide.slide);
        assert.ok(picture && onDisk(picture.url), `${id}/${lang}/${slide.slide}: missing slide`);
        const audio = slideAudioUrl(id, lang, slide.slide);
        if (audio) assert.ok(onDisk(audio), `missing narration: ${audio}`);
        const clip = animationUrls(id, slide.slide, lang);
        if (!clip) continue;
        assert.ok(onDisk(clip.video), `missing clip: ${clip.video}`);
        assert.ok(onDisk(clip.poster), `missing poster: ${clip.poster}`);
        assert.equal(statSync(new URL(clip.video.slice(1), PUBLIC)).size, clip.bytes);
        assert.ok(clip.seconds > 0);
      }
    }
  }
});

// The old guild recording had 20 tracks while the revised teaching deck had 51 frames.
// Check the actual files and teaching slots so a partial import cannot reach learners.
test('the guild deck has a real image and matching narration entry for every slide', () => {
  const deck = deckFor('plant-guilds');
  assert.ok(deck);
  const tracks = COURSE_NARRATION['plant-guilds'].tracks;
  assert.deepEqual(deck.slides.map(s => s.slide), tracks.map(t => t.slide));
  for (const s of deck.slides) {
    assert.ok(onDisk(slideImageUrl('plant-guilds', 'en', s.slide)!));
    assert.ok(onDisk(slideAudioUrl('plant-guilds', 'en', s.slide)!));
  }
  const clips = deck.slides.flatMap(s => s.animation ? [s.animation.src] : []);
  assert.equal(new Set(clips).size, clips.length, 'each illustration is used once');
  for (const s of deck.slides.filter(s => s.animation)) {
    const urls = animationUrls('plant-guilds', s.slide)!;
    assert.ok(onDisk(urls.video));
    assert.ok(onDisk(urls.poster));
    assert.equal(statSync(new URL(urls.video.slice(1), PUBLIC)).size, urls.bytes);
  }
});

test('whole-support thinning does not reuse branch pruning or an unapproved replacement', () => {
  const deck = deckFor('plant-guilds')!;
  const pruning = deck.slides.find(s => s.title === 'Chop-and-Drop for Light and Mulch' && s.animation);
  assert.ok(pruning?.animation?.src.includes('Pruning-trimmed'));
  const thinning = deck.slides.filter(s => s.title === 'Thin as the Fruit Tree Grows');
  assert.equal(thinning.length, 1);
  assert.equal(thinning[0].animation, undefined, 'keep the still until a whole-support Flow result passes review');
});

test('carried prunings play with the slide that describes carrying them, after the open-edge decision', () => {
  assert.equal(animationUrls('plant-guilds', 44), null);
  assert.match(animationUrls('plant-guilds', 45)!.video, /Succession-carry-mulch/);
});

test('isiZulu guild slides, audio and labelled video are delivered in the selected language', () => {
  for (const slide of deckFor('plant-guilds')!.slides) {
    assert.ok(onDisk(slideImageUrl('plant-guilds', 'zu', slide.slide)!));
    const held = isiZuluDeckReviewHold('plant-guilds', slide.slide);
    const audio = slideAudioUrl('plant-guilds', 'zu', slide.slide);
    if (held) assert.equal(audio, null, 'a known instruction error must not be spoken');
    else assert.ok(audio && onDisk(audio));
    assert.ok(onDisk(`/course-audio/plant-guilds/zu/slide-${String(slide.slide).padStart(2, '0')}.mp3`),
      'withholding playback preserves the recorded asset for later review');
    const animation = animationUrls('plant-guilds', slide.slide, 'zu');
    if (animation) {
      assert.ok(onDisk(animation.video));
      assert.ok(onDisk(animation.poster));
      assert.equal(statSync(new URL(animation.video.slice(1), PUBLIC)).size, animation.bytes);
    }
  }
  assert.match(animationUrls('plant-guilds', 23, 'zu')!.video, /Labelled-zu/);
  assert.doesNotMatch(animationUrls('plant-guilds', 23, 'en')!.video, /Labelled-zu/);
});

// Exercise the actual player with media-device stubs. The browser check separately verifies
// decoding and motion; these event-order checks catch a short voice cutting off a longer clip.
test('Water playback respects language gaps, download choice and the whole cleared animation', async t => {
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    // Node's focused component harness has no CSS-module loader. Styles do not affect these
    // media event-order assertions, so provide only the imported module's class-name shape here.
    if (url === DECK_PLAYER_CSS_URL) return { format: 'module', shortCircuit: true, source: DECK_PLAYER_CSS_STUB };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  for (const videoFirst of [false, true]) {
    const videoDevice = { ended: false, currentTime: 0, play: () => Promise.resolve() };
    const audioDevice = { currentTime: 0, pause() {}, play: () => Promise.resolve() };
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(DeckPlayer, { moduleId: 'water-harvesting', lang: 'zu' }), {
      createNodeMock: element => element.type === 'video' ? videoDevice : element.type === 'audio' ? audioDevice : null,
    }); });
    try {
      assert.match(view.root.findByType('audio').props.src, /water-harvesting\/zu\/slide-01.mp3$/);
      const messages = view.root.findAllByType('p').map(p => p.children.join('')).join(' ');
      assert.match(messages, /isiZulu narration is awaiting review by a fluent speaker/);
      assert.doesNotMatch(messages, /Narration is in English/);
      assert.doesNotMatch(messages, /isiZulu narration is not available/);
      for (let i = 0; i < 13; i++) act(() => view.root.findAllByType('button').find(b => b.children.join('') === 'Next ›')!.props.onClick());
      assert.equal(view.root.findByType('h3').children.join(''), 'Uphahla Lwakho Lungavuna Amanzi');
      assert.equal(view.root.findAllByType('video').length, 0, 'opening a Watch slide must not download video');
      const watch = view.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.join('').startsWith('Watch · ')))!;
      assert.ok(watch);
      act(() => watch.props.onClick());
      const clip = view.root.findByType('video');
      assert.match(clip.props.src, /flow-roof-rain\.mp4$/);
      // The player now fits the source clip numerically for full-screen sizing; use the
      // manifest's ratio so a future portrait clip is not forced into this video's frame.
      assert.equal(clip.parent!.props.style.aspectRatio, animationUrls('water-harvesting', 14)?.aspectRatio ?? 16 / 9);
      assert.equal(clip.props.loop, false, 'a selected animation must be able to finish under play-through');
      const title = view.root.findByType('h3').children.join('');
      if (videoFirst) {
        videoDevice.ended = true;
        act(() => clip.props.onEnded());
      } else {
        act(() => view.root.findByType('audio').props.onEnded());
      }
      assert.equal(view.root.findByType('h3').children.join(''), title, 'wait for both teaching streams');
      if (videoFirst) act(() => view.root.findByType('audio').props.onEnded());
      else { videoDevice.ended = true; act(() => clip.props.onEnded()); }
      assert.match(view.root.findByType('audio').props.src, /slide-15.mp3$/, 'advance exactly one slide once both finish');
    } finally { act(() => view.unmount()); }
  }
});

test('regional Introduction chooses every registered still and falls back only for declared gaps', () => {
  for (const lang of ['ve', 'ts']) {
    const deck = COURSE_DECKS['intro-permaculture'];
    assert.ok(deck.slideLanguages.includes(lang));
    assert.equal(deck.slideAspectRatioByLanguage?.[lang], 1440 / 5400);
    const declaredMissing = new Set(deck.missingSlides?.[lang] ?? []);
    for (const { slide } of deck.slides) {
      const own = slideImageUrl('intro-permaculture', lang, slide);
      const selected = slideImageFor('intro-permaculture', lang, slide);
      assert.ok(selected, `${lang} slide ${slide} must have either its frame or the English source`);
      if (declaredMissing.has(slide)) {
        assert.equal(own, null, `${lang} slide ${slide} is declared missing and must use its English source`);
        assert.equal(selected.lang, 'en');
        assert.equal(selected.exact, false);
        assert.ok(onDisk(selected.url));
      } else {
        assert.ok(own, `${lang} slide ${slide} has a regional frame in the manifest`);
        assert.equal(selected.lang, lang);
        assert.equal(selected.exact, true);
        assert.ok(onDisk(own!));
      }
    }
    assert.equal(animationUrls('intro-permaculture', 4, lang), null,
      'the old animation poster must not hide the paired ethics slide');
    assert.equal(COURSE_NARRATION['intro-permaculture'].languages.includes(lang), false,
      `${lang} stills must not promise an unreviewed narration track`);
  }
  // The Tshivenda concepts and exact-English holds each have their own paired frame.
  for (const slide of [7, 8, 9, 10, 11, 12, 13, 14]) {
    assert.ok(onDisk(slideImageUrl('intro-permaculture', 've', slide)!));
    assert.equal(slideImageFor('intro-permaculture', 've', slide)?.exact, true);
  }
  for (let slide = 15; slide <= 22; slide++) {
    assert.ok(onDisk(slideImageUrl('intro-permaculture', 've', slide)!));
    assert.equal(slideImageFor('intro-permaculture', 've', slide)?.exact, true);
  }
});

test('Sesotho draft narration starts with paired slides and English source choice keeps them', async () => {
  // A single language state used to switch both image and voice to English. With a real but
  // unreviewed Sesotho recording, the learner may listen to it or choose the English source;
  // neither choice may swap away the source-paired picture.
  const deck = COURSE_DECKS['intro-permaculture'];
  assert.ok(deck.slideLanguages.includes('st'));
  assert.equal(deck.slideAspectRatioByLanguage?.st, 1440 / 5400);
  for (let slide = 1; slide <= 22; slide++) assert.ok(onDisk(slideImageUrl('intro-permaculture', 'st', slide)!));
  assert.equal(animationUrls('intro-permaculture', 4, 'st'), null,
    'the English animation poster must not cover the paired Sesotho ethics frame');

  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    if (url === DECK_PLAYER_CSS_URL) return { format: 'module', shortCircuit: true, source: DECK_PLAYER_CSS_STUB };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();

  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'intro-permaculture', lang: 'st' })); });
  try {
    const picture = () => view.root.findAllByType('img')[0];
    const imageCanvas = () => picture().parent!;
    assert.match(picture().props.src, /intro-permaculture\/st\/slide-01\.webp$/);
    assert.equal(imageCanvas().props.style.aspectRatio, 1440 / 5400, 'portrait text must not be shrunk into a widescreen frame');
    const stage = view.root.findByProps({ className: 'slideStage' });
    assert.equal(stage.props.style.overflow, 'auto', 'a tall paired slide needs its own scroll area so controls stay visible');
    assert.equal(stage.props.style.maxHeight, 'min(65vh, 600px)');
    assert.equal(view.root.findAllByType('img')[1].props.style.maxHeight, undefined,
      'the full-image viewer must allow a portrait slide to scroll at readable width');
    assert.match(view.root.findByType('audio').props.src, /intro-permaculture\/st\/slide-01\.mp3$/);
    assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, false);
    assert.match(view.root.findByProps({ role: 'status' }).children.join(''), /Unreviewed Sesotho machine narration/);
    const english = view.root.findAllByType('button').find(button => button.children.join('').includes('English source narration'))!;
    assert.equal(english.props['aria-pressed'], false);

    act(() => english.props.onClick());
    assert.equal(english.props['aria-pressed'], true);
    assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, false);
    assert.match(view.root.findByType('audio').props.src, /intro-permaculture\/en\/slide-01\.mp3$/);
    assert.match(picture().props.src, /intro-permaculture\/st\/slide-01\.webp$/, 'choosing a voice must not replace the picture');
    assert.match(view.root.findByProps({ role: 'status' }).children.join(''), /English source narration selected/);

    act(() => view.root.findAllByType('button').find(button => button.children.join('') === 'Next ›')!.props.onClick());
    assert.match(picture().props.src, /intro-permaculture\/st\/slide-02\.webp$/, 'page turns keep the selected slide language');
    assert.match(view.root.findByType('audio').props.src, /intro-permaculture\/en\/slide-02\.mp3$/);
  } finally { act(() => view.unmount()); }

  for (const language of ['ve', 'ts']) {
    const audioDevice = { currentTime: 0, paused: true, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
    act(() => { view = create(createElement(DeckPlayer, { moduleId: 'intro-permaculture', lang: language }), {
      createNodeMock: element => element.type === 'audio' ? audioDevice : null,
    }); });
    try {
      const picture = () => view.root.findAllByType('img')[0];
      assert.match(picture().props.src, new RegExp(`intro-permaculture/${language}/slide-01\\.webp$`));
      assert.equal(view.root.findAllByType('audio').length, 0,
        `${language} learners should not hear English before choosing it`);
      assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, true);
      const voiceButtons = view.root.findByProps({ role: 'group', 'aria-label': 'Narration language' }).findAllByType('button');
      assert.deepEqual(voiceButtons.map(button => button.children.join('')), ['English source narration', 'No narration'],
        'regional learners can choose English source narration or silence');
      assert.equal(voiceButtons[1].props['aria-pressed'], true, 'regional slides open in silent mode');
      assert.match(view.root.findByProps({ role: 'status' }).children.join(''),
        /No narration will play/);
      const silent = voiceButtons[1];
      assert.equal(view.root.findAllByType('audio').length, 0, 'silence must not mount an English audio element');
      assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, true,
        'the narration play control stays disabled in silent mode');
      assert.match(picture().props.src, new RegExp(`intro-permaculture/${language}/slide-01\\.webp$`),
        'choosing silence must keep the regional slide visible');
      const english = voiceButtons[0];
      act(() => english.props.onClick());
      assert.match(view.root.findByType('audio').props.src, /intro-permaculture\/en\/slide-01\.mp3$/);
      assert.match(picture().props.src, new RegExp(`intro-permaculture/${language}/slide-01\\.webp$`),
        'choosing English source audio must leave the regional paired slide visible');
      assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, false);
      act(() => view.root.findByProps({ className: 'playControl' }).props.onClick());
      assert.equal(audioDevice.paused, false, 'the learner can opt into English source narration');
      audioDevice.currentTime = 12;
      act(() => silent.props.onClick());
      assert.equal(audioDevice.paused, true, 'switching to silence pauses the current audio immediately');
      assert.equal(audioDevice.currentTime, 0, 'switching to silence rewinds the interrupted audio');
      assert.equal(view.root.findAllByType('audio').length, 0, 'switching to silence removes the audio element');
      assert.equal(view.root.findByProps({ className: 'playControl' }).props['aria-label'], 'Play the lesson',
        'switching to silence stops audio-driven play-through');
      assert.match(view.root.findByProps({ role: 'status' }).children.join(''), /No narration will play/);
      assert.match(picture().props.src, new RegExp(`intro-permaculture/${language}/slide-01\\.webp$`));
      act(() => view.root.findAllByType('button').find(button => button.children.join('') === 'Next ›')!.props.onClick());
      assert.match(picture().props.src, new RegExp(`intro-permaculture/${language}/slide-02\\.webp$`),
        'manual page turns remain available with no narration');
      assert.equal(view.root.findAllByType('audio').length, 0);
    } finally { act(() => view.unmount()); }
  }

  // Soil Health is the exact small-screen Study case that exposed the selector problem: its
  // regional slides have no matching voice. They open silent, with English source audio as an
  // explicit option that must not replace the paired slide.
  for (const language of ['st', 'ts', 've']) {
    act(() => { view = create(createElement(DeckPlayer, { moduleId: 'soil-health', lang: language })); });
    try {
      const picture = () => view.root.findAllByType('img')[0];
      assert.match(picture().props.src, new RegExp(`soil-health/${language}/slide-01\\.webp$`));
      assert.equal(view.root.findAllByType('audio').length, 0,
        `${language} Soil Health learners should choose before English narration starts`);
      assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, true);
      const voiceButtons = view.root.findByProps({ role: 'group', 'aria-label': 'Narration language' }).findAllByType('button');
      assert.deepEqual(voiceButtons.map(button => button.children.join('')),
        [language === 'st' ? 'Modumo wa Senyesemane · English source narration' : 'English source narration', 'No narration']);
      assert.equal(voiceButtons[1].props['aria-pressed'], true, `${language} Soil Health opens without narration`);
      assert.match(view.root.findByProps({ role: 'status' }).children.join(''), /No narration will play/);
      if (language === 'st' || language === 've') {
        assert.equal(slideImageFor('soil-health', language, 20)?.exact, true,
          `the last ${language} source-paired frame is available, with no English slide fallback`);
        assert.equal(view.root.findAllByType('img')[0].parent!.props.style.aspectRatio, 1440 / 5400,
          'the full source-paired slide keeps its portrait ratio on a phone');
        assert.equal(view.root.findByProps({ className: 'slideStage' }).props.style.maxHeight, 'min(65vh, 600px)',
          'the portrait slide scrolls while the phone navigation controls stay on screen');
      }
      assert.equal(view.root.findAllByType('audio').length, 0, `${language} silent choice must not create an audio element`);
      assert.match(picture().props.src, new RegExp(`soil-health/${language}/slide-01\\.webp$`),
        'silent mode must retain the selected regional Soil Health still');
      act(() => voiceButtons[0].props.onClick());
      assert.match(view.root.findByType('audio').props.src, /soil-health\/en\/slide-01\.mp3$/);
      assert.match(picture().props.src, new RegExp(`soil-health/${language}/slide-01\\.webp$`),
        'choosing English narration must keep the selected Soil Health slides');
      assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, false);
      const choiceStatus = view.root.findByProps({ role: 'status' }).children.join('');
      assert.match(choiceStatus, /English source narration selected/i);
      if (language === 'ts') assert.match(choiceStatus, /itsonga narration is not available/i);
    } finally { act(() => view.unmount()); }
  }

  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'intro-permaculture', lang: 'en' })); });
  try {
    const zulu = view.root.findAllByType('button').find(button => button.children.join('') === 'isiZulu')!;
    act(() => zulu.props.onClick());
    assert.match(view.root.findAllByType('img')[0].props.src, /intro-permaculture\/zu\/slide-01\.jpg$/,
      'the existing English and isiZulu switch still changes the slides');
    assert.match(view.root.findByType('audio').props.src, /intro-permaculture\/zu\/slide-01\.mp3$/,
      'the existing English and isiZulu switch still changes the narration');
    assert.equal(view.root.findAllByType('img')[0].parent!.props.style.aspectRatio, 16 / 9);
    act(() => view.root.findByProps({ className: 'playControl' }).props.onClick());
    assert.equal(view.root.findByProps({ className: 'playControl' }).props['aria-label'], 'Stop the lesson');
    act(() => view.update(createElement(DeckPlayer, { moduleId: 'intro-permaculture', lang: 'ts' })));
    assert.match(view.root.findAllByType('img')[0].props.src, /intro-permaculture\/ts\/slide-01\.webp$/);
    assert.equal(view.root.findAllByType('audio').length, 0,
      'changing the app language must stop the old voice and require a new source choice');
    assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, true);
  } finally { act(() => view.unmount()); }
});

test('regional Food Forest and Vegetables decks expose their complete paired still sets', () => {
  const cases: [string, string, number[]][] = [
    ['food-forest', 'st', COURSE_DECKS['food-forest'].slides.map(({ slide }) => slide)],
    ['food-forest', 've', COURSE_DECKS['food-forest'].slides.map(({ slide }) => slide)],
    ['food-forest', 'ts', COURSE_DECKS['food-forest'].slides.map(({ slide }) => slide)],
    ['vegetables-staples', 'st', COURSE_DECKS['vegetables-staples'].slides.map(({ slide }) => slide)],
    ['vegetables-staples', 've', COURSE_DECKS['vegetables-staples'].slides.map(({ slide }) => slide)],
    ['vegetables-staples', 'ts', COURSE_DECKS['vegetables-staples'].slides.map(({ slide }) => slide)],
  ];
  for (const [moduleId, language, authored] of cases) {
    const deck = COURSE_DECKS[moduleId];
    assert.ok(deck.slideLanguages.includes(language));
    for (const slide of deck.slides) {
      const selected = slideImageFor(moduleId, language, slide.slide);
      assert.ok(selected);
      if (authored.includes(slide.slide)) {
        assert.equal(selected.lang, language);
        assert.match(selected.url, new RegExp(`/course-decks/${moduleId}/${language}/slide-\\d{2}\\.webp$`));
        assert.ok(onDisk(selected.url), `missing paired image ${selected.url}`);
      } else {
        assert.equal(selected.lang, 'en', `${language} slide ${slide.slide} must retain its complete English source`);
      }
    }
  }
});

test('Sesotho Food Forest keeps its paired still visible instead of the English Watch poster', () => {
  assert.equal(animationUrls('food-forest', 16, 'st'), null,
    'the English sheet-mulching poster would cover the paired Sesotho source and draft panels');
  const still = slideImageFor('food-forest', 'st', 16);
  assert.deepEqual(still, {
    url: '/course-decks/food-forest/st/slide-16.webp', lang: 'st', exact: true,
  });
});

test('regional Study decks show every paired frame and fall back for each missing frame', () => {
  const cases: [string, string, number[]][] = [
    ['market-community', 'st', Array.from({ length: 20 }, (_, i) => i + 1)],
    ['market-community', 've', Array.from({ length: 20 }, (_, i) => i + 1)],
    ['market-community', 'ts', Array.from({ length: 20 }, (_, i) => i + 1)],
    ['soil-health', 'ts', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
  ];
  for (const [moduleId, language, authored] of cases) {
    const deck = COURSE_DECKS[moduleId];
    assert.ok(deck.slideLanguages.includes(language));
    for (const slide of deck.slides) {
      const selected = slideImageFor(moduleId, language, slide.slide);
      assert.ok(selected);
      if (authored.includes(slide.slide)) {
        assert.equal(selected.lang, language);
        assert.match(selected.url, new RegExp(`/course-decks/${moduleId}/${language}/slide-\\d{2}\\.webp$`));
        assert.ok(onDisk(selected.url));
      } else {
        assert.equal(selected.lang, 'en', `${language} slide ${slide.slide} needs full English fallback`);
      }
    }
  }
});

test('Reading slide 16 reuses only its mapped learner sentences and keeps the following source paragraph', () => {
  const bodyRows = [
    { lang: 'st', index: 0, source: 'A site map needs paper, a tape measure, a compass, and time to walk your land.', previous: 'Ho etsa site map ho hloka paper, a tape measure, a compass, and time to walk your land.', text: 'Mmapa wa setsha (site map) o hloka pampiri, tepi e methang (tape measure), khampase (compass), le nako ya ho tsamaya lefatsheng la hao.' },
    { lang: 'st', index: 1, source: 'Walk the boundary and make a first sketch. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.', previous: 'Tsamaea moeling, ebe u etsa sketch ya pele. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.', text: "Tsamaya moeding mme o etse setshwantsho sa pele sa letsoho (sketch). Se tshwaye 'not to scale' ho fihlela o hlahlobile bohole ba sona. Tshwaya leboya. Kenya ntlo, difate, metsi, ditsela, diterata.", condition: /not to scale.*ho fihlela.*bohole/i },
    { lang: 've', index: 0, source: 'A site map needs paper, a tape measure, a compass, and time to walk your land.', previous: 'U ita site map zwi ṱoḓa paper, a tape measure, a compass, and time to walk your land.', learnerText: 'Mmapa wa tshitentsi (site map) u ṱoḓa bapha, theiphi yo kalaho (tape measure), khamphasi (compass), na tshifhinga tsha u tshimbila muvuni waṋu.', text: 'Mmapa wa tshitentsi (site map) u ṱoḓa bapha, theiphi yo kalaho (tape measure), khamphasi (compass), na tshifhinga tsha u tshimbila kha land yaṋu.' },
    { lang: 've', index: 1, source: 'Walk the boundary and make a first sketch. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.', previous: 'Tshimbilani kha boundary ni ite sketch ya u thoma. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.', learnerText: "Tshimbilani mukanoni nahone ni ite nyolo ya u thoma. I swayeni 'not to scale' u swikela ni tshi tola vhukule hayo. Swayani devhula (north). Engedzani nnḓu, miri, maḓi, bada, mitsheto.", text: "Tshimbilani mukanoni nahone ni ite nyolo ya u thoma. I swayeni 'not to scale' u swikela ni tshi tola vhukule hayo. Swayani devhula (north). Engedzani nnḓu, miri, maḓi, bada, fences.", condition: /not to scale.*u swikela.*vhukule/i },
    { lang: 'ts', index: 0, source: 'A site map needs paper, a tape measure, a compass, and time to walk your land.', previous: 'Ku endla mepe wa ndhawu swi lava paper, a tape measure, a compass, and time to walk your land.', text: 'Mepe wa ndhawu wu lava phepha, thepi yo pima, khompasi, na nkarhi wo fambafamba eka misava ya wena.' },
  ];
  const unchangedBody2 = {
    st: 'Joale taka the patterns you have observed. Your map becomes the design skeleton for the whole smallholding.',
    ve: 'Nga murahu olani the patterns you have observed. Your map becomes the design skeleton for the whole smallholding.',
    ts: 'Kutani dirowa the patterns you have observed. Your map becomes the design skeleton for the whole smallholding.',
  };
  const lesson = COURSE_MODULES.flatMap((module) => module.lessons).find((item) => item.id === 'reading-landscape-l4');
  assert.ok(lesson);

  assert.equal(readingFullLearnerProof.status.startsWith('learner fields applied'), true);
  assert.equal(readingFullLearnerProof.entries.length, 47);
  for (const entry of readingFullLearnerProof.entries) {
    const sourceLesson = COURSE_MODULES.flatMap((module) => module.lessons)
      .find((item) => item.id === entry.lessonId);
    assert.ok(sourceLesson, `${entry.lessonId}: learner proof lesson exists`);
    const sourceField = learnerProofField(sourceLesson, entry.field);
    assert.ok(sourceField, `${entry.lessonId}/${entry.field}: supported learner field is identified`);
    assert.equal(sourceField.source, entry.exactSource,
      `${entry.languageCode}/${entry.lessonId}/${entry.field}: learner field stays bound to its exact canonical source`);
    const currentLesson = resolveLearnerLessonPresentation(sourceLesson, entry.languageCode);
    assert.equal(currentLesson.status, 'draft');
    const currentField = learnerProofField(currentLesson.content, entry.field);
    assert.ok(currentField, `${entry.lessonId}/${entry.field}: resolved learner field exists`);
    assert.equal(currentField.target, entry.appliedTarget,
      `${entry.languageCode}/${entry.lessonId}/${entry.field}: current learner target matches its applied proof before historical checks`);
    assert.match(entry.reviewStatus, /unreviewed/i,
      `${entry.languageCode}/${entry.lessonId}/${entry.field}: the review draft remains visibly unreviewed`);
  }

  for (const item of bodyRows) {
    const pairedPath = new URL(`../docs/narration/reading-landscape.${item.lang}.paired-draft.json`, import.meta.url);
    const paired = JSON.parse(readFileSync(pairedPath, 'utf8')) as {
      reviewStatus: string;
      slides: Array<{ n: number; english: { body: string[] }; target: { body: Array<{ status: string; text: string }> } }>;
    };
    const slide = paired.slides.find((row) => row.n === 16);
    assert.ok(slide);
    assert.equal(paired.reviewStatus, 'unreviewed');
    assert.equal(slide.english.body[item.index], item.source,
      `${item.lang} slide 16 body ${item.index} must stay bound to its exact source paragraph`);
    assert.equal(slide.target.body[item.index].status, 'draft');
    assert.equal(slide.target.body[item.index].text, item.text);
    const canonicalSource = item.index === 0
      ? 'A site map needs paper, a tape measure, a compass, and time to walk your land.'
      : "Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences.";
    assert.ok(lesson.body.includes(canonicalSource),
      'the canonical source keeps the map materials, checked-distance condition, north marker and ordered objects');
    if (item.index === 1) assert.match(item.source, /roads, and fences\.$/,
      'the paired narration uses “and” before fences; canonical source omits only that conjunction');

    const resolved = resolveLearnerLessonPresentation(lesson, item.lang);
    assert.equal(resolved.status, 'draft');
    const learnerChange = readingFullLearnerProof.entries.find((entry: any) =>
      entry.lessonId === 'reading-landscape-l4' && entry.languageCode === item.lang && entry.field === 'body');
    assert.ok(learnerChange, `${item.lang}: the full-deck learner proof records this exact body`);
    assert.equal(learnerChange.exactSource, lesson.body,
      `${item.lang}: learner proof remains bound to the complete canonical lesson body`);
    assert.equal(resolved.content.body, learnerChange.appliedTarget,
      `${item.lang}: current learner output matches the independently checked applied field`);
    assert.ok(learnerChange.currentTarget.includes(item.learnerText ?? item.text),
      'the earlier localized clauses are checked against the learner before-state recorded by the applied proof');
    if (item.lang === 've' && item.index === 0) {
      assert.ok(item.learnerText);
      assert.equal(item.text, item.learnerText.replace('tsha u tshimbila muvuni waṋu.', 'tsha u tshimbila kha land yaṋu.'),
        'retain land in English where the learner draft term could narrow the source');
    } else if (item.index === 1 && (item.lang === 've' || item.lang === 'ts')) {
      assert.ok(item.learnerText);
      assert.equal(item.text, item.learnerText.replace(/mitsheto\.$/, 'fences.'),
        'retain fences in English where the learner-draft noun is ambiguous');
    }
    if (item.index === 1) {
      const firstSentence = bodyRows.find((row) => row.lang === item.lang && row.index === 0)!.text;
      assert.ok(!item.text.includes(firstSentence), 'the map-materials sentence must not be duplicated in body 1');
      assert.ok(item.condition);
      assert.match(item.text, item.condition,
        'the checked-distance condition must survive the reuse');
      const body2Change = readingFullDeckProof.records.find((record: any) =>
        record.identity.language === item.lang && record.identity.slide === 16
          && record.identity.field === 'body' && record.identity.index === 2);
      assert.ok(body2Change, `${item.lang}: the full-deck proof records the following paragraph update`);
      const expectedBody2 = unchangedBody2[item.lang as keyof typeof unchangedBody2];
      assert.equal(body2Change.sourceEnglish, slide.english.body[2]);
      assert.deepEqual(body2Change.before, { status: 'draft', text: expectedBody2 },
        'the recorded before-state preserves the paragraph that this earlier test expected');
      assert.deepEqual(slide.target.body[2], body2Change.after,
        'the later full-deck pass translates the ordinary map-design framing in the following paragraph');
      assert.equal(slide.target.body[2].status, body2Change.after.status,
        'the follow-up keeps its recorded draft or mixed review state');
      assert.equal(slide.english.body[2], 'Then draw the patterns you have observed. Your map becomes the design skeleton for the whole smallholding.');
    }
  }
});

test('Sesotho Reading spelling corrections change only the independently checked forms', () => {
  const rows = [
    { slide: 1, index: 1, source: 'Read the land before you change it. Find where water moves, where sunlight falls, where wind travels, and where cold air settles.', previous: 'Bala naha pele o e fetola. Fumana moo metsi a phallang teng, moo letsatsi le chabang teng, moo moea o fokang teng, le moo moea o batang o bokellanang teng.', current: 'Bala naha pele o e fetola. Fumana moo metsi a phallang teng, moo letsatsi le chabang teng, moo moya o fokang teng, le moo moya o batang o bokellanang teng.', oldForm: 'moea', newForm: 'moya' },
    { slide: 3, index: 2, source: 'You will use an A-frame level to trace contours.', previous: 'U tla sebelisa A-frame level ho latela contours.', current: 'U tla sebedisa A-frame level ho latela contours.', oldForm: 'sebelisa', newForm: 'sebedisa' },
    { slide: 17, index: 0, source: 'Use the picture as a guide: boundary, buildings, roads, water, slopes, and direction arrows. Draw what already exists before planning changes.', previous: 'Sebelisa setšoantšo e le motataisi: moeli, meaho, litsela, metsi, matsoapo, le metsu ea tataiso. Thala se seng se ntse se le teng pele o rera liphetoho.', current: 'Sebedisa setšoantšo e le motataisi: moeli, meaho, litsela, metsi, matsoapo, le metsu ea tataiso. Thala se seng se ntse se le teng pele o rera liphetoho.', oldForm: 'Sebelisa', newForm: 'Sebedisa' },
  ];
  for (const item of rows) {
    const paired = JSON.parse(readFileSync(new URL('../docs/narration/reading-landscape.st.paired-draft.json', import.meta.url), 'utf8')) as {
      reviewStatus: string;
      slides: Array<{ n: number; english: { body: string[] }; target: { body: Array<{ status: string; text: string }> } }>;
    };
    const slide = paired.slides.find((row) => row.n === item.slide);
    assert.ok(slide);
    assert.equal(paired.reviewStatus, 'unreviewed');
    assert.equal(slide.english.body[item.index], item.source);
    assert.equal(slide.target.body[item.index].status, 'draft');
    assert.equal(slide.target.body[item.index].text, item.current);
    assert.equal(item.previous.replaceAll(item.oldForm, item.newForm), item.current,
      'the review-approved orthographic form changes without altering surrounding prose');
  }
});

test('deck arrows change slides only while the deck itself has plain-key focus', async () => {
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    if (url === DECK_PLAYER_CSS_URL) return { format: 'module', shortCircuit: true, source: DECK_PLAYER_CSS_STUB };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'water-harvesting', lang: 'en' })); });
  try {
    // The surface can be a dialog so it can enter the browser's top layer on a phone. The
    // keyboard rule belongs to the named deck region, whichever native element contains it.
    const deckSurface = () => view.root.findAll(node => node.props.role === 'region' && node.props['aria-label']?.startsWith('Lesson slides.'))[0]!;
    const press = (key: 'ArrowLeft' | 'ArrowRight', target: unknown, modifiers = {}) => {
      const surface = deckSurface();
      let prevented = false;
      act(() => surface.props.onKeyDown({ key, target, currentTarget: surface, preventDefault: () => { prevented = true; }, ...modifiers }));
      return prevented;
    };

    const surface = deckSurface();
    assert.equal(press('ArrowRight', surface), true);
    assert.equal(view.root.findByType('h3').children.join(''), 'Learning Outcomes');
    assert.equal(press('ArrowLeft', deckSurface()), true, 'plain arrows on the deck still provide slide navigation');
    assert.equal(view.root.findByType('h3').children.join(''), 'Water Harvesting');

    const audio = view.root.findByType('audio');
    assert.equal(press('ArrowRight', audio), false, 'native audio controls keep their seek keys');
    assert.equal(view.root.findByType('h3').children.join(''), 'Water Harvesting');
    const playButton = view.root.findAllByType('button').find(button => button.props['aria-label'] === 'Play the lesson')!;
    assert.equal(press('ArrowRight', playButton), false, 'buttons and other page widgets do not turn the page');
    assert.equal(press('ArrowRight', deckSurface(), { ctrlKey: true }), false, 'modified browser and assistive-technology shortcuts stay untouched');
    assert.equal(view.root.findByType('h3').children.join(''), 'Water Harvesting');
  } finally { act(() => view.unmount()); }
});

test('a timed tour follows the voice after late loading, pause and seeking, then preserves its final hold', async t => {
  // The current learner set deliberately has no locally drawn timed tours. Keep this interaction
  // covered with an in-memory fixture so withdrawing a visual does not also withdraw the player
  // guarantee that the next reviewed timed tour will depend on.
  const tourSlide = COURSE_DECKS['food-forest'].slides.find(slide => slide.slide === 15)!;
  const previousAnimation = tourSlide.animation;
  tourSlide.animation = {
    src: 'timed-tour-test-fixture', poster: 'timed-tour-test-fixture', bytes: 1,
    seconds: 33.291667, narrationTimed: true,
  };
  t.after(() => { tourSlide.animation = previousAnimation; });
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    if (url === DECK_PLAYER_CSS_URL) return { format: 'module', shortCircuit: true, source: DECK_PLAYER_CSS_STUB };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const audio = { currentTime: 0, paused: true, ended: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  const video = { currentTime: 0, duration: 33.291667, readyState: 0, paused: true, ended: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'food-forest', lessonId: 'food-forest-l3', lang: 'en' }), {
    createNodeMock: element => element.type === 'video' ? video : element.type === 'audio' ? audio : null,
  }); });
  try {
    act(() => view.root.findAllByType('button').find(b => b.children.join('') === 'Next ›')!.props.onClick());
    assert.equal(view.root.findAllByType('video').length, 0, 'timed tours still require a download choice');
    audio.currentTime = 18;
    const watch = view.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.join('').startsWith('Watch · ')))!;
    act(() => watch.props.onClick());
    assert.equal(audio.currentTime, 0, 'choosing Watch during speech restarts this scene together');
    const clip = view.root.findByType('video');
    assert.equal(clip.props.controls, false, 'one set of playback controls governs the timed pair');
    audio.currentTime = 8;
    act(() => clip.props.onCanPlay());
    assert.equal(video.currentTime, 0, 'do not seek unloaded media');
    video.readyState = 4;
    act(() => clip.props.onCanPlay());
    assert.equal(video.currentTime, 8, 'late-loaded pictures must catch up to the spoken feature');
    assert.equal(video.paused, false);
    audio.paused = true;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.paused, true, 'paused speech must not leave highlights running');
    audio.currentTime = 18;
    act(() => view.root.findByType('audio').props.onSeeked());
    assert.equal(video.currentTime, 18, 'seeking speech must seek the matching visual');
    audio.paused = false;
    act(() => view.root.findByType('audio').props.onPlaying());
    assert.equal(video.paused, false);
    video.currentTime = 15;
    act(() => view.root.findByType('audio').props.onTimeUpdate());
    assert.equal(video.currentTime, 18, 'a stalled picture must not remain behind the voice');
    act(() => view.root.findByType('audio').props.onWaiting());
    assert.equal(video.paused, true, 'buffering speech must not let the visual run ahead');
    act(() => view.root.findAllByType('button').find(b => b.props['aria-label'] === 'Stop the lesson')!.props.onClick());
    assert.equal(view.root.findByType('video').props.controls, true, 'silent watching keeps its own controls');
    audio.currentTime = 12; audio.paused = false;
    act(() => view.root.findByType('audio').props.onPlaying());
    assert.equal(video.currentTime, 12, 'the native audio Play control must also synchronize the picture');
    assert.equal(view.root.findByType('video').props.controls, false);
    assert.equal(view.root.findByType('video').props.loop, false, 'a narrated tour must not loop behind the closing words');
    audio.paused = true;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.paused, true);
    act(() => view.root.findAllByType('button').find(b => b.props['aria-label'] === 'Play the lesson')!.props.onClick());
    audio.currentTime = 32.04; audio.paused = true; audio.ended = true; video.currentTime = 32;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.currentTime, 32, 'the final hold must not jump back to a word boundary');
    assert.equal(video.paused, false, 'the final hold must be able to finish');
    act(() => view.root.findByType('audio').props.onEnded());
    assert.match(view.root.findByType('h3').children.join(''), /Young Food Forest/);
    video.ended = true;
    act(() => clip.props.onEnded());
    assert.equal(view.root.findByType('h3').children.join(''), 'Prepare a Manageable First Area');
  } finally { act(() => view.unmount()); }
});

// A voice selection must not hide the language draft being compared; a known
// instruction error must stop narration rather than masquerade as a missing file.
test('isiZulu deck source remains visible with English voice and withheld recordings stay silent', async () => {
  const slide11Draft = resolveRegisteredSilentDeckDraft('seeds-sovereignty', 11);
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    if (url === DECK_PLAYER_CSS_URL) return { format: 'module', shortCircuit: true, source: DECK_PLAYER_CSS_STUB };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  const audioDevice = { currentTime: 0, pause() {}, play: () => Promise.resolve() };
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'seeds-sovereignty', lang: 'zu' }), {
    createNodeMock: element => element.type === 'audio' ? audioDevice : null,
  }); });
  try {
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Exact English source' }).length, 1);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Unreviewed isiZulu draft' }).length, 1);
    const picture = () => view.root.findAllByType('img')[0];
    const voices = () => view.root.findByProps({ role: 'group', 'aria-label': 'Narration language' }).findAllByType('button');
    act(() => voices().find(button => button.children.join('') === 'English')!.props.onClick());
    assert.match(picture().props.src, /seeds-sovereignty\/zu\/slide-01.jpg$/);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Unreviewed isiZulu draft' }).length, 1);
    assert.match(view.root.findByType('audio').props.src, /seeds-sovereignty\/en\/slide-01.mp3$/);
    act(() => voices().find(button => button.children.join('') === 'isiZulu')!.props.onClick());
    for (let index = 0; index < 10; index++) {
      act(() => view.root.findAllByType('button').find(button => button.children.join('') === 'Next ›')!.props.onClick());
    }
    assert.equal(picture().props.src, slide11Draft?.imageUrl ?? '/course-decks/seeds-sovereignty/en/slide-11.jpg');
    assert.equal(view.root.findAllByType('audio').length, 0, 'boil-versus-ferment recording cannot play');
    assert.equal(view.root.findByProps({ className: 'playControl' }).props.disabled, true);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Unreviewed corrected isiZulu slide draft' }).length,
      slide11Draft ? 1 : 0);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Exact English source' }).length, 1);
    const notice = view.root.findAllByType('p').map(p => p.children.join('')).join(' ');
    assert.match(notice, slide11Draft ? /previous isiZulu recording remains unavailable/ : /recording need revision/);
    act(() => voices().find(button => button.children.join('') === 'English')!.props.onClick());
    assert.match(view.root.findByType('audio').props.src, /seeds-sovereignty\/en\/slide-11.mp3$/);
    assert.equal(picture().props.src, slide11Draft?.imageUrl ?? '/course-decks/seeds-sovereignty/en/slide-11.jpg',
      'explicit English audio does not replace the corrected isiZulu silent card');
  } finally { act(() => view.unmount()); }
});
