import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// code-15/copy-15/zu-07 (2026-10-16 visual/UX audit), owned-files portion:
//   code-15 — app/account/page.tsx's 5 `outline-none` inputs had no focus-visible replacement
//     (globals.css's global ring is a zero-specificity :where() selector the utility class wins
//     over), so keyboard users lost the focus indicator on every field.
//   copy-15 — community post/profile photos were marked decorative (alt="") when they carry the
//     post's or person's own content; a screen-reader user heard nothing for them.
//   zu-07 — the fixed sample-mode "Tour" pill was hardcoded English in both SampleModeBanner and
//     AccountButton regardless of language, while MenuButton already showed isiZulu "Uhambo" for
//     the same control.
//
// Not touched: app/invoice/page.tsx, app/surveys/page.tsx, app/records/page.tsx,
// app/mentor/page.tsx, components/CropSelect.tsx, components/records/RecordQuantityFields.tsx,
// components/SavedPlaces.tsx, components/SiteSurveySheet.tsx, components/design/DesignCanvas.tsx,
// app/network/page.tsx, components/network/FarmerPanel.tsx, components/journal/FieldJournal.tsx,
// components/EvidenceSheet.tsx, components/MenuButton.tsx — all named in these findings'
// suggested file lists but outside this track's files.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('code-15: every outline-none input in app/account/page.tsx has a focus-visible ring', () => {
  const src = source('../app/account/page.tsx');
  const outlineNoneCount = (src.match(/outline-none/g) ?? []).length;
  const ringCount = (src.match(/outline-none focus-visible:ring-2 focus-visible:ring-\[var\(--gold\)\]/g) ?? []).length;
  assert.equal(outlineNoneCount, 5, 'the input count changed; re-check whether this test still covers all of them');
  assert.equal(ringCount, 5, 'every outline-none element must also carry the focus-visible ring');
});

test('copy-15: community post/profile/public-profile photos describe what they show', () => {
  const board = source('../app/community/page.tsx');
  assert.match(board, /alt=\{`Photo posted by \$\{p\.owner_name\}`\}/);
  assert.doesNotMatch(board, /data-photo-preview src=\{p\.photo_url\} alt=""/);

  const profile = source('../app/community/profile/page.tsx');
  assert.match(profile, /alt=\{`Profile photo \$\{i \+ 1\}`\}/);

  const publicProfile = source('../app/community/u/[uid]/page.tsx');
  assert.match(publicProfile, /alt=\{`Photo of \$\{profile\.display_name\}/);
});

test('zu-07: SampleModeBanner and AccountButton share the tourPill translation key', () => {
  const banner = source('../components/SampleModeBanner.tsx');
  const button = source('../components/AccountButton.tsx');
  assert.match(banner, /\{t\('tourPill'\)\}/);
  assert.match(button, /isSampleMode\(\) \? t\('tourPill'\)/);
  assert.doesNotMatch(button, /isSampleMode\(\) \? 'Tour'/, 'must no longer be a hardcoded English literal');

  const i18n = source('../lib/i18n.tsx');
  const zuLocale = source('../lib/locales/zu.ts');
  assert.match(i18n, /tourPill: 'Tour',/);
  assert.match(zuLocale, /tourPill: 'Uhambo',/, 'must match MenuButton.tsx\'s own hardcoded isiZulu text for this control');
});
