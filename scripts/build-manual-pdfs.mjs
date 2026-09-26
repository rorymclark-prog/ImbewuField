#!/usr/bin/env node
// Prints the Permaculture Manual book pages (/manual/<lang>/book) to A4 PDFs.
//
//   npm run dev            (or any running build of the app)
//   node scripts/build-manual-pdfs.mjs [baseUrl] [lang ...]
//
// baseUrl defaults to http://localhost:3000; langs default to the public ones. Output goes to
// output/manual/permaculture-manual-<lang>.pdf (git-ignored — the PDFs are large and are shared
// through Drive, not the repo). Rebuild after changing chapter text, figures or cover art.
//
// Playwright is not a project dependency: this uses a local or global install
// (`npm i -g playwright`), and CHROMIUM_PATH if Chromium is not where Playwright expects it.

import { execSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// The public languages (lib/manual.ts MANUAL_LANGS; Xitsonga is paused, see #697).
const LANGS = ['en', 'zu', 'st', 've'];
const [base = 'http://localhost:3000', ...picked] = process.argv.slice(2);
const langs = picked.length ? picked : LANGS;

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through to global */ }
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const outDir = path.resolve('output', 'manual');
mkdirSync(outDir, { recursive: true });

for (const lang of langs) {
  const page = await browser.newPage();
  // Skip first-run onboarding and the consent sheet so they do not cover the book.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('permamap_onboarded', '1');
      localStorage.setItem('imbewu_popia', JSON.stringify({ accepted: true, storeData: true, shareNgo: false, at: Date.now() }));
    } catch { /* storage blocked: the print CSS hides everything outside the book anyway */ }
  });
  await page.goto(`${base}/manual/${lang}/book`, { waitUntil: 'networkidle', timeout: 300_000 });
  // Manual figures are loading="lazy": an off-screen lazy image never starts loading (and never
  // fires onload), so switch them all to eager first, then wait for every one.
  await page.evaluate(() => Promise.all([...document.images].map((img) => {
    img.loading = 'eager';
    return img.complete || new Promise((r) => { img.onload = img.onerror = r; });
  })));
  await page.emulateMedia({ media: 'print' });
  const file = path.join(outDir, `permaculture-manual-${lang}.pdf`);
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log(`${lang}: ${file} (${(statSync(file).size / 1e6).toFixed(1)} MB)`);
  await page.close();
}
await browser.close();
