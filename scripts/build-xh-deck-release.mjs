#!/usr/bin/env node
// Builds the isiXhosa Studies slide cards and their release bindings.
//
// For every module with docs/narration/<module>.xh.silent-draft.json (an unreviewed, source-paired
// isiXhosa draft of the English narration), this:
//   1. renders the silent review cards with scripts/make-lesson-slides.mjs (isiXhosa draft above the
//      exact English source, over the illustrated English slide),
//   2. writes them as lossy WebP to public/course-decks/<module>/xh-silent/slide-NN.webp,
//   3. regenerates lib/course-deck-release-bindings-xh-data.ts: one release row per module with the
//      pair digest, the source/target text digests and the real image bytes, plus their sizes for
//      the offline download.
// Rendering and WebP encoding need python3 + Pillow and a scalable font (DejaVu on Linux, incl. DejaVuSerif-Italic).
//
// USAGE
//   node --import ./tests/register-alias.mjs scripts/build-xh-deck-release.mjs [module ...]
//   (no modules = every module that has an isiXhosa pair; rows for the others are kept from disk)
//   --no-render rebuilds the rows from the cards already on disk

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { englishSlideRecords, validatePairedDraft } from './paired-draft-slides.mjs';
import { releasePairTarget } from '../lib/course-deck-release-bindings.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pairPathFor = (moduleId) => `docs/narration/${moduleId}.xh.silent-draft.json`;
const modulesWithPairs = COURSE_MODULES.map((m) => m.id).filter((id) => existsSync(join(ROOT, pairPathFor(id))));
const noRender = process.argv.includes('--no-render');
const requested = process.argv.slice(2).filter((arg) => arg !== '--no-render');
for (const id of requested) if (!modulesWithPairs.includes(id)) throw new Error(`no isiXhosa pair for ${id}`);
const toRender = new Set(noRender ? [] : requested.length ? requested : modulesWithPairs);

const rows = [];
const sizes = {};
for (const moduleId of modulesWithPairs) {
  const pairPath = pairPathFor(moduleId);
  const pairBytes = readFileSync(join(ROOT, pairPath));
  const pair = JSON.parse(pairBytes.toString());
  const source = englishSlideRecords(readFileSync(join(ROOT, 'docs/narration', `${moduleId}.en.md`), 'utf8'));
  validatePairedDraft(pair, source, 'xh');
  const outDir = join(ROOT, 'public/course-decks', moduleId, 'xh-silent');

  if (toRender.has(moduleId)) {
    const temp = mkdtempSync(join(tmpdir(), `xh-deck-${moduleId}-`));
    try {
      // Seeds' authored English slides are 960x540; its native mode places them 1:1 (see the renderer).
      const native = moduleId === 'seeds-sovereignty' ? ['--paired-native-source'] : [];
      execFileSync(process.execPath, ['scripts/make-lesson-slides.mjs', moduleId, 'xh', temp, '--paired-draft', pairPath, ...native],
        { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
      // Lossy RGB WebP (a plain 'VP8 ' chunk), the encoding the release guard reads.
      execFileSync('python3', ['-c', `import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if f.startswith('slide-') and f.endswith('.png'):
        Image.open(os.path.join(src, f)).convert('RGB').save(os.path.join(out, f[:-4] + '.webp'), 'WEBP', quality=78, method=5)`, temp, outDir]);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    console.log(`rendered ${moduleId}`);
  }
  if (!existsSync(outDir)) { console.warn(`skipped ${moduleId}: pair present but no cards rendered yet`); continue; }

  const release = {
    moduleId, language: 'xh', pairPath, pairSha256: sha(pairBytes), reviewStatus: 'unreviewed', audioBinding: 'none',
    slides: source.map((s) => ({ sourceHeading: s.heading, sourceEnglish: s.body })),
  };
  release.slides = source.map((s, i) => {
    const target = releasePairTarget(pair, release, i + 1);
    if (!target) throw new Error(`${moduleId} slide ${s.n}: pair does not resolve`);
    const imageUrl = `/course-decks/${moduleId}/xh-silent/slide-${String(s.n).padStart(2, '0')}.webp`;
    const imagePath = join(ROOT, 'public', imageUrl);
    if (!existsSync(imagePath)) throw new Error(`${imageUrl} is missing: render ${moduleId} first`);
    const bytes = readFileSync(imagePath);
    if (bytes.toString('ascii', 12, 16) !== 'VP8 ') throw new Error(`${imageUrl}: expected a lossy WebP`);
    const width = bytes.readUInt16LE(26) & 0x3fff, height = bytes.readUInt16LE(28) & 0x3fff;
    sizes[imageUrl] = bytes.length;
    return {
      slide: s.n, sourceHeading: s.heading, sourceEnglish: s.body,
      targetHeading: target.heading, targetText: target.body,
      sourceHash: sha(JSON.stringify([s.heading, ...s.body])),
      targetHash: sha(JSON.stringify([target.heading, ...target.body])),
      imageUrl, imageSha256: sha(bytes), imageBytes: bytes.length, width, height,
    };
  });
  rows.push(release);
}

const counts = Object.fromEntries(rows.map((r) => [`${r.moduleId}.xh`, r.slides.length]));
writeFileSync(join(ROOT, 'lib/course-deck-release-bindings-xh-data.ts'), `// GENERATED by scripts/build-xh-deck-release.mjs — do not edit by hand.
//
// isiXhosa Studies slide cards: unreviewed machine drafts of the narration, each card showing the
// draft above its exact English source (docs/narration/<module>.xh.silent-draft.json). Silent: there
// is no isiXhosa narration, so learners pick the English source voice or none. The pair files are
// not bundled; lib/course-deck-release-bindings-registry.ts rebuilds each pair from these rows, and
// tests/xh-deck-release.test.ts proves the rebuilt pair equals the file and recomputes every digest.
import type { CourseDeckRelease } from './course-deck-release-bindings';

export const XH_DECK_RELEASE_ROWS: readonly CourseDeckRelease[] = ${JSON.stringify(rows, null, 2)};

export const XH_DECK_RELEASE_EXPECTED_COUNTS: Readonly<Record<string, number>> = ${JSON.stringify(counts, null, 2)};

/** Exact byte sizes of the cards above, for the offline download (checked against disk by tests). */
export const XH_DECK_ASSET_SIZES: Readonly<Record<string, number>> = ${JSON.stringify(sizes, null, 2)};
`);
console.log(`wrote ${rows.length} isiXhosa deck releases, ${Object.keys(sizes).length} cards`);
