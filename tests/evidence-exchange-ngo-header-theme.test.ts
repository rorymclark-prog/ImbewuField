// a11y-04 + a11y-10 + a11y-11 — lib/app-header.ts's shared bar (seven staff pages: ngo, mentor,
// updates, atlas, assessments, surveys, student, funder) hardcoded a #FFFEFA background and an
// #E2D8C4 border, so every page using APP_HEADER_STYLE stayed a bright-paper bar in dark mode —
// and BrandLogo's wordmark (already correctly themed to --text-primary) went pale-on-white
// against it, reading as invisible. Evidence/exchange cards in EvidenceCatalogue.tsx,
// EvidenceSheet.tsx and ExchangeBoard.tsx hardcoded solid #fff/#EBE3D2 card and input surfaces
// against already-themed text, so they stayed bright blocks in dark mode too.
//
// This is a flat text scan, not a render test — it can't see contrast, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

test('the shared staff-page header bar follows the theme', () => {
  const src = read('lib/app-header.ts');
  assert.doesNotMatch(src, /#FFFEFA/, 'APP_HEADER_STYLE should not hardcode the light-mode card hex');
  assert.doesNotMatch(src, /#E2D8C4/, 'APP_HEADER_STYLE should not hardcode the light-mode border hex');
  assert.match(src, /background:\s*'var\(--bg-1\)'/);
  assert.match(src, /borderBottom:\s*'1px solid var\(--border\)'/);
});

test('EvidenceCatalogue and EvidenceSheet card surfaces are no longer a fixed white block', () => {
  const catalogue = read('components/EvidenceCatalogue.tsx');
  assert.doesNotMatch(catalogue, /background:\s*'#fff'/i);

  const sheet = read('components/EvidenceSheet.tsx');
  // Exactly the land/legal warning (#FFF6E5) and the storage-full banner (#FEF2F2) are left as
  // their own deliberate warning/error tints, outside this track's scope — the plain card and
  // input surfaces this track touched should no longer be a literal '#fff'.
  assert.doesNotMatch(sheet, /background:\s*'#fff'/i);
  assert.match(sheet, /background:\s*'var\(--input-bg\)'/);
  assert.ok((sheet.match(/background:\s*'var\(--bg-1\)'/g) ?? []).length >= 3);
});

test('ExchangeBoard search/filter inputs are no longer a fixed white block', () => {
  const src = read('components/exchange/ExchangeBoard.tsx');
  assert.doesNotMatch(src, /background:\s*'#fff'/i);
  assert.ok((src.match(/background:\s*'var\(--input-bg\)'/g) ?? []).length >= 4);
});

test('the offline-download pack card no longer hardcodes a light-only tint and border', () => {
  const src = read('components/course/OfflineDownload.tsx');
  assert.doesNotMatch(src, /background:\s*'rgba\(31,77,43,0\.05\)',\s*border:\s*'1px solid #E2D8C4'/);
  assert.match(src, /background:\s*'var\(--bg-1\)',\s*border:\s*'1px solid var\(--border\)'/);
});
