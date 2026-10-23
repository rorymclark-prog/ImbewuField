#!/usr/bin/env node
// perf-03: re-encode English and isiZulu lesson slides from JPEG to WebP.
//
// English and isiZulu slides were the only ones still ~1 MB JPEGs (~20 MB per module); st/ve/ts
// already ship ~300 KB WebP. This writes a .webp next to every
// public/course-decks/<module>/{en,zu}/*.jpg at the same dimensions, then deletes the .jpg.
//
// Run: node scripts/convert-slides-webp.mjs

import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECKS_DIR = join(ROOT, 'public', 'course-decks');
const QUALITY = 78;
const EFFORT = 5;

async function convertOne(jpgPath) {
  const webpPath = jpgPath.replace(/\.jpg$/, '.webp');
  const image = sharp(jpgPath);
  const meta = await image.metadata();
  await image.webp({ quality: QUALITY, effort: EFFORT }).toFile(webpPath);
  unlinkSync(jpgPath);
  return { jpgPath, webpPath, width: meta.width, height: meta.height };
}

// Walks the whole en/zu subtree, not just its top level: seeds-sovereignty/zu/hi/ holds a
// higher-quality twin of each slide (lib/offline-pack.ts's "high quality" download variant) at
// the same filenames, one directory deeper.
function findJpgs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findJpgs(full));
    else if (entry.name.endsWith('.jpg')) found.push(full);
  }
  return found.sort();
}

async function main() {
  const modules = readdirSync(DECKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const results = [];
  for (const moduleId of modules) {
    for (const lang of ['en', 'zu']) {
      const dir = join(DECKS_DIR, moduleId, lang);
      if (!existsSync(dir)) continue;
      for (const jpgPath of findJpgs(dir)) {
        const result = await convertOne(jpgPath);
        results.push(result);
        console.log(`${relative(DECKS_DIR, jpgPath)} -> ${relative(DECKS_DIR, result.webpPath)}`);
      }
    }
  }

  console.log(`\nConverted ${results.length} slides.`);
}

main();
