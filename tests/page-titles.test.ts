// nav-16 / copy-13 (wave 13 audit): ~39 of 51 EN routes shared the one root <title> ("ImbewuField
// — permaculture planning for South African farmers"), so a mentor with several tabs open
// couldn't tell them apart in the tab bar, history or share sheet. Every route is a 'use client'
// page, so it cannot export its own metadata — the fix is a small server app/<route>/layout.tsx
// per segment that only exports `metadata = { title }`.
//
// This test walks every app/**/page.tsx and fails when the route has no way to get a distinct
// title: no metadata/generateMetadata of its own, no sibling layout.tsx with a title, no legacy
// document.title assignment (app/pitch/page.tsx's existing pattern), and isn't a pure
// server-redirect (app/finances/page.tsx — the destination page carries the title instead).
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/page-titles.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import test from 'node:test';

const APP_ROOT = new URL('../app', import.meta.url).pathname;

function findPages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findPages(full, out);
    } else if (entry === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

// Routes this track does not own and cannot add a layout.tsx title to without stepping into
// another track's territory: app/cropplan/page.tsx and app/facilitator/crops/page.tsx belong to
// the crop/production planner (Codex-owned, explicitly off limits this wave). app/facilitator/
// print/page.tsx left this list in wave 15 (nav-16) with its own 'Printable plan' layout title.
// Tracked here, not silently skipped — a route leaving this list without gaining a real title
// should fail the test like any other regression.
const OUT_OF_SCOPE_THIS_WAVE = new Set([
  'cropplan/page.tsx',
  'facilitator/crops/page.tsx',
]);

test('every app route can produce a page title distinct from the root default', () => {
  const pages = findPages(APP_ROOT);
  const failures: string[] = [];
  for (const pagePath of pages) {
    const relPath = pagePath.slice(APP_ROOT.length + 1);
    if (OUT_OF_SCOPE_THIS_WAVE.has(relPath)) continue;
    const dir = dirname(pagePath);
    const src = readFileSync(pagePath, 'utf8');
    const hasOwnMetadata = /export const metadata|export (async )?function generateMetadata/.test(src);
    const hasDocumentTitle = /document\.title\s*=/.test(src);
    const isPureRedirect = /\bredirect\(/.test(src) && !/<h1[\s>]/i.test(src);
    if (hasOwnMetadata || hasDocumentTitle || isPureRedirect) continue;
    let hasLayoutTitle = false;
    try {
      const laySrc = readFileSync(join(dir, 'layout.tsx'), 'utf8');
      hasLayoutTitle = /title/.test(laySrc);
    } catch {
      // no layout.tsx in this segment
    }
    if (!hasLayoutTitle) failures.push(relPath);
  }
  assert.deepEqual(failures, [], 'these routes have neither their own metadata nor a layout.tsx title, so every tab shows the same root <title>');
});
