import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The Production plan page's three pop-up sheets and its small controls, pinned from source
// (this repo's convention: tests/tap-targets.test.ts, tests/w28-dialog-focus.test.ts). The browser
// measurements in docs/audits/2026-11-10/evidence-crop-plan-reaudit/ are the acceptance
// instruments; these fail first when someone removes what they measure.

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const page = read('app/facilitator/crops/page.tsx');
const css = read('app/globals.css');

const SHEETS = [
  { fn: 'function CropPickerModal(', id: 'crop-picker-title' },
  { fn: 'function PlantingPopover(', id: 'planting-detail-title' },
  { fn: 'function AutoSuggestModal(', id: 'auto-suggest-title' },
];

function body(fn: string): string {
  const at = page.indexOf(fn);
  assert.ok(at > 0, `${fn} moved`);
  const next = page.indexOf('\nfunction ', at + 10);
  const nextConst = page.indexOf('\nconst ', at + 10);
  const ends = [next, nextConst].filter((n) => n > 0);
  return page.slice(at, Math.min(...ends));
}

for (const sheet of SHEETS) {
  test(`${sheet.fn.slice(9, -1)} is a labelled, modal dialog with focus and Escape handled`, () => {
    const src = body(sheet.fn);
    assert.match(src, /role="dialog"/, 'no dialog role');
    assert.match(src, /aria-modal="true"/, 'not modal');
    assert.match(src, new RegExp(`aria-labelledby="${sheet.id}"`), 'dialog is not named by its title');
    assert.match(src, new RegExp(`<span id="${sheet.id}" className="font-display`), 'the title span lost its id or its font-display marker');
    assert.match(src, /useDialogFocus\(true, dialogRef/, 'focus is not moved in, contained and returned');
    assert.match(src, /useEscapeClose\(true, onClose\)/, 'Escape no longer closes it');
    assert.match(src, /ref=\{dialogRef\}/, 'the dialog ref is not on the card');
    // The measurement script finds a sheet by these three markers.
    assert.match(src, /background: 'rgba\(20,16,10,0\.35\)'/, 'backdrop marker moved');
    assert.match(src, /aria-label=\{cropUi\(lang, 'Close', 'Vala'\)\} style=\{SHEET_CLOSE_STYLE\}/, 'Close button lost its label or its 44px style');
  });
}

test('the crop picker lands on its search field; planting detail on Edit, never on Remove', () => {
  // data-autofocus, not autoFocus: React applies autoFocus before the hook records the opener.
  assert.match(body(SHEETS[0].fn), /ref=\{searchRef\}\s+data-autofocus/);
  assert.doesNotMatch(body(SHEETS[0].fn), /<input\s+autoFocus/);
  const detail = body(SHEETS[1].fn);
  assert.match(detail, /onClick=\{onEdit\}\s+data-autofocus/);
  assert.doesNotMatch(detail, /onClick=\{onRemove\}\s+data-autofocus/);
  // The long Auto-suggest form takes the container: its first control is a dismiss.
  assert.match(body(SHEETS[2].fn), /useDialogFocus\(true, dialogRef, \{ initialFocus: 'container' \}\)/);
});

test('the three Close buttons have a 44x44 hit area', () => {
  const style = page.match(/const SHEET_CLOSE_STYLE[\s\S]*?\};/)?.[0] ?? '';
  assert.match(style, /width: 44, height: 44/);
  assert.equal((page.match(/style=\{SHEET_CLOSE_STYLE\}/g) ?? []).length, 3);
});

test('planting lanes, "+ crop" and the transplant chip follow one touch/narrow rule', () => {
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 767px\) \{\s*\.crop-plan-lanes \{/);
  assert.match(css, /--crop-lane-h: 30px;/);
  assert.match(css, /--crop-lane-h: 48px;/);
  assert.match(css, /--crop-add-min-h: 44px;/);
  // The chip stays 24px on touch too: at 44px its hit area covered part of its own bar and of
  // the lane above and took their taps. 24px meets WCAG 2.5.8.
  assert.match(css, /--crop-chip-hit-h: 24px;/);
  assert.doesNotMatch(css, /--crop-chip-hit-h: 44px;/, 'a 44px transplant chip takes taps from the bars around it');
  assert.match(page, /className="crop-plan-lanes"/, 'the bed scroller no longer carries the lane variables');
  assert.match(page, /height: 'var\(--crop-lane-h, 30px\)'/);
  assert.match(page, /minHeight: 'var\(--crop-add-min-h, 26px\)'/);
  // Fruit and animal bars sit in their own lanes and follow the same rule.
  assert.match(css, /--crop-produce-lane-h: 34px;/);
  assert.match(css, /--crop-produce-lane-h: 48px;/);
  assert.match(page, /height: 'var\(--crop-produce-lane-h, 34px\)'/);
  assert.match(page, /height: 'var\(--crop-chip-hit-h, 24px\)'/);
  // The bar's visible height is its hit area: it fills the lane less 2px top and bottom.
  assert.match(page, /top: 2, bottom: 2,\s*\n\s*\/\/ Year one paints/);
});

test('Home keeps a 44x44 hit area around the 34px drawn button', () => {
  assert.match(page, /style=\{\{ width: 44, height: 44, color: 'var\(--text-secondary\)', textDecoration: 'none' \}\}/);
});

test('the header title is the one h1 of the planner view only', () => {
  assert.match(page, /const TitleTag = !invalidCanvasSite && !needsSitePicker && allowCataloguePlanning \? 'h1' : 'span';/);
  assert.equal((page.match(/<TitleTag /g) ?? []).length, 2);
  // The views that render their own h1 must keep it, or they would lose the heading.
  assert.match(page, /This site link is not valid/);
  assert.match(read('components/international/countries/PlannerSupportHold.tsx'), /<h1 /);
});

test('production-guide source links are 24px targets, 44px on touch or narrow', () => {
  assert.match(read('components/crops/ProductionGuideCard.tsx'), /className="crop-plan-source-link"/);
  assert.match(css, /\.crop-plan-source-link \{ display: inline-flex; align-items: center; min-height: 24px; \}/);
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 767px\) \{\s*\.crop-plan-source-link \{ min-height: 44px; \}/);
});


test('"Auto-suggest a plan" and "Add a crop" are at least 44px tall', () => {
  // Their padding (py-2.5) gave 43px: one pixel under the house tap rule on the two main buttons.
  assert.match(page, /onClick=\{openAutoSuggest\}[\s\S]{0,700}className="flex-1 min-h-11 rounded-xl/);
  assert.match(page, /onClick=\{\(\) => openPicker\(beds\[0\]\.id\)\}\s*className="w-full min-h-11 rounded-xl/);
});
