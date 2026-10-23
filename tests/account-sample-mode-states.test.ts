import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ux-04/sdesk-02/staff-07/nav-05/desk-11 (2026-10-16 visual/UX audit): app/account/page.tsx's
// `if (loading || !user) { return <Sprout opacity 0.4/> }` never resolved to a real page in
// sample/tour mode (no Firebase user there) or when the backend was never configured — every
// captured frame for every role, phone and desktop, light and dark, was a blank page with a
// faint sprout and nothing else: no heading, no message, no way back.

const page = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');

test('the loading/no-user branch no longer returns a bare sprout with nothing else', () => {
  const guardAt = page.indexOf('if (loading || !user) {');
  assert.ok(guardAt > 0, 'the guard moved; this test needs rewriting rather than deleting');
  const guardBlock = page.slice(guardAt, guardAt + 6000);
  assert.match(guardBlock, /samplePreview/, 'sample mode must be checked before giving up on a real page');
  // The check has to be hydration-safe: isSampleMode() reads sessionStorage, so calling it during
  // render gave every sample-mode frame of /account a React #418 mismatch (wave 14, w14-01).
  assert.match(page, /const samplePreview = !!useSampleRole\(\)/, 'the sample check must come from useSampleRole (useSyncExternalStore), not a render-time sessionStorage read');
  assert.doesNotMatch(guardBlock, /isSampleMode\(\)/, 'isSampleMode() must not run during render');
  assert.match(guardBlock, /getSandboxProfile\(\)/, 'a sample-mode visitor must see the sandbox profile, not a spinner');
  assert.match(guardBlock, /AccountShellHeader/, 'every branch must still render the real header — MenuButton, BackButton, title — not a bare icon');
});

test('a sample-mode visitor gets a real account view with sign-in and exit actions', () => {
  const sampleBranchAt = page.indexOf('if (samplePreview) {');
  assert.ok(sampleBranchAt > 0);
  const sampleBranch = page.slice(sampleBranchAt, sampleBranchAt + 5500);
  assert.match(sampleBranch, /exitSampleMode\(\)/, 'must offer a way to leave the tour, not just sign in');
  assert.match(sampleBranch, /router\.push\('\/login'\)/, 'must offer a real sign-in path so progress is not lost to the practice version');
  // desk-07: TabBar now takes hideAtDesktop on pages that adopted AppHeader (its own lg+ nav
  // replaces the phone bar there) — the attribute is optional in this match so the test still
  // pins what it actually cares about: the tab bar is rendered, not dropped, in this branch.
  assert.match(sampleBranch, /<TabBar(?: hideAtDesktop)? \/>/, 'the sample-mode account view must keep the tab bar — the farmer should not lose the way around');
});

test('a genuinely slow auth check gets a sentence and a timeout fallback, not an endless spinner', () => {
  assert.match(page, /const \[authSlow, setAuthSlow\] = useState\(false\)/, 'a timeout flag must exist so loading cannot spin forever');
  assert.match(page, /setTimeout\(\(\) => setAuthSlow\(true\), 4000\)/, 'the timeout must actually be wired to a real setTimeout call');
  assert.match(page, /Loading your account/, 'the loading state must say what is happening, not just show an icon');
});

test('the no-backend / timed-out fallback offers a sign-in action rather than nothing', () => {
  const lastReturnAt = page.lastIndexOf("{copy('Sign in', 'Ngena ngemvume')}");
  assert.ok(lastReturnAt > 0, 'the sign-in fallback button text is gone');
});

test('w15-03: the loading, tour and sign-in states still give the page a heading', () => {
  const page = readFileSync('app/account/page.tsx', 'utf8');
  const shell = page.slice(page.indexOf('function AccountShellHeader'), page.indexOf('const ROLE_LABELS'));
  assert.match(shell, /<h1 className="sr-only">\{copy\('Account', 'I-akhawunti'\)\}<\/h1>/,
    'AppHeader renders its title as a span, so without this /account has no h1 in sample mode');
});
