import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// zu-09/ux-03/nav-04 (2026-10-16 visual/UX audit), owned-files portion:
//   zu-09 — /login mixed bilingual ('Ngena · Sign in') and isiZulu-only ('Ikheli le-imeyili')
//     labels, which also wrapped the sign-in/create segmented control to two lines. Picked
//     isiZulu-only for every label, with the existing loginZuluDraftNotice banner as the one
//     place English is kept.
//   ux-03/nav-04 — developer vocabulary ("Backend not connected", "Connect Firebase",
//     "the developer inbox") on /login, /contact and /feedback. Rewritten in plain words.
//
// Not touched: app/surveys/page.tsx ("connect Firebase to go live"), app/student/page.tsx (the
// permanent 'Progress will save to Firebase...' footer line) — not owned by this track.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('zu-09: /login no longer appends an English pair to isiZulu labels', () => {
  const src = source('../app/login/page.tsx');
  assert.doesNotMatch(src, /lang === 'zu' && keepEnglish/, 'the bilingual-pairing branch must be gone');
  assert.doesNotMatch(src, /authLabel\([^)]*,\s*true\)/, 'no call site may still ask for the English pair');
});

test('ux-03/nav-04: /login\'s backend-unavailable notice is in plain words', () => {
  const i18n = source('../lib/i18n.tsx');
  const zu = source('../lib/locales/zu.ts');
  assert.doesNotMatch(i18n, /loginBackendUnavailableNotice: 'Backend not connected/);
  assert.match(i18n, /loginBackendUnavailableNotice: 'Sign-in is not available in this practice version\./);
  assert.doesNotMatch(zu, /Uhlelo olungemuva alukaxhunywa/);
});

test('ux-03/nav-04: /contact no longer says "Backend not connected" or "Connect Firebase"', () => {
  const src = source('../app/contact/page.tsx');
  assert.doesNotMatch(src, /Backend not connected/);
  assert.doesNotMatch(src, /Connect Firebase/);
  assert.match(src, /Practice version: your message is kept on this device/);
});

test('ux-03/nav-04: ContactInbox no longer says "Backend not connected" or "Connect Firebase"', () => {
  const src = source('../components/ContactInbox.tsx');
  assert.doesNotMatch(src, /Backend not connected/);
  assert.doesNotMatch(src, /Connect Firebase/);
});

test('ux-03/nav-04: /feedback no longer addresses "the developer" on the farmer-facing form', () => {
  const src = source('../app/feedback/page.tsx');
  const adminAt = src.indexOf("role==='admin'");
  assert.ok(adminAt > 0, 'the admin-only Developer inbox section is gone; this test needs rewriting rather than deleting');
  const farmerForm = src.slice(0, adminAt);
  assert.doesNotMatch(farmerForm, /Tell the developer/);
  assert.doesNotMatch(farmerForm, /developer inbox/i, 'the admin-only "Developer inbox" heading is legitimately named that; this form-facing half must not use the word at all');
  assert.doesNotMatch(farmerForm, /'Send to developer'/);
  assert.match(farmerForm, /Tell us what happened/);
  assert.match(farmerForm, /paired\('Send','Thumela'\)/);
});
