import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// "I measured the running app... its rendered height is 66.5px — from py-2 plus the icon plus
// the label. Nothing declares it." — CORRECTION.md, after an earlier pass hard-coded
// `--bottom-nav-height: 60px` in app/globals.css: wrong by ~6.5px today, and a fresh instance of
// this repo's most repeated defect — one truth in two places with nothing to keep them in step.
// Change the padding or label size in TabBar.tsx and a hand-written constant silently becomes a
// lie. This test does not care what the number is; it cares that there is exactly one place that
// can produce it, and that PWAUpdateNotifier reads that place rather than a guess of its own.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('TabBar measures its own rendered element and publishes the height', () => {
  const tabBar = source('../components/TabBar.tsx');

  // A ref on the actual bar (not some ancestor wrapper).
  assert.match(tabBar, /ref=\{barRef\}/, 'the ref is not attached to the rendered bar');
  assert.match(tabBar, /barRef\.current/, 'the effect must read the same element the ref points at');
  // getBoundingClientRect(), not offsetHeight: offsetHeight rounds to the nearest integer, which
  // would publish 67px for a 66.5px bar and desync the variable from the element it describes.
  assert.match(
    tabBar,
    /const next = `\$\{el\.getBoundingClientRect\(\)\.height\}px`/,
    'TabBar must measure its sub-pixel height, not an integer-rounded one',
  );
  assert.match(
    tabBar,
    /setProperty\(\s*['"]--bottom-nav-height['"]\s*,\s*next\s*\)/,
    'TabBar must publish the measured height to --bottom-nav-height',
  );
  assert.doesNotMatch(
    tabBar,
    /setProperty\(\s*['"]--bottom-nav-height['"][^)]*offsetHeight/,
    'offsetHeight rounds to an integer and will not match a getBoundingClientRect() measurement',
  );
});

test('TabBar survives a text-size change even though ResizeObserver alone does not', () => {
  const tabBar = source('../components/TabBar.tsx');

  // Measured live: the Appearance text-size setting (lib/theme.tsx's
  // `document.documentElement.style.zoom`) visibly rescales the bar — getBoundingClientRect()
  // on it reports the bigger size — but Chromium's ResizeObserver never fires a notification for
  // a zoom-only change. A one-shot mount measurement AND a ResizeObserver-only fix both go stale
  // the moment someone picks "Larger"; only a MutationObserver watching the zoom assignment
  // itself catches it.
  assert.match(tabBar, /new ResizeObserver/, 'still needed for changes zoom-toggling cannot explain');
  assert.match(
    tabBar,
    /new MutationObserver/,
    'ResizeObserver alone does not fire for a zoom-only size change — measured live, not assumed',
  );
  const styleObserverAt = tabBar.indexOf('new MutationObserver');
  const observeCall = tabBar.slice(styleObserverAt, styleObserverAt + 200);
  assert.match(observeCall, /attributeFilter:\s*\[\s*['"]style['"]\s*\]/, 'must watch <html>\'s style attribute — that is what the zoom setter changes');
});

test('publish() is idempotent, so the MutationObserver cannot re-trigger itself forever', () => {
  const tabBar = source('../components/TabBar.tsx');
  // publish() writes to root.style, and the MutationObserver above watches root's style
  // attribute — without a guard, every publish would queue another mutation notification.
  assert.match(
    tabBar,
    /if \(root\.style\.getPropertyValue\(\s*['"]--bottom-nav-height['"]\s*\)\s*!==\s*next\)/,
    'publish must skip the write when the value has not changed, or the two observers loop',
  );
});

test('TabBar clears the variable on unmount so a nav-less route cannot inherit a stale value', () => {
  const tabBar = source('../components/TabBar.tsx');
  assert.match(tabBar, /resizeObserver\?\.disconnect\(\)/, 'the ResizeObserver is never torn down');
  assert.match(tabBar, /styleObserver\?\.disconnect\(\)/, 'the MutationObserver is never torn down');
  assert.match(
    tabBar,
    /removeProperty\(\s*['"]--bottom-nav-height['"]\s*\)/,
    '/login and other nav-less routes must not keep whatever page mounted a TabBar last',
  );
});

test('PWAUpdateNotifier positions the pill off the published variable, not a literal guess', () => {
  const notifier = source('../components/PWAUpdateNotifier.tsx');

  const m = notifier.match(/const containerBottomStyle = '([^']+)'/);
  assert.ok(m, 'containerBottomStyle assignment not found');
  const calc = m![1];

  assert.match(calc, /var\(--bottom-nav-height\)/, 'the notifier must read the CSS variable TabBar publishes');
  // No second literal number living alongside the var() — app/globals.css's :root rule is the
  // one place a fallback number is allowed to exist; a copy here is the exact bug this file fixes.
  assert.doesNotMatch(
    calc,
    /--bottom-nav-height\s*,\s*[\d.]+px/,
    'a fallback pixel literal here duplicates the one in app/globals.css :root — that duplication is the bug',
  );
});

test('app/globals.css keeps exactly one fallback, clearly marked as one', () => {
  const css = source('../app/globals.css');

  const rootMatch = css.match(/--bottom-nav-height:\s*([\d.]+)px;/);
  assert.ok(rootMatch, 'the :root pre-hydration fallback is missing');

  const commentAt = css.lastIndexOf('/*', css.indexOf('--bottom-nav-height:'));
  const comment = css.slice(commentAt, css.indexOf('--bottom-nav-height:'));
  assert.match(comment, /FALLBACK/i, 'the :root value must be labelled as a fallback');
  assert.match(comment, /TabBar\.tsx/, 'the comment must point at TabBar.tsx as the real source');

  // The sample-mode override must reuse the variable rather than hard-coding its own number.
  const sampleModeRule = css.slice(css.indexOf('is-sample-mode .pwa-update-notifier'));
  assert.match(sampleModeRule, /var\(--bottom-nav-height\)/);
  assert.doesNotMatch(sampleModeRule.slice(0, sampleModeRule.indexOf('}')), /--bottom-nav-height\s*,\s*[\d.]+px/);
});

test('the ?force-update testing backdoor cannot fire in production', () => {
  const notifier = source('../components/PWAUpdateNotifier.tsx');
  const at = notifier.indexOf("params.has('force-update')");
  assert.ok(at > 0, 'the force-update testing hook is gone; update this test if it was removed on purpose');
  const before = notifier.slice(Math.max(0, at - 400), at);
  assert.match(
    before,
    /NODE_ENV\s*===\s*['"]production['"]/,
    'any visitor could still conjure the update panel with a query param in production',
  );
});

test('the WHY-these-notes-live-here comment is back, pointing at lib/release-notes.ts', () => {
  const notifier = source('../components/PWAUpdateNotifier.tsx');
  assert.match(
    notifier,
    /See lib\/release-notes\.ts for the house style/,
    'the decision record for why notes are listed under Refresh was deleted and never restored',
  );
});
