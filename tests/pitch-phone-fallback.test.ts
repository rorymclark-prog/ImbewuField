import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ux-10/staff-06: on a phone the pitch deck used to render as a ~370px-wide slide at 5-8px type,
// with a keyboard-hints line ('← → move · F fullscreen · P print / PDF' — meaningless on a
// touchscreen) that could run wide enough to sit under the Back/Next buttons in the same bottom
// corner. Every slide below assumes the deck's full 1280×720 canvas, so this takes the track's
// own suggested lower-risk fix: below 768px, show a short "best on a laptop" card with a direct
// print/PDF action instead of rebuilding every slide as a responsive phone layout.

const PAGE = readFileSync(new URL('../app/pitch/page.tsx', import.meta.url), 'utf8');

test('a phone-width viewport gets a fallback card instead of the scaled-down deck', () => {
  assert.match(PAGE, /window\.matchMedia\('\(max-width: 767px\)'\)/, 'the phone-width check is gone');
  assert.match(PAGE, /if \(phoneFallback\) \{\s*\n\s*return \(/, 'phoneFallback no longer short-circuits the render');
  assert.match(PAGE, /Best viewed on a laptop/, 'the fallback card lost its message');
  assert.match(PAGE, /onClick=\{\(\) => window\.print\(\)\}/, 'the fallback card must offer the same print/PDF path as the P key');
});

test('a tablet (coarse pointer, but wide enough) still gets the real deck, not the fallback', () => {
  // The live-iframe demo slides exist specifically so a presenter can tap around mid-meeting —
  // a width-only check, not (pointer: coarse), is what keeps a tablet on the real deck.
  const checkFn = PAGE.slice(PAGE.indexOf('const check = () =>'), PAGE.indexOf(';', PAGE.indexOf('const check = () =>')));
  assert.doesNotMatch(checkFn, /pointer:\s*coarse/, 'the phone-fallback check must not also trigger on every coarse-pointer device (breaks the tablet demo use case)');
});

test('keyboard hints are hidden on any coarse pointer, even where the real deck still renders', () => {
  assert.match(PAGE, /@media \(pointer: coarse\) \{\s*\n\s*\.hints \{ display: none; \}/, 'the hints line is no longer hidden on touchscreens');
});

test('the nav buttons keep the 44px touch-target floor', () => {
  assert.match(PAGE, /\.navbtns button \{[^}]*min-height: 44px;/, 'navbtns buttons dropped below the 44px touch floor');
});
