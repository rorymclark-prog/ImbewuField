// a11y-06 — money-entry and contact fields' captions were plain <div>/<label> text sitting next
// to an <input>, with no htmlFor/id or aria-label tying them together, so a screen reader read
// the input with no name ("0.00", "edit text") instead of the caption above it.
// app/records/page.tsx's expense-crop/crop/price/buyer fields and its category chip group,
// app/contact/page.tsx's Subject/Message fields, app/community/profile/page.tsx's display-name/
// area/bio fields and its crops chip group, and the message box on
// app/community/messages/[threadId]/page.tsx now carry a matching id/htmlFor pair, a
// role="group" + aria-labelledby for the two chip groups, or an aria-label where no visible
// caption exists to reuse.
//
// a11y-07 — app/home/page.tsx's "Last site" stats squeezed 4 columns into a 360px phone.
// Re-checked by the 2026-10-10 audit; fixed by dropping to 2 columns below sm.
//
// This is a flat text scan, not a render test — it can't see the accessibility tree, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

test('app/records/page.tsx ties the money-entry captions to their inputs', () => {
  const src = read('app/records/page.tsx');
  for (const field of ['expense-crop', 'crop', 'price', 'buyer']) {
    assert.match(src, new RegExp(`htmlFor=\\{\`\\$\\{idPrefix\\}-${field}\`\\}`), `expected a label htmlFor the ${field} field`);
    assert.match(src, new RegExp(`id=\\{\`\\$\\{idPrefix\\}-${field}\`\\}`), `expected an id on the ${field} input`);
  }
  assert.match(src, /role="group" aria-labelledby=\{`\$\{idPrefix\}-category-label`\}/);
});

test('app/contact/page.tsx ties the Subject and Message captions to their fields', () => {
  const src = read('app/contact/page.tsx');
  assert.match(src, /htmlFor="contact-subject"[\s\S]{0,400}id="contact-subject"/);
  assert.match(src, /htmlFor="contact-message"[\s\S]{0,400}id="contact-message"/);
});

test('app/community/profile/page.tsx ties display-name, area, bio and the crops group to their controls', () => {
  const src = read('app/community/profile/page.tsx');
  for (const field of ['display-name', 'area', 'bio']) {
    assert.match(src, new RegExp(`htmlFor="community-profile-${field}"[\\s\\S]{0,300}id="community-profile-${field}"`));
  }
  assert.match(src, /role="group" aria-labelledby="community-profile-crops-label"/);
});

test('app/community/messages/[threadId]/page.tsx names its message input for assistive tech', () => {
  const src = read('app/community/messages/[threadId]/page.tsx');
  assert.match(src, /placeholder=\{t\('communityMessageInputPlaceholder'\)\}\s*\n\s*aria-label=\{t\('communityMessageInputPlaceholder'\)\}/);
});

test('app/home/page.tsx Last-site stats grid drops to 2 columns below sm', () => {
  const src = read('app/home/page.tsx');
  assert.match(src, /className="grid grid-cols-2 sm:grid-cols-4 gap-2"/);
  assert.doesNotMatch(src, /className="grid grid-cols-4 gap-2"/);
});
