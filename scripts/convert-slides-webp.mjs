#!/usr/bin/env node
// perf-03: re-encode English and isiZulu lesson slides from JPEG to WebP.
//
// English and isiZulu slides were the only ones still ~1 MB JPEGs (~20 MB per module); st/ve/ts
// already ship ~300 KB WebP. This writes a .webp next to every
// public/course-decks/<module>/{en,zu}/*.jpg at the same dimensions, then deletes the .jpg.
//
// Run: node scripts/convert-slides-webp.mjs

import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

async function main() {
  const modules = readdirSync(DECKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const results = [];
  for (const moduleId of modules) {
    for (const lang of ['en', 'zu']) {
      const dir = join(DECKS_DIR, moduleId, lang);
      if (!existsSync(dir)) continue;
      const jpgs = readdirSync(dir).filter((name) => name.endsWith('.jpg')).sort();
      for (const name of jpgs) {
        const result = await convertOne(join(dir, name));
        results.push(result);
        console.log(`${moduleId}/${lang}/${name} -> ${name.replace(/\.jpg$/, '.webp')}`);
      }
    }
  }

  console.log(`\nConverted ${results.length} slides.`);
}

main();
