// perf-03: English and isiZulu lesson slides must stay registered and shipped as WebP, the same
// format st/ve/ts already use. A regression here would silently bring back ~1 MB-per-slide JPEGs
// for the two languages most learners actually read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';

import { COURSE_DECKS } from '@/lib/course-deck';
import { COURSE_MODULES } from '@/lib/course-modules';

const PUBLIC = new URL('../public/', import.meta.url);
const DECKS_DIR = new URL('course-decks/', PUBLIC);

test('every deck registers webp for English and isiZulu slides', () => {
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of ['en', 'zu']) {
      if (!deck.slideLanguages.includes(lang)) continue;
      assert.equal(deck.slideFormatsByLanguage?.[lang], 'webp',
        `${moduleId}: ${lang} must be registered as webp`);
    }
  }
});

// Three plant-guilds lessons show an English slide as their lesson picture, and many dated
// Study proofs pin lib/course-modules.ts byte for byte. Those JPEGs stay as lesson pictures;
// the deck itself still loads the WebP twin of the same slide.
const LESSON_PICTURE_JPEGS = new Set(COURSE_MODULES.flatMap((module) =>
  module.lessons.map((lesson) => lesson.infographicUrl).filter((url): url is string => !!url && url.endsWith('.jpg'))));

test('the only English or isiZulu JPEGs kept are lesson pictures, each with a WebP twin', () => {
  const slidePictures = [...LESSON_PICTURE_JPEGS].filter((url) => /^\/course-decks\/[^/]+\/(en|zu)\//.test(url)).sort();
  assert.deepEqual(slidePictures, [
    '/course-decks/plant-guilds/en/slide-15.jpg',
    '/course-decks/plant-guilds/en/slide-29.jpg',
    '/course-decks/plant-guilds/en/slide-37.jpg',
  ]);
  for (const url of slidePictures) {
    assert.ok(existsSync(new URL(url.slice(1).replace(/\.jpg$/, '.webp'), PUBLIC)), `${url}: WebP twin ships`);
  }
});

test('no other English or isiZulu .jpg slide remains anywhere under public/course-decks', () => {
  const offenders: string[] = [];
  const moduleDirs = readdirSync(DECKS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const moduleDir of moduleDirs) {
    for (const lang of ['en', 'zu']) {
      const langDir = new URL(`${moduleDir.name}/${lang}/`, DECKS_DIR);
      if (!existsSync(langDir)) continue;
      walk(langDir, offenders);
    }
  }
  assert.deepEqual(offenders, [], `leftover en/zu JPEG slides: ${offenders.join(', ')}`);
});

function walk(dir: URL, offenders: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      walk(new URL(`${entry.name}/`, dir), offenders);
    } else if (entry.name.endsWith('.jpg')) {
      const path = new URL(entry.name, dir).pathname;
      if (!LESSON_PICTURE_JPEGS.has(path.slice(path.indexOf('/course-decks/')))) offenders.push(path);
    }
  }
}
