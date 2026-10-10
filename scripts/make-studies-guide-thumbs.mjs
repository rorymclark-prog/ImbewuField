#!/usr/bin/env node
// perf-05: small WebP thumbnails for the Studies overview cards.
//
// app/student/page.tsx shows the full ~850 KB public/studies-guides/*.jpg photos at 150x100 for
// the Design and Finance preview cards. This writes a ~320px-wide WebP twin next to the full
// image, under public/studies-guides/thumbs/, so the card downloads a thumbnail instead of the
// full-size photo. The full .jpg files are untouched — other pages show them at full size.
//
// Run: node scripts/make-studies-guide-thumbs.mjs

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES_DIR = join(ROOT, 'public', 'studies-guides');
const THUMBS_DIR = join(GUIDES_DIR, 'thumbs');
const WIDTH = 320;
const QUALITY = 78;
const EFFORT = 5;

// Only the images actually used as a small card thumbnail (app/student/page.tsx); record-sale.jpg
// is never shown at thumbnail size, so it keeps no thumb.
const SOURCES = ['sketch-the-site.jpg', 'expense-record.jpg'];

async function main() {
  mkdirSync(THUMBS_DIR, { recursive: true });
  for (const name of SOURCES) {
    const src = join(GUIDES_DIR, name);
    const dest = join(THUMBS_DIR, name.replace(/\.jpg$/, '.webp'));
    await sharp(src).resize({ width: WIDTH }).webp({ quality: QUALITY, effort: EFFORT }).toFile(dest);
    console.log(`${name} -> thumbs/${name.replace(/\.jpg$/, '.webp')}`);
  }
}

main();
