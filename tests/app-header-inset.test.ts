import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// THE FIX THAT ONLY REACHED HALF THE APP.
//
// app/layout.tsx sets `viewportFit: 'cover'`, so the page paints edge to edge and every fixed edge
// is the app's to pad. A 52px top bar pinned at y=0 therefore sits UNDERNEATH the status bar: the
// clock, signal and battery land on the Back button and the page title. Rory reported it from a
// phone screenshot of My Studies where "Back" read as "ack".
//
// The first fix found the bars by searching for one exact inline style string. Ten matched. Nine
// did NOT, because the same 52px bar is written four different ways — with the literal #FFFEFA, with
// `var(--color-surface)`, with `var(--bg-1)`, and with local PAPER/LINE constants on /network. So
// /journal, /calendar, /account, /survey, /invoice, /vision, /records, /prices and /network stayed
// broken while the fix was reported as done, and the pages left broken were the farmer-facing ones.
//
// A search-and-replace has no memory. This does: the app bar's height may only come from the shared
// constants, so a new header cannot be written without the inset, and nobody has to remember which
// of four spellings to grep for.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APP = path.join(ROOT, 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Strip comments so prose describing the old pattern does not trip the check. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('the app bar gets its height from the shared constants, never a bare 52', () => {
  const offenders: string[] = [];
  for (const file of walk(APP)) {
    const src = code(readFileSync(file, 'utf8'));
    // `height: 52` / `height:52` / `height: 52px` written straight into a style object.
    if (/height:\s*52(px)?\s*[,}]/.test(src)) {
      offenders.push(path.relative(ROOT, file).split(path.sep).join('/'));
    }
  }
  assert.deepEqual(
    offenders, [],
    'these files set the 52px app bar height directly, which skips the status-bar inset and puts '
      + `the bar under the phone's clock:\n${offenders.map((o) => `  ${o}`).join('\n')}\n`
      + 'Spread APP_HEADER_INSET from lib/app-header.ts (keeping your own background and border), '
      + 'or use APP_HEADER_STYLE if the bar wants the standard paper colours too.',
  );
});

test('both shared constants actually carry the top inset', () => {
  // The rule above is only worth anything if what it points at is correct. If someone simplifies
  // these constants back to a plain `height: 52`, every header regresses at once and silently —
  // so assert the inset is present in both, and that it degrades to nothing without a notch.
  const src = readFileSync(path.join(ROOT, 'lib/app-header.ts'), 'utf8');
  const inset = src.slice(src.indexOf('APP_HEADER_INSET: CSSProperties'));
  assert.match(inset, /height:\s*'calc\(52px \+ env\(safe-area-inset-top, 0px\)\)'/,
    'APP_HEADER_INSET must grow by the inset rather than let padding eat the 52px: border-box is '
    + 'global, so padding alone keeps the bar 52px tall and just squashes its contents.');
  assert.match(inset, /paddingTop:\s*'env\(safe-area-inset-top, 0px\)'/,
    'APP_HEADER_INSET must also push its contents down, or the bar grows while the title stays '
    + 'under the clock.');
  assert.ok(
    src.includes('...APP_HEADER_INSET'),
    'APP_HEADER_STYLE must spread APP_HEADER_INSET rather than repeat the calc()s, so the two '
    + 'cannot drift apart.',
  );
  // The 0px fallback is what keeps desktop identical to before the fix.
  assert.equal((inset.match(/env\(safe-area-inset-top, 0px\)/g) ?? []).length, 2,
    'both values need the 0px fallback, so a screen with no inset renders exactly as before.');
});
