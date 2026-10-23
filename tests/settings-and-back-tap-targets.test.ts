// A source-level guard for two controls that were under the 44px touch-target floor — the same
// floor BackControl.tsx already documents and holds itself to for its own floating fallback.
//
// components/ThemePanel.tsx's close button was a fixed 28x28 box: small enough to mistap on the
// one panel whose job is to make the app easier to use. components/BackButton.tsx — the in-flow
// "back" control rendered in 15+ page headers (journal, records, cropplan, network, vision,
// updates, funder, surveys, ngo, atlas, survey, invoice, and more via RolePlaceholder /
// design-studio-2) — was ~27px tall, and icon-only (no "Back" label) below the `sm` breakpoint,
// which is every phone this app targets.
//
// Source-scanned rather than measured in a browser, matching tests/tap-targets.test.ts and
// tests/back-control.test.ts's own style in this repo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const MIN = 44;

test('the Appearance panel close button clears the 44px touch-target floor', () => {
  const src = source('../components/ThemePanel.tsx');
  // The label follows the selected language (isiXhosa via inlineText); retain the labels and the same touch target.
  const label = "aria-label={zu ? 'Vala izilungiselelo' : inlineText(lang, 'Close settings')}";
  const at = src.indexOf(label);
  assert.ok(at > 0, 'the Appearance panel close button moved or lost its bilingual label');
  const nearby = src.slice(at, at + 400);
  const width = nearby.match(/width:\s*(\d+)/);
  const height = nearby.match(/height:\s*(\d+)/);
  assert.ok(width && height, 'could not find the close button\'s width/height declaration');
  assert.ok(Number(width![1]) >= MIN, `close button is ${width![1]}px wide — a fingertip needs ${MIN}`);
  assert.ok(Number(height![1]) >= MIN, `close button is ${height![1]}px tall — a fingertip needs ${MIN}`);
});

test('the in-flow Back button clears the 44px touch-target floor', () => {
  const src = source('../components/BackButton.tsx');
  assert.match(
    src,
    /minHeight:\s*44/,
    'BackButton lost its 44px minHeight — it renders icon-only (no label) below the sm breakpoint, on every phone this app targets',
  );
  assert.match(src, /minWidth:\s*44/, 'BackButton lost its 44px minWidth');
});

test('BackButton is still the widely-shared control this guard assumes it is', () => {
  // If usage collapses to a couple of call sites, the "15+ headers" framing above is stale and
  // this test (and the fix it guards) should be re-scoped, not silently left describing a
  // component nobody uses anymore.
  //
  // w13: /vision, /funder, /surveys and /ngo stopped importing BackButton directly — they now
  // render components/layout/AppHeader.tsx, which renders BackButton itself (see the earlier
  // test above: AppHeader's own BackButton still clears the 44px floor). Direct-or-via-AppHeader
  // both count as "still using BackButton" for this canary's purpose.
  //
  // w14: /journal, /network, /updates, /atlas, /contact, /tour, /tips, /offline and /samples moved
  // to AppHeader too (desk-02/desk-04), so they count the same way.
  const direct = [
    '../app/records/page.tsx', '../app/cropplan/page.tsx', '../app/invoice/page.tsx',
    '../app/calendar/page.tsx', '../app/prices/page.tsx', '../app/farmer/page.tsx', '../app/home/page.tsx',
  ];
  const viaAppHeader = [
    '../app/vision/page.tsx', '../app/funder/page.tsx', '../app/surveys/page.tsx', '../app/ngo/page.tsx',
    '../app/journal/page.tsx', '../app/network/page.tsx', '../app/updates/page.tsx', '../app/atlas/page.tsx',
    '../app/contact/page.tsx', '../app/tour/page.tsx', '../app/tips/page.tsx', '../app/offline/page.tsx',
    '../app/samples/page.tsx',
  ];
  const appHeaderRendersBackButton = /import BackButton/.test(source('../components/layout/AppHeader.tsx'));
  assert.ok(appHeaderRendersBackButton, 'AppHeader no longer renders BackButton — the pages below no longer reach it at all');
  const stillImports = direct.filter((rel) => {
    try {
      return /import BackButton/.test(source(rel));
    } catch {
      return false;
    }
  });
  const stillViaAppHeader = viaAppHeader.filter((rel) => {
    try {
      return /import AppHeader/.test(source(rel));
    } catch {
      return false;
    }
  });
  const total = stillImports.length + stillViaAppHeader.length;
  assert.ok(
    total >= 10,
    `only ${total} of the expected pages still reach BackButton (directly or via AppHeader) — re-check the "15+ headers" claim above`,
  );
});
