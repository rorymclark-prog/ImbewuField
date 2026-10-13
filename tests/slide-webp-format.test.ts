// perf-03: English and isiZulu lesson slides must stay registered and shipped as WebP, the same
// format st/ve/ts already use. A regression here would silently bring back ~1 MB-per-slide JPEGs
// for the two languages most learners actually read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';

import { COURSE_DECKS } from '@/lib/course-deck';

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

test('no English or isiZulu .jpg slide remains anywhere under public/course-decks', () => {
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
      offenders.push(new URL(entry.name, dir).pathname);
    }
  }
}
