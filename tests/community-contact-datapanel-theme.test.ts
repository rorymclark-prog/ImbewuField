// a11y-05 — the same forest-fill/on-forest-text pairing (#1F4D2B + #F7F2E9) and error red
// (#8B2020/#8C4938) that tests/theme-leftovers.test.ts already guards on three other files had
// crept into app/community/u/[uid]/page.tsx, app/community/messages/[threadId]/page.tsx,
// components/ContactInbox.tsx and components/DataPanel.tsx too — plus plain hardcoded dark text
// (#20190F, #5C5040, #755942) and card surfaces (#FFFEFA/#E2D8C4) on themed pages. All four now
// route through var(--color-forest-800)/var(--color-canvas), var(--danger), var(--text-primary)/
// var(--text-muted) and var(--bg-1)/var(--border), the same tokens the rest of this wave uses.
//
// a11y-12 — three DataPanel.tsx captions (BRU attribution, calendar legend, soil-improvement
// label) were set at 9.5px, under the 11px floor. Raised to clamp(12px, 0.85vw, 13px); the
// EXPERT_SURFACES ratchet budget in tests/type-floor.test.ts is updated alongside.
//
// This is a flat text scan, not a render test — it can't see contrast, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const BANNED_HEX = ['#1F4D2B', '#F7F2E9', '#8B2020', '#8C4938'];

test('community profile and messages pages no longer paint forest fill or error text as a literal hex', () => {
  for (const rel of ['app/community/u/[uid]/page.tsx', 'app/community/messages/[threadId]/page.tsx']) {
    const src = read(rel);
    for (const hex of BANNED_HEX) {
      assert.ok(!src.includes(`'${hex}'`), `${hex} should be gone from ${rel}`);
    }
  }
});

test('ContactInbox no longer paints cards, dark text or error notices as a literal hex', () => {
  const src = read('components/ContactInbox.tsx');
  for (const hex of [...BANNED_HEX, '#FFFEFA', '#E2D8C4', '#20190F', '#5C5040', '#755942', '#D8B7A8', '#FFF4EF', '#E5EFF8', '#244B6B']) {
    assert.ok(!src.includes(hex), `${hex} should be gone from components/ContactInbox.tsx`);
  }
  assert.match(src, /background:\s*'var\(--input-bg\)'/);
});

test('DataPanel no longer paints forest fill, error text or plain dark text as the known-banned literal hexes', () => {
  const src = read('components/DataPanel.tsx');
  for (const hex of [...BANNED_HEX, '#20190F', '#5C5040', '#755942', '#2D6B3C', '#235E86']) {
    assert.ok(!src.includes(`'${hex}'`), `${hex} should be gone from components/DataPanel.tsx`);
  }
});

test('DataPanel captions that were at 9.5px now clamp to a 12px floor', () => {
  const src = read('components/DataPanel.tsx');
  assert.doesNotMatch(src, /fontSize:\s*9\.5/);
  assert.ok((src.match(/fontSize:\s*'clamp\(12px, 0\.85vw, 13px\)'/g) ?? []).length >= 3);
});

test('AtlasPanel and the contact-page subject label clear the 11px caption floor', () => {
  const atlas = read('components/atlas/AtlasPanel.tsx');
  assert.doesNotMatch(atlas, /fontSize:\s*9\.5/);
  assert.doesNotMatch(atlas, /fontSize:\s*9,/);
  assert.doesNotMatch(atlas, /fontSize:\s*10,/);
  assert.doesNotMatch(atlas, /fontSize:\s*10\.5,/);

  const contact = read('app/contact/page.tsx');
  const subjectLabelIndex = contact.indexOf("ui('Subject (optional)'");
  assert.ok(subjectLabelIndex > -1, 'the Subject (optional) label should still exist');
  const precedingStyle = contact.slice(Math.max(0, subjectLabelIndex - 200), subjectLabelIndex);
  assert.match(precedingStyle, /fontSize:\s*'clamp\(12px, 0\.85vw, 13px\)'/);
});
